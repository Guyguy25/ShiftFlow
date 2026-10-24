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
from workspace_accounts import accounts, billing_owner_id, billing_source
from meta_capi import send_meta_event

CATALOG = {
 'pro_monthly': {'plan_id':'plan_wT9sMJbmEPmEX','tier':'pro','amount':7900,'days':30},
 'pro_yearly': {'plan_id':'plan_bfw2MekzEdm1L','tier':'pro','amount':71100,'days':365},
 'start_monthly': {'plan_id':'plan_0qi0BSH21UYmt','tier':'start','amount':2900,'days':30},
 'start_yearly': {'plan_id':'plan_c4V3F8w1mC2Ij','tier':'start','amount':27840,'days':365},
 'business_monthly': {'plan_id':'plan_acPF1WcadHWiT','tier':'business','amount':14900,'days':30},
 'business_yearly': {'plan_id':'plan_7k832i8ogYfkD','tier':'business','amount':107280,'days':365},
}
# Legacy Team sold under the same Whop plan IDs before their repricing to Start.
# Keep older checkout quotes verifiable and grandfather already-active memberships.
LEGACY_TEAM_CHECKOUTS = {
 'team_monthly': {'plan_id':CATALOG['start_monthly']['plan_id'],'tier':'team','amount':9900,'days':30},
 'team_yearly': {'plan_id':CATALOG['start_yearly']['plan_id'],'tier':'team','amount':83160,'days':365},
}
START_PLAN_IDS = {CATALOG['start_monthly']['plan_id'], CATALOG['start_yearly']['plan_id']}
RANK = {'start':0,'pro':1,'team':1,'business':2}

def ready(): return all(os.environ.get(key, '').strip() for key in ('WHOP_API_KEY','WHOP_WEBHOOK_SECRET','WHOP_COMPANY_ID'))
def identifier(value): return value.get('id') if isinstance(value,dict) else value

def provider_company(obj):
    return identifier(obj.get('company')) or identifier(obj.get('account')) or obj.get('company_id')

def cents(value):
    try:
        amount = Decimal(str(value)) * 100
        return int(amount) if amount.is_finite() and amount == amount.to_integral_value() else -1
    except (ValueError, TypeError, ArithmeticError):
        return -1


def money(value):
    amount = cents(value)
    return f"{Decimal(amount) / 100:.2f} €".replace('.', ',') if amount >= 0 else 'valeur absente ou invalide'

async def api(method,path,body=None):
    if not ready(): raise HTTPException(503,'Le paiement Whop est en cours de configuration. Aucun paiement n’a été lancé.')
    base = 'https://sandbox-api.whop.com/api/v1' if os.environ.get('WHOP_SANDBOX') == 'true' else 'https://api.whop.com/api/v1'
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.request(method,base+path,headers={'Authorization':'Bearer '+os.environ['WHOP_API_KEY']},json=body)
            if response.status_code >= 400: raise HTTPException(502,'Whop est indisponible ou sa configuration doit être vérifiée.')
            return response.json()
    except httpx.HTTPError: raise HTTPException(502,'Impossible de joindre Whop. Réessayez.')

