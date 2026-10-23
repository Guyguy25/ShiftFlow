"""Whop v1 checkout and verified, organization-bound recurring entitlements."""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from datetime import datetime, timezone
from decimal import Decimal
from urllib.parse import urlparse
import httpx
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError
from workspace_accounts import accounts

CATALOG = {
 'pro_monthly': {'plan_id':'plan_wT9sMJbmEPmEX','tier':'pro','amount':7900,'days':30},
 'pro_yearly': {'plan_id':'plan_bfw2MekzEdm1L','tier':'pro','amount':71100,'days':365},
 'team_monthly': {'plan_id':'plan_0qi0BSH21UYmt','tier':'team','amount':9900,'days':30},
 'team_yearly': {'plan_id':'plan_c4V3F8w1mC2Ij','tier':'team','amount':83160,'days':365},
 'business_monthly': {'plan_id':'plan_acPF1WcadHWiT','tier':'business','amount':14900,'days':30},
 'business_yearly': {'plan_id':'plan_7k832i8ogYfkD','tier':'business','amount':107280,'days':365},
}
RANK = {'pro':0,'team':1,'business':2}

def ready(): return all(os.environ.get(key, '').strip() for key in ('WHOP_API_KEY','WHOP_WEBHOOK_SECRET','WHOP_COMPANY_ID'))
def identifier(value): return value.get('id') if isinstance(value,dict) else value

def cents(value):
    try: return int(Decimal(str(value)) * 100)
    except Exception: return -1

async def api(method,path,body=None):
    if not ready(): raise HTTPException(503,'Le paiement Whop est en cours de configuration. Aucun paiement n’a été lancé.')
    base = 'https://sandbox-api.whop.com/api/v1' if os.environ.get('WHOP_SANDBOX') == 'true' else 'https://api.whop.com/api/v1'
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.request(method,base+path,headers={'Authorization':'Bearer '+os.environ['WHOP_API_KEY']},json=body)
            if response.status_code >= 400: raise HTTPException(502,'Whop est indisponible ou sa configuration doit être vérifiée.')
            return response.json()
    except httpx.HTTPError: raise HTTPException(502,'Impossible de joindre Whop. Réessayez.')

def validate_plan(plan,offer):
    company = identifier(plan.get('company')) or plan.get('company_id')
    if (plan.get('id') != offer['plan_id'] or company != os.environ.get('WHOP_COMPANY_ID') or plan.get('currency','').lower() != 'eur'
        or plan.get('plan_type') != 'renewal' or plan.get('billing_period') != offer['days']
        or cents(plan.get('initial_price')) != 0 or cents(plan.get('renewal_price')) != offer['amount']
        or plan.get('trial_period_days',0) or plan.get('expiration_days') or plan.get('split_pay_required_payments') or plan.get('adaptive_pricing_enabled') or plan.get('allow_multiple_quantity')):
        raise HTTPException(503,'Le montant, la devise ou la périodicité de cette offre Whop ne correspond pas au tarif affiché. Contactez le support.')

async def acquire(db,key):
    nonce=secrets.token_hex(16)
    try:
        result=await db.billing_locks.update_one({'_id':key,'$or':[{'until':{'$lt':time.time()}},{'until':{'$exists':False}}]}, {'$set':{'until':time.time()+90,'nonce':nonce}},upsert=True)
    except DuplicateKeyError: raise HTTPException(409,'Une opération de facturation est en cours. Réessayez dans quelques secondes.')
    return nonce
async def release(db,key,nonce): await db.billing_locks.delete_one({'_id':key,'nonce':nonce})

