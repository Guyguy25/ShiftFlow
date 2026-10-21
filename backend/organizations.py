"""Workspace membership. Legacy agency IDs remain owner IDs; identities never change."""
import hashlib
import html
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

MAX_COLLABORATORS = 5
MAX_MEMBERS = MAX_COLLABORATORS + 1


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def is_team(owner):
    return owner.get('plan') == 'pro' and owner.get('subscription_tier') == 'team'


async def ensure_personal(db, user):
    # One deterministic document per existing account: no bulk re-keying of mission data.
    await db.organizations.update_one({'_id': user['id']}, {'$setOnInsert': {
        'id': user['id'], 'owner_id': user['id'],
        'name': ((user.get('agency_name') or '').strip() or 'Mon organisation'), 'avatar': '',
        'members': [{'user_id': user['id'], 'role': 'owner', 'joined_at': now()}],
        'invitations': [], 'created_at': now(),
    }}, upsert=True)


async def context(db, user):
    await ensure_personal(db, user)
    org_id = user.get('active_organization_id') or user['id']
    org = await db.organizations.find_one({'_id': org_id, 'members.user_id': user['id']})
    if not org:
        org_id = user['id']
        org = await db.organizations.find_one({'_id': org_id})
        await db.users.update_one({'id': user['id']}, {'$set': {'active_organization_id': org_id}})
    owner = user if org['owner_id'] == user['id'] else await db.users.find_one({'id': org['owner_id']})
    if not owner:
        raise HTTPException(403, 'Cette organisation est indisponible.')
    role = 'owner' if org['owner_id'] == user['id'] else 'member'
    return org, owner, role


async def decorate(db, user):
    org, owner, role = await context(db, user)
    return {**user, 'plan': owner.get('plan', 'free'), 'agency_name': org['name'],
            'subscription_status': owner.get('subscription_status'),
            'subscription_tier': owner.get('subscription_tier', 'pro'),
            'organization': {'id': org['id'], 'name': org['name'], 'avatar': org.get('avatar', ''),
                             'role': role, 'team_enabled': is_team(owner),
                             'locked': role != 'owner' and not is_team(owner)},
            'can_manage_billing': role == 'owner'}


async def workspace(db, user, owner_only=False):
    org, owner, role = await context(db, user)
    if owner_only and role != 'owner':
        raise HTTPException(403, 'Seul le propriétaire peut gérer cette organisation et sa facturation.')
    if role != 'owner' and not is_team(owner):
        raise HTTPException(403, 'L’accès collaborateur nécessite un abonnement Pro Team actif. Vous pouvez revenir à votre espace personnel.')
    # Business routes keep their agency-scoped queries. actor_id is never used as the tenant key.
    return {**{key: value for key, value in owner.items() if key != 'password_hash'}, 'id': org['owner_id'], 'actor_id': user['id'],
            'organization_id': org['id'], 'organization_role': role,
            'agency_name': org['name'], 'role': 'admin' if role != 'owner' else owner.get('role', 'admin')}


async def list_spaces(db, user):
    await ensure_personal(db, user)
    rows = await db.organizations.find({'members.user_id': user['id']}).to_list(100)
    return [{'id': row['id'], 'name': row['name'], 'avatar': row.get('avatar', ''),
             'role': 'owner' if row['owner_id'] == user['id'] else 'member'} for row in rows]


async def summary(db, user):
    org, owner, role = await context(db, user)
    current = now()
    users = await db.users.find({'id': {'$in': [m['user_id'] for m in org['members']]}},
                               {'_id': 0, 'id': 1, 'name': 1, 'email': 1, 'avatar': 1}).to_list(MAX_MEMBERS)
    members = [{**u, 'role': 'owner' if u['id'] == org['owner_id'] else 'member'} for u in users]
    pending = [{k: inv[k] for k in ('id', 'email', 'expires_at')} for inv in org.get('invitations', []) if inv['expires_at'] > current] if role == 'owner' else []
    return {'id': org['id'], 'name': org['name'], 'avatar': org.get('avatar', ''), 'role': role,
            'team_enabled': is_team(owner), 'max_collaborators': MAX_COLLABORATORS,
            'members': members, 'invitations': pending,
            'spaces': await list_spaces(db, user)}