def validate_plan(plan, offer):
    """Fail closed, but identify the exact public catalog field that differs.

    New Whop responses expose account instead of company and a canonical
    initial_price_due. Use that verified total when available: initial_price
    alone does not establish what the first recurring checkout will charge.
    """
    issues = []
    company = identifier(plan.get('company')) or plan.get('company_id') or identifier(plan.get('account'))
    expected_company = os.environ.get('WHOP_COMPANY_ID', '').strip()
    if plan.get('id') != offer['plan_id']: issues.append('identifiant du plan incorrect')
    if not expected_company or company != expected_company: issues.append('entreprise différente de WHOP_COMPANY_ID, ou identifiant entreprise absent de la réponse')
    currency = plan.get('currency')
    if not isinstance(currency, str) or currency.lower() != 'eur':
        issues.append('devise attendue : EUR ; reçue : ' + (currency[:12] if isinstance(currency, str) else 'absente'))
    if plan.get('plan_type') != 'renewal': issues.append('le plan doit être un abonnement récurrent (renewal)')
    if plan.get('billing_period') != offer['days']:
        period = plan.get('billing_period')
        received = str(period) if type(period) in (int, float) else 'absente ou invalide'
        issues.append(f"périodicité attendue : {offer['days']} jours ; reçue : {received}")
    expected_price = money(Decimal(offer['amount']) / 100)
    if cents(plan.get('renewal_price')) != offer['amount']:
        issues.append(f"montant du renouvellement attendu : {expected_price} ; reçu : {money(plan.get('renewal_price'))}")
    if 'initial_price_due' in plan:
        due = plan.get('initial_price_due')
        if not isinstance(due, dict) or cents(due.get('amount')) != offer['amount'] or str(due.get('currency', '')).lower() != 'eur':
            received = money(due.get('amount')) if isinstance(due, dict) else 'valeur absente ou invalide'
            issues.append(f"premier paiement attendu : {expected_price} en EUR ; reçu : {received} (vérifiez aussi sa devise)")
    elif cents(plan.get('initial_price')) != 0:
        issues.append(f"frais initiaux attendus par l’intégration actuelle : 0,00 € ; reçus : {money(plan.get('initial_price'))}. Vérifiez le total du premier paiement avant de modifier le plan")
    # Whop reports this raw flag even when adaptive pricing is unavailable.
    # It only converts one-time payments; renewal plans keep their base currency.
    # We require renewal/EUR above and recheck the actual paid currency below.
    for key, label in (
        ('trial_period_days', 'période d’essai'), ('expiration_days', 'expiration automatique'),
        ('split_pay_required_payments', 'paiement fractionné'),
        ('allow_multiple_quantity', 'quantités multiples'),
    ):
        if plan.get(key): issues.append(label + ' à désactiver pour cette offre')
    if issues:
        name = offer['tier'].capitalize() + (' annuel' if offer['days'] == 365 else ' mensuel')
        raise HTTPException(503, f"Configuration Whop — {name} : " + ' ; '.join(issues) + '. Aucun paiement n’a été lancé.')

async def acquire(db,key):
    nonce=secrets.token_hex(16)
    try:
        result=await db.billing_locks.update_one({'_id':key,'$or':[{'until':{'$lt':time.time()}},{'until':{'$exists':False}}]}, {'$set':{'until':time.time()+90,'nonce':nonce}},upsert=True)
    except DuplicateKeyError: raise HTTPException(409,'Une opération de facturation est en cours. Réessayez dans quelques secondes.')
    return nonce
async def release(db,key,nonce): await db.billing_locks.delete_one({'_id':key,'nonce':nonce})