async def checkout(db,user,offer_key):
    if not ready(): raise HTTPException(503,'Le paiement Whop est en cours de configuration. Aucun paiement n’a été lancé.')
    offer=CATALOG.get(offer_key)
    if not offer: raise HTTPException(400,'Offre inconnue.')
    lock=await acquire(db,user['id'])
    try:
        account=await accounts(db).find_one({'id':user['id']})
        if account.get('plan') == 'pro' or account.get('whop_membership_id') or account.get('stripe_subscription_id'):
            raise HTTPException(409,'Un abonnement existe déjà pour cette organisation. Gérez-le depuis les paramètres avant de souscrire à nouveau.')
        if (account.get('return_feedback') or {}).get('promo_code'):
            raise HTTPException(409,'Votre offre personnelle de deux mois gratuits doit être transférée sur Whop par le support avant tout paiement. Contactez-nous pour la conserver.')
        pending=await db.whop_checkouts.find_one({'organization_id':user['id'],'expires_at':{'$gt':time.time()},'fulfilled':{'$ne':True}})
        if pending:
            if pending['offer_key'] != offer_key: raise HTTPException(409,'Un autre tarif est déjà ouvert pour cette organisation. Terminez ce paiement ou réessayez dans 20 minutes.')
            return {'session_id':pending['session_id'],'reference':pending['_id'],'environment':'sandbox' if os.environ.get('WHOP_SANDBOX') == 'true' else 'production'}
        plan=await api('GET','/plans/'+offer['plan_id']);validate_plan(plan,offer)
        ref=secrets.token_urlsafe(32)
        config=await api('POST','/checkout_configurations',{'plan_id':offer['plan_id'],'mode':'payment','metadata':{'shiftflow_checkout':ref,'organization_id':user['id']}})
        session_id=config.get('id','')
        if not re.fullmatch(r'ch_[A-Za-z0-9]+',session_id): raise HTTPException(502,'La session de paiement Whop est invalide.')
        await db.whop_checkouts.insert_one({'_id':ref,'session_id':session_id,'organization_id':user['id'],'offer_key':offer_key,'plan_id':offer['plan_id'],'expires_at':time.time()+1200,'created_at':time.time(),'legal_version':'2026-10-23','actor_id':user.get('actor_id',user['id']),'fulfilled':False})
        return {'session_id':session_id,'reference':ref,'environment':'sandbox' if os.environ.get('WHOP_SANDBOX') == 'true' else 'production'}
    finally: await release(db,user['id'],lock)

async def fulfill_payment(db,payment_id,expected_org=None):
    if not re.fullmatch(r'pay_[A-Za-z0-9]+',payment_id): raise HTTPException(400,'Paiement invalide.')
    payment=await api('GET','/payments/'+payment_id)
    metadata=payment.get('metadata') or {}
    ref=metadata.get('shiftflow_checkout')
    record=await db.whop_checkouts.find_one({'_id':ref}) if isinstance(ref,str) else None
    membership_id=identifier(payment.get('membership'))
    bound=await accounts(db).find_one({'whop_membership_id':membership_id}) if membership_id else None
    if not record and not bound: return None
    org_id=record['organization_id'] if record else bound['id']
    if expected_org and expected_org != org_id: raise HTTPException(403,'Ce paiement appartient à une autre organisation.')
    if bound and bound['id'] != org_id: raise HTTPException(400,'Abonnement lié à une autre organisation.')
    lock=await acquire(db,org_id)
    try:
        plan_id=identifier(payment.get('plan'))
        offer=next((v for v in CATALOG.values() if v['plan_id']==plan_id),None)
        if not offer or identifier(payment.get('company')) != os.environ.get('WHOP_COMPANY_ID'): return None
        initial=not bound
        if initial and (metadata.get('organization_id') != org_id or plan_id != record['plan_id']):
            raise HTTPException(400,'Le paiement ne correspond pas à cette organisation.')
        amount=cents(payment.get('subtotal'))
        if payment.get('status') not in ('paid','succeeded') or payment.get('refunded_amount',0) or payment.get('currency','').lower() != 'eur': return None
        # Initial price must exactly match the displayed offer. A known membership
        # may renew or change plan with a provider-calculated prorated amount.
        if (initial and amount != offer['amount']) or (not initial and not 0 < amount <= offer['amount']): return None
        if not membership_id or not re.fullmatch(r'mem_[A-Za-z0-9]+',membership_id): return None
        member=await api('GET','/memberships/'+membership_id)
        if member.get('status') != 'active' or identifier(member.get('plan')) != plan_id or identifier(member.get('company')) != os.environ.get('WHOP_COMPANY_ID'): return None
        current=await accounts(db).find_one({'id':org_id})
        if await db.whop_processed_payments.find_one({'_id':payment_id}): return org_id
        if not current or current.get('whop_refunded_payment_id') == payment_id: return None
        if current.get('stripe_subscription_id') or (current.get('whop_membership_id') and current['whop_membership_id'] != membership_id):
            raise HTTPException(409,'Un autre abonnement est déjà lié à cette organisation. Contactez le support.')
        await accounts(db).update_one({'id':org_id},{'$set':{'plan':'pro','subscription_tier':offer['tier'],'payment_provider':'whop','subscription_status':'active','whop_membership_id':membership_id,'whop_plan_id':plan_id,**({'whop_last_payment_id':payment_id,'whop_last_payment_at':str(payment.get('created_at') or '')} if not current.get('whop_last_payment_id') or str(payment.get('created_at') or '') > current.get('whop_last_payment_at','') else {})}})
        await db.whop_processed_payments.update_one({'_id':payment_id},{'$setOnInsert':{'organization_id':org_id}},upsert=True)
        if record:
            await db.whop_checkouts.update_one({'_id':ref},{'$set':{'fulfilled':True,'membership_id':membership_id,'payment_id':payment_id}})
        return org_id
    finally: await release(db,org_id,lock)

