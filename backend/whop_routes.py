from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
import server as s
import whop_billing as billing
from workspace_accounts import accounts
router=APIRouter(prefix='/whop',tags=['Whop'])
class CheckoutIn(BaseModel):
    offer_key:str
    legal_version:str
    meta_consent:bool=False
    meta_fbp:str=Field(default='',max_length=250)
    meta_fbc:str=Field(default='',max_length=500)
class StatusIn(BaseModel):
    reference:str=Field(min_length=20,max_length=100)
    payment_id:str=''

@router.get('/config')
async def config(response:Response):
    response.headers['Cache-Control']='no-store'
    return {'provider':'whop','ready':billing.ready(),'offers':billing.CATALOG}

@router.post('/checkout')
async def checkout(payload:CheckoutIn,request:Request,user=Depends(s.get_workspace_owner)):
    if payload.legal_version!='2026-10-24': raise HTTPException(400,'Acceptez les conditions actuelles.')
    return await billing.checkout(s.db,user,payload.offer_key,tracking={
        'consent':payload.meta_consent,'fbp':payload.meta_fbp if payload.meta_consent else '',
        'fbc':payload.meta_fbc if payload.meta_consent else '',
        'user_agent':request.headers.get('user-agent') if payload.meta_consent else None,
        'ip':s.request_client_ip(request) if payload.meta_consent else None})

@router.post('/status')
async def status(payload:StatusIn,user=Depends(s.get_workspace_owner)):
    record=await s.db.whop_checkouts.find_one({'_id':payload.reference,'organization_id':user['id']})
    if not record: raise HTTPException(404,'Paiement introuvable.')
    if payload.payment_id: await billing.fulfill_payment(s.db,payload.payment_id,expected_org=user['id'])
    record=await s.db.whop_checkouts.find_one({'_id':payload.reference,'organization_id':user['id']})
    current=await accounts(s.db).find_one({'id':user['id']})
    active=current and current.get('plan')=='pro' and current.get('whop_membership_id')==record.get('membership_id')
    return {'status': ('paid' if active else 'inactive') if record.get('fulfilled') else 'pending'}

@router.post('/portal')
async def portal(user=Depends(s.get_workspace_owner)): return await billing.portal(s.db,user)

@router.post('/webhook')
async def webhook(request:Request):
    raw=await request.body()
    if len(raw)>2*1024*1024: raise HTTPException(413,'Événement trop volumineux.')
    event,event_id=billing.verify_webhook(raw,request.headers)
    if await s.db.whop_events.find_one({'_id':event_id,'processed':True}): return {'ok':True}
    kind=event.get('type','');data=event.get('data') or {}
    if kind in ('payment.succeeded','payment.refunded','payment.failed'):
        if kind=='payment.succeeded': await billing.fulfill_payment(s.db,data.get('id',''))
        elif kind=='payment.refunded': await billing.refund_payment(s.db,data.get('id',''))
        else:
            member=billing.identifier(data.get('membership'))
            if member: await billing.sync_membership(s.db,member)
    elif kind in ('refund.created','refund.updated'):
        payment_id=billing.identifier(data.get('payment'))
        if payment_id: await billing.refund_payment(s.db,payment_id)
    elif kind.startswith('membership.'):
        await billing.sync_membership(s.db,data.get('id',''))
    await s.db.whop_events.update_one({'_id':event_id},{'$set':{'processed':True}},upsert=True)
    return {'ok':True}