async def checkout(db,user,offer_key,tracking=None):
    if not ready(): raise HTTPException(503,'Le paiement Whop est en cours de configuration. Aucun paiement n’a été lancé.')
    offer=CATALOG.get(offer_key)
    if not offer: raise HTTPException(400,'Offre inconnue.')
    owner_id=await billing_owner_id(db,user['id'])
    lock=await acquire(db,owner_id)
    try:
        account=await accounts(db).find_one({'id':user['id']})
        if account.get('plan') == 'pro' or account.get('whop_membership_id') or account.get('stripe_subscription_id'):
            raise HTTPException(409,'Un abonnement couvre déjà vos organisations. Gérez-le depuis les paramètres avant de souscrire à nouveau.')
        owner_record=await db.users.find_one({'id':owner_id}) or {}
        if (account.get('return_feedback') or owner_record.get('return_feedback') or {}).get('promo_code'):
            raise HTTPException(409,'Votre offre personnelle de deux mois gratuits doit être transférée sur Whop par le support avant tout paiement. Contactez-nous pour la conserver.')
        # A checkout is a quote, not a subscription reservation. Reuse it only
        # for this offer so closing the modal never locks the other prices.
        # Keep every reference: a delayed provider payment must stay verifiable.
        pending=await db.whop_checkouts.find_one({'organization_id':user['id'],'billing_owner_id':owner_id,'offer_key':offer_key,'expires_at':{'$gt':time.time()},'fulfilled':{'$ne':True}})
        if pending:
            await db.whop_checkouts.update_one({'_id':pending['_id']},{'$set':{'tracking':tracking or {}}})
            await track_checkout(db,pending['_id'],owner_id,offer)
            return {'session_id':pending['session_id'],'reference':pending['_id'],'environment':'sandbox' if os.environ.get('WHOP_SANDBOX') == 'true' else 'production'}
        plan=await api('GET','/plans/'+offer['plan_id']);validate_plan(plan,offer)
        ref=secrets.token_urlsafe(32)
        config=await api('POST','/checkout_configurations',{'plan_id':offer['plan_id'],'mode':'payment','metadata':{'shiftflow_checkout':ref,'organization_id':user['id']}})
        session_id=config.get('id','')
        if not re.fullmatch(r'ch_[A-Za-z0-9]+',session_id): raise HTTPException(502,'La session de paiement Whop est invalide.')
        await db.whop_checkouts.insert_one({'_id':ref,'session_id':session_id,'organization_id':user['id'],'offer_key':offer_key,'plan_id':offer['plan_id'],'expires_at':time.time()+1200,'created_at':time.time(),'legal_version':'2026-10-24','actor_id':user.get('actor_id',user['id']),'billing_owner_id':owner_id,'tracking':tracking or {},'fulfilled':False})
        await track_checkout(db,ref,owner_id,offer)
        return {'session_id':session_id,'reference':ref,'environment':'sandbox' if os.environ.get('WHOP_SANDBOX') == 'true' else 'production'}
    finally: await release(db,owner_id,lock)

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
    if bound and await billing_owner_id(db,bound['id']) != await billing_owner_id(db,org_id):
        raise HTTPException(400,'Abonnement lié à un autre propriétaire.')
    owner_id=await billing_owner_id(db,org_id)
    lock=await acquire(db,owner_id)
    try:
        plan_id=identifier(payment.get('plan'))
        offer=next((v for v in CATALOG.values() if v['plan_id']==plan_id),None)
        if not offer or provider_company(payment) != os.environ.get('WHOP_COMPANY_ID'): return None
        initial=not bound
        legacy_quote = LEGACY_TEAM_CHECKOUTS.get(record.get('offer_key')) if record else None
        quoted_offer = legacy_quote if initial and legacy_quote else offer
        if initial and (metadata.get('organization_id') != org_id or plan_id != record['plan_id']):
            raise HTTPException(400,'Le paiement ne correspond pas à cette organisation.')
        amount=cents(payment.get('subtotal'))
        if payment.get('status') not in ('paid','succeeded') or payment.get('refunded_amount',0) or payment.get('currency','').lower() != 'eur': return None
        # Initial price must exactly match the displayed offer. A known membership
        # may renew or change plan with a provider-calculated prorated amount.
        if initial and amount != quoted_offer['amount']: return None
        if not initial:
            allowed = offer['amount']
            if bound.get('subscription_tier') == 'team' and bound.get('billing_catalog_version') != 2:
                if plan_id == CATALOG['start_monthly']['plan_id']: allowed = 9900
                if plan_id == CATALOG['start_yearly']['plan_id']: allowed = 83160
            if not 0 < amount <= allowed: return None
        if not membership_id or not re.fullmatch(r'mem_[A-Za-z0-9]+',membership_id): return None
        member=await api('GET','/memberships/'+membership_id)
        if member.get('status') != 'active' or identifier(member.get('plan')) != plan_id or provider_company(member) != os.environ.get('WHOP_COMPANY_ID'): return None
        _, source=await billing_source(db,org_id)
        target_id=bound['id'] if bound else source['id']
        current=await accounts(db).collection(target_id).find_one({'id':target_id})
        if await db.whop_processed_payments.find_one({'_id':payment_id}):
            if record and current and current.get('whop_membership_id') == membership_id:
                await db.whop_checkouts.update_one({'_id':ref},{'$set':{'fulfilled':True,'membership_id':membership_id,'payment_id':payment_id}})
            await track_subscription(db,record,payment,membership_id,owner_id)
            return org_id
        if not current or current.get('whop_refunded_payment_id') == payment_id: return None
        if current.get('stripe_subscription_id') or (current.get('whop_membership_id') and current['whop_membership_id'] != membership_id):
            raise HTTPException(409,'Un autre abonnement est déjà lié à cette organisation. Contactez le support.')
        legacy_team = (current.get('subscription_tier') == 'team' and current.get('billing_catalog_version') != 2
                       and current.get('whop_plan_id') == plan_id and plan_id in START_PLAN_IDS)
        next_tier = 'team' if legacy_team else quoted_offer['tier'] if initial else offer['tier']
        is_new_catalog = (initial and not legacy_quote) or (not initial and current.get('whop_plan_id') != plan_id)
        await accounts(db).update_one({'id':target_id},{'$set':{'plan':'pro','subscription_tier':next_tier,**({'billing_catalog_version':2} if is_new_catalog else {}),'payment_provider':'whop','subscription_status':'active','whop_membership_id':membership_id,'whop_plan_id':plan_id,**({'whop_last_payment_id':payment_id,'whop_last_payment_at':str(payment.get('created_at') or '')} if not current.get('whop_last_payment_id') or str(payment.get('created_at') or '') > current.get('whop_last_payment_at','') else {})}})
        await db.whop_processed_payments.update_one({'_id':payment_id},{'$setOnInsert':{'organization_id':org_id}},upsert=True)
        if record:
            await db.whop_checkouts.update_one({'_id':ref},{'$set':{'fulfilled':True,'membership_id':membership_id,'payment_id':payment_id}})
        await track_subscription(db,record,payment,membership_id,owner_id)
        return org_id
    finally: await release(db,owner_id,lock)