async def sync_membership(db,membership_id):
    if not re.fullmatch(r'mem_[A-Za-z0-9]+',membership_id): return
    current=await accounts(db).find_one({'whop_membership_id':membership_id})
    if not current: return
    lock=await acquire(db,current['id'])
    try:
        member=await api('GET','/memberships/'+membership_id)
        if identifier(member.get('company')) != os.environ.get('WHOP_COMPANY_ID'): raise HTTPException(400,'Organisation Whop incorrecte.')
        plan_id=identifier(member.get('plan'))
        offer=next((v for v in CATALOG.values() if v['plan_id']==plan_id),None)
        active=member.get('status')=='active' and bool(offer) and current.get('subscription_status') != 'refunded'
        tier=current.get('subscription_tier','pro')
        if active and RANK[offer['tier']] < RANK.get(tier,0): tier=offer['tier']
        await accounts(db).update_one({'id':current['id'],'whop_membership_id':membership_id},{'$set':{'plan':'pro' if active else 'free','subscription_tier':tier,'subscription_status':member.get('status'),'whop_plan_id':plan_id}, **({'$unset':{'whop_membership_id':''}} if member.get('status') in ('expired','canceled','cancelled') else {})})
    finally: await release(db,current['id'],lock)

def verify_webhook(raw,headers):
    secret=os.environ.get('WHOP_WEBHOOK_SECRET','')
    if not secret: raise HTTPException(503,'Webhook Whop non configuré.')
    try:
        timestamp=headers['webhook-timestamp'];event_id=headers['webhook-id']
        if abs(time.time()-int(timestamp))>300: raise ValueError()
        signed=event_id.encode()+b'.'+timestamp.encode()+b'.'+raw
        signature=base64.b64encode(hmac.new(secret.encode(),signed,hashlib.sha256).digest()).decode()
        if not any(hmac.compare_digest(candidate,'v1,'+signature) for candidate in headers['webhook-signature'].split()): raise ValueError()
        event=json.loads(raw)
        if not isinstance(event,dict): raise ValueError()
        return event,event_id
    except (KeyError,ValueError,TypeError): raise HTTPException(401,'Signature Whop invalide.')

async def portal(db,user):
    current=await accounts(db).find_one({'id':user['id']})
    membership_id=current.get('whop_membership_id')
    if not membership_id: raise HTTPException(400,'Aucun abonnement Whop pour cette organisation.')
    member=await api('GET','/memberships/'+membership_id)
    if identifier(member.get('company')) != os.environ.get('WHOP_COMPANY_ID'): raise HTTPException(400,'Abonnement Whop incorrect.')
    url=member.get('manage_url','')
    parsed=urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ('whop.com','www.whop.com'): raise HTTPException(502,'Portail Whop indisponible.')
    return {'url':url}

async def refund_payment(db,payment_id):
    if not re.fullmatch(r'pay_[A-Za-z0-9]+',payment_id): return
    payment=await api('GET','/payments/'+payment_id)
    if identifier(payment.get('company')) != os.environ.get('WHOP_COMPANY_ID'): return
    if cents(payment.get('refunded_amount',0)) < cents(payment.get('total',payment.get('subtotal'))) or cents(payment.get('refunded_amount',0)) <= 0: return
    current=await accounts(db).find_one({'whop_last_payment_id':payment_id})
    if not current: return
    lock=await acquire(db,current['id'])
    try:
        await accounts(db).update_one({'id':current['id'],'whop_last_payment_id':payment_id},{'$set':{'plan':'free','subscription_status':'refunded','whop_refunded_payment_id':payment_id}})
    finally: await release(db,current['id'],lock)