async def invite(db, user, email, origin):
    org, owner, role = await context(db, user)
    if role != 'owner':
        raise HTTPException(403, 'Seul le propriétaire peut inviter des collaborateurs.')
    if not is_team(owner):
        raise HTTPException(403, 'Passez à Pro Team pour inviter jusqu’à 5 collaborateurs.')
    email = email.strip().lower()
    account = await db.users.find_one({'email': email})
    if account and any(m['user_id'] == account['id'] for m in org['members']):
        raise HTTPException(409, 'Cette personne fait déjà partie de l’organisation.')
    stamp = now()
    await db.organizations.update_one({'_id': org['id']}, {'$pull': {'invitations': {'expires_at': {'$lte': stamp}}}})
    token = secrets.token_urlsafe(32)
    invitation = {'id': secrets.token_hex(16), 'email': email, 'token_hash': digest(token),
                  'expires_at': (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(), 'created_at': stamp}
    # Pending invitations reserve seats. The single document update enforces the cap under concurrency.
    result = await db.organizations.update_one({
        '_id': org['id'], 'invitations.email': {'$ne': email},
        'members.user_id': {'$ne': account['id']} if account else {'$exists': True},
        '$expr': {'$lt': [{'$add': [{'$size': '$members'}, {'$size': '$invitations'}]}, MAX_MEMBERS]},
    }, {'$push': {'invitations': invitation}})
    if not result.modified_count:
        raise HTTPException(409, 'Une invitation existe déjà ou les 5 places collaborateurs sont occupées (invitations en attente comprises).')
    url = f"{origin.rstrip('/')}/invite#token={token}"
    delivered = await deliver_invite(email, org['name'], url, invitation['id'])
    return {'id': invitation['id'], 'email': email, 'url': url, 'expires_at': invitation['expires_at'], 'email_sent': delivered}


async def deliver_invite(email, name, url, invitation_id):
    key = os.environ.get('RESEND_API_KEY', '').strip()
    sender = (os.environ.get('TEAM_EMAIL_FROM') or os.environ.get('ONBOARDING_EMAIL_FROM') or '').strip()
    if not key or not sender:
        return False
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post('https://api.resend.com/emails', headers={
                'Authorization': f'Bearer {key}', 'Idempotency-Key': f'shiftflow-team-{invitation_id}',
            }, json={'from': sender, 'to': [email], 'subject': f'Rejoignez {name} sur ShiftFlow',
                     'text': f'Vous êtes invité à rejoindre {name} sur ShiftFlow. Connectez-vous avec {email}, puis acceptez cette invitation valable 7 jours : {url}',
                     'html': f'<p>Vous êtes invité à rejoindre <strong>{html.escape(name)}</strong> sur ShiftFlow.</p><p><a href="{html.escape(url, quote=True)}">Rejoindre l’organisation</a></p><p>Invitation valable 7 jours. Utilisez votre compte {html.escape(email)}.</p>'})
            return response.is_success
    except httpx.HTTPError:
        return False  # The owner can copy the link; never claim an email was delivered.


async def invitation_info(db, token):
    if not 32 <= len(token) <= 100:
        raise HTTPException(404, 'Invitation introuvable ou expirée.')
    org = await db.organizations.find_one({'invitations': {'$elemMatch': {'token_hash': digest(token), 'expires_at': {'$gt': now()}}}})
    if not org:
        raise HTTPException(404, 'Invitation introuvable ou expirée.')
    inv = next(i for i in org['invitations'] if i['token_hash'] == digest(token))
    return org, inv


async def accept(db, user, token):
    org, inv = await invitation_info(db, token)
    if user['email'].strip().lower() != inv['email']:
        raise HTTPException(403, 'Connectez-vous avec l’adresse email qui a reçu cette invitation.')
    owner = await db.users.find_one({'id': org['owner_id']})
    if not owner or not is_team(owner):
        raise HTTPException(403, 'Cette organisation doit disposer de Pro Team pour accepter de nouveaux collaborateurs.')
    result = await db.organizations.update_one({
        '_id': org['id'], 'members.user_id': {'$ne': user['id']},
        'invitations': {'$elemMatch': {'token_hash': digest(token), 'email': user['email'].lower().strip(), 'expires_at': {'$gt': now()}}},
        '$expr': {'$lt': [{'$size': '$members'}, MAX_MEMBERS]},
    }, {'$pull': {'invitations': {'token_hash': digest(token)}},
        '$push': {'members': {'user_id': user['id'], 'role': 'member', 'joined_at': now()}}})
    if not result.modified_count:
        raise HTTPException(409, 'Cette invitation a déjà été utilisée ou révoquée.')
    await db.users.update_one({'id': user['id']}, {'$set': {'active_organization_id': org['id']}})
    return {'id': org['id'], 'name': org['name']}
