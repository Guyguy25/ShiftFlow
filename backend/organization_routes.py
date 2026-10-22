from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, EmailStr, field_validator
import server as s
import organizations as orgs
from profile_data import validate_avatar

router = APIRouter(prefix='/organization', tags=['Organisation'])


class OrganizationIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    avatar: str = ''

    @field_validator('name')
    @classmethod
    def trim_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError('Indiquez le nom de votre organisation.')
        return value

    @field_validator('avatar')
    @classmethod
    def avatar_is_image(cls, value):
        return validate_avatar(value)


class InviteIn(BaseModel):
    email: EmailStr


class TokenIn(BaseModel):
    token: str = Field(min_length=32, max_length=100)


class SwitchIn(BaseModel):
    organization_id: str = Field(min_length=1, max_length=100)


async def organization_user(request: Request, user=Depends(s.get_current_user)):
    expected = request.headers.get('X-Organization-ID')
    if expected:
        org, _, _ = await orgs.context(s.db, user)
        if expected != org['id']:
            raise HTTPException(409, 'Votre organisation active a changé. Rechargez la page avant de continuer.')
    return user


@router.get('')
async def current(user=Depends(organization_user)):
    return await orgs.summary(s.db, user)


@router.post('')
async def create(payload: OrganizationIn, user=Depends(s.get_current_user)):
    return await orgs.create_personal(s.db, user, payload.name)


@router.put('')
async def update(payload: OrganizationIn, user=Depends(organization_user)):
    org, _, role = await orgs.context(s.db, user)
    if role != 'owner':
        raise HTTPException(403, 'Seul le propriétaire peut modifier l’organisation.')
    await s.db.organizations.update_one({'_id': org['id']}, {'$set': payload.model_dump()})
    # Preserve legacy message templates, public mission pages and the WhatsApp service.
    await s.db.users.update_one({'id': org['owner_id']}, {'$set': {'agency_name': payload.name}})
    return await orgs.summary(s.db, user)


@router.post('/switch')
async def switch(payload: SwitchIn, user=Depends(s.get_current_user)):
    await orgs.ensure_personal(s.db, user)
    org = await s.db.organizations.find_one({'_id': payload.organization_id, 'members.user_id': user['id']})
    if not org:
        raise HTTPException(403, 'Vous n’avez pas accès à cette organisation.')
    await s.db.users.update_one({'id': user['id']}, {'$set': {'active_organization_id': org['id']}})
    return {'ok': True}


@router.post('/invitations')
async def invite(payload: InviteIn, user=Depends(organization_user)):
    return await orgs.invite(s.db, user, str(payload.email), s.FRONTEND_URL or 'https://www.shiftflow.io')


@router.delete('/invitations/{invitation_id}')
async def revoke(invitation_id: str, user=Depends(organization_user)):
    org, _, role = await orgs.context(s.db, user)
    if role != 'owner':
        raise HTTPException(403, 'Seul le propriétaire peut révoquer une invitation.')
    await s.db.organizations.update_one({'_id': org['id']}, {'$pull': {'invitations': {'id': invitation_id}}})
    return {'ok': True}


@router.delete('/members/{member_id}')
async def remove(member_id: str, user=Depends(organization_user)):
    org, _, role = await orgs.context(s.db, user)
    if role != 'owner':
        raise HTTPException(403, 'Seul le propriétaire peut retirer un membre.')
    if member_id == org['owner_id']:
        raise HTTPException(400, 'Le propriétaire ne peut pas être retiré.')
    await s.db.organizations.update_one({'_id': org['id']}, {'$pull': {'members': {'user_id': member_id}}})
    # Membership is checked again on every request; sessions never preserve revoked access.
    return {'ok': True}


@router.post('/invitation-info')
async def invitation_info(payload: TokenIn):
    org, invitation = await orgs.invitation_info(s.db, payload.token)
    email = invitation['email']
    return {'name': org['name'], 'email_hint': email[:1] + '…@' + email.split('@')[-1], 'expires_at': invitation['expires_at']}


@router.post('/accept-invitation')
async def accept(payload: TokenIn, user=Depends(s.get_current_user)):
    return await orgs.accept(s.db, user, payload.token)