async def sync_membership(db,membership_id):
    if not re.fullmatch(r'mem_[A-Za-z0-9]+',membership_id): return
    current=await accounts(db).find_one({'whop_membership_id':membership_id})
    if not current: return
    lock_owner=await billing_owner_id(db,current['id'])
    lock=await acquire(db,lock_owner)
    try:
        member=await api('GET','/memberships/'+membership_id)
        if provider_company(member) != os.environ.get('WHOP_COMPANY_ID'): raise HTTPException(400,'Organisation Whop incorrecte.')
        plan_id=identifier(member.get('plan'))
        offer=next((v for v in CATALOG.values() if v['plan_id']==plan_id),None)
        active=member.get('status')=='active' and bool(offer) and current.get('subscription_status') != 'refunded'
        tier=current.get('subscription_tier','pro')
        changed_to_new_catalog = False
        if active and RANK[offer['tier']] < RANK.get(tier,0):
            grandfathered = (tier == 'team' and current.get('billing_catalog_version') != 2
                             and plan_id in START_PLAN_IDS and current.get('whop_plan_id') == plan_id)
            if not grandfathered:
                tier=offer['tier']
                changed_to_new_catalog = plan_id != current.get('whop_plan_id')
        await accounts(db).update_one({'id':current['id'],'whop_membership_id':membership_id},{'$set':{'plan':'pro' if active else 'free','subscription_tier':tier,'subscription_status':member.get('status'),'whop_plan_id':plan_id,**({'billing_catalog_version':2} if changed_to_new_catalog else {})}, **({'$unset':{'whop_membership_id':''}} if member.get('status') in ('expired','canceled','cancelled') else {})})
    finally: await release(db,lock_owner,lock)

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
    if provider_company(member) != os.environ.get('WHOP_COMPANY_ID'): raise HTTPException(400,'Abonnement Whop incorrect.')
    url=member.get('manage_url','')
    parsed=urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ('whop.com','www.whop.com'): raise HTTPException(502,'Portail Whop indisponible.')
    return {'url':url}

async def refund_payment(db,payment_id):
    if not re.fullmatch(r'pay_[A-Za-z0-9]+',payment_id): return
    payment=await api('GET','/payments/'+payment_id)
    if provider_company(payment) != os.environ.get('WHOP_COMPANY_ID'): return
    if cents(payment.get('refunded_amount',0)) < cents(payment.get('total',payment.get('subtotal'))) or cents(payment.get('refunded_amount',0)) <= 0: return
    current=await accounts(db).find_one({'whop_last_payment_id':payment_id})
    if not current: return
    lock_owner=await billing_owner_id(db,current['id'])
    lock=await acquire(db,lock_owner)
    try:
        await accounts(db).update_one({'id':current['id'],'whop_last_payment_id':payment_id},{'$set':{'plan':'free','subscription_status':'refunded','whop_refunded_payment_id':payment_id}})
    finally: await release(db,lock_owner,lock)


async def track_subscription(db, record, payment, membership_id, owner_id):
    """One consented acquisition event per checkout, after verified entitlement only."""
    if not record or not (record.get('tracking') or {}).get('consent'): return
    try:
        saved=await db.whop_checkouts.find_one({'_id':record['_id']})
        if not saved or saved.get('meta_subscribe_sent_at') or not saved.get('fulfilled'): return
        owner=await db.users.find_one({'id':owner_id}) or {}
        tracking=record['tracking']
        sent=await send_meta_event(event_name='Subscribe', event_id='subscribe_'+membership_id,
            event_source_url=(os.environ.get('FRONTEND_URL') or 'https://www.shiftflow.io').rstrip('/')+'/pricing',
            email=owner.get('email'),phone=owner.get('phone'),external_id=owner_id,
            client_user_agent=tracking.get('user_agent'),client_ip_address=tracking.get('ip'),
            fbp=tracking.get('fbp'),fbc=tracking.get('fbc'),subscription_id=membership_id,
            custom_data={'currency':'EUR','value':cents(payment.get('subtotal'))/100})
        if sent: await db.whop_checkouts.update_one({'_id':record['_id']},{'$set':{'meta_subscribe_sent_at':time.time()}})
    except Exception:
        # Payment activation succeeds even if attribution is unavailable.
        pass


async def track_checkout(db, reference, owner_id, offer):
    try:
        record=await db.whop_checkouts.find_one({'_id':reference})
        tracking=(record or {}).get('tracking') or {}
        if not tracking.get('consent') or record.get('meta_checkout_sent_at'): return
        owner=await db.users.find_one({'id':owner_id}) or {}
        sent=await send_meta_event(event_name='InitiateCheckout',event_id='checkout_'+reference,
            event_source_url=(os.environ.get('FRONTEND_URL') or 'https://www.shiftflow.io').rstrip('/')+'/pricing',
            email=owner.get('email'),phone=owner.get('phone'),external_id=owner_id,
            client_user_agent=tracking.get('user_agent'),client_ip_address=tracking.get('ip'),
            fbp=tracking.get('fbp'),fbc=tracking.get('fbc'),
            custom_data={'currency':'EUR','value':offer['amount']/100})
        if sent: await db.whop_checkouts.update_one({'_id':reference},{'$set':{'meta_checkout_sent_at':time.time()}})
    except Exception:
        pass


# Self-service lifecycle changes never run a second checkout, and never grant access
# from a user-provided plan or status. Whop remains the billing source of truth.
def _membership_id(current):
    membership_id = current.get('whop_membership_id')
    if not isinstance(membership_id, str) or not re.fullmatch(r'mem_[A-Za-z0-9]+', membership_id):
        raise HTTPException(404, 'Aucun abonnement Whop à gérer.')
    if current.get('billing_legacy_multiple'):
        raise HTTPException(409, 'Plusieurs abonnements historiques couvrent ce compte. Contactez le support pour les modifier sans interruption.')
    return membership_id


async def owned_membership(db, user):
    current = await accounts(db).find_one({'id': user['id']})
    if not current:
        raise HTTPException(404, 'Compte introuvable.')
    membership_id = _membership_id(current)
    member = await api('GET', '/memberships/' + membership_id)
    if (member.get('id') != membership_id or
            provider_company(member) != os.environ.get('WHOP_COMPANY_ID')):
        raise HTTPException(502, 'Impossible de vérifier cet abonnement auprès de Whop.')
    return current, member


def _renewal_date(member):
    raw = member.get('renewal_period_end')
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        parsed = datetime.fromisoformat(raw.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            return None
        return parsed.isoformat()
    except ValueError:
        return None


def _manage_link(member):
    value = member.get('manage_url')
    if not isinstance(value, str): return None
    parsed = urlparse(value)
    if parsed.scheme == 'https' and parsed.hostname in ('whop.com', 'www.whop.com') and not parsed.username and not parsed.password:
        return value
    return None


def subscription_details(current, member):
    scheduled = member.get('cancel_at_period_end') is True
    status = str(member.get('status') or current.get('subscription_status') or 'unknown')
    date = _renewal_date(member)
    return {
        'provider': 'whop',
        'tier': current.get('subscription_tier'),
        'status': status,
        'cancel_at_period_end': scheduled,
        'period_end': date,
        'billing_interval': 'yearly' if identifier(member.get('plan')) in {v['plan_id'] for v in CATALOG.values() if v['days'] == 365}
              else 'monthly' if identifier(member.get('plan')) in {v['plan_id'] for v in CATALOG.values() if v['days'] == 30}
              else None,
        'manage_available': bool(_manage_link(member)),
        'can_cancel': status == 'active' and not scheduled,
        'can_resume': status == 'active' and scheduled,
        'multiple_subscriptions': current.get('billing_legacy_multiple', False),
    }


async def subscription(db, user):
    current, member = await owned_membership(db, user)
    return subscription_details(current, member)


async def cancel_at_period_end(db, user):
    current, member = await owned_membership(db, user)
    if member.get('status') != 'active':
        raise HTTPException(409, 'Cet abonnement ne peut pas être résilié depuis ShiftFlow dans son état actuel.')
    if not member.get('cancel_at_period_end'):
        membership_id = _membership_id(current)
        # Explicit mode avoids accidentally canceling immediately.
        await api('POST', '/memberships/' + membership_id + '/cancel', {'cancellation_mode': 'at_period_end'})
        member = await api('GET', '/memberships/' + membership_id)
        if (member.get('id') != membership_id or
                provider_company(member) != os.environ.get('WHOP_COMPANY_ID') or
                member.get('cancel_at_period_end') is not True):
            raise HTTPException(502, 'Whop n’a pas encore confirmé la résiliation. Vérifiez votre abonnement avant de réessayer.')
    return subscription_details(current, member)


async def undo_cancellation(db, user):
    current, member = await owned_membership(db, user)
    if member.get('status') != 'active':
        raise HTTPException(409, 'Cet abonnement n’est plus actif. Contactez le support pour le réactiver.')
    if member.get('cancel_at_period_end') is True:
        membership_id = _membership_id(current)
        await api('POST', '/memberships/' + membership_id + '/uncancel')
        member = await api('GET', '/memberships/' + membership_id)
        if (member.get('id') != membership_id or
                provider_company(member) != os.environ.get('WHOP_COMPANY_ID') or
                member.get('cancel_at_period_end') is not False):
            raise HTTPException(502, 'Whop n’a pas encore confirmé la reprise. Vérifiez votre abonnement avant de réessayer.')
    return subscription_details(current, member)
