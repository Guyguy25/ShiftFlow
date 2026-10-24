"""Tenant data stays local; subscription entitlements follow the workspace owner."""
BILLING_FIELDS = ('plan', 'subscription_tier', 'subscription_status', 'payment_provider',
                  'whop_membership_id', 'whop_plan_id', 'whop_last_payment_id',
                  'whop_last_payment_at', 'whop_refunded_payment_id',
                  'stripe_subscription_id', 'stripe_customer_id')


def collection(db, identifier):
    return db.organization_accounts if isinstance(identifier, str) and identifier.startswith('org_') else db.users


async def billing_owner_id(db, identifier):
    org = await db.organizations.find_one({'_id': identifier}, {'owner_id': 1})
    if org: return org['owner_id']
    raw = await collection(db, identifier).find_one({'id': identifier})
    return (raw or {}).get('owner_id') or (raw or {}).get('free_pool_id') or identifier


async def billing_source(db, identifier):
    """Resolve existing subscriptions without copying credentials or migrating charges.

    New subscriptions live on the login owner. Legacy organization subscriptions
    remain on their original document so Stripe/Whop lifecycle events still match.
    """
    owner_id = await billing_owner_id(db, identifier)
    personal = await db.users.find_one({'id': owner_id})
    orgs = await db.organizations.find({'owner_id': owner_id}, {'id': 1}).to_list(None)
    ids = [o['id'] for o in orgs if o['id'] != owner_id]
    candidates = ([personal] if personal else []) + await db.organization_accounts.find(
        {'$or': [{'owner_id': owner_id}, {'free_pool_id': owner_id}, {'id': {'$in': ids}}]}).sort('id', 1).to_list(None)
    paid = [c for c in candidates if c.get('plan') == 'pro']
    if paid:
        selected = dict(max(paid, key=lambda c: {'pro':0,'team':1,'business':2}.get(c.get('subscription_tier','pro'),0)))
        # Preserve separately purchased legacy capacity until billing consolidation.
        selected['_shared_capacity'] = sum(15 if c.get('subscription_tier') == 'business' else 5 if c.get('subscription_tier') == 'team' else 0 for c in paid)
        selected['_multiple_subscriptions'] = len(paid) > 1
        return owner_id, selected
    for candidate in candidates:
        if any(candidate.get(k) for k in ('whop_membership_id', 'stripe_subscription_id', 'payment_provider', 'whop_last_payment_id')):
            return owner_id, candidate
    return owner_id, personal or await collection(db, identifier).find_one({'id': identifier})


async def effective_account(db, raw):
    if not raw or not raw.get('id') or getattr(db, 'organizations', None) is None: return raw
    owner_id, source = await billing_source(db, raw['id'])
    if not source: return raw
    result = {k: v for k, v in raw.items() if k not in BILLING_FIELDS}
    result.update({k: source[k] for k in BILLING_FIELDS if k in source})
    result.update(billing_owner_id=owner_id, billing_account_id=source['id'],
                  billing_collaborator_limit=source.get('_shared_capacity',0),
                  billing_legacy_multiple=source.get('_multiple_subscriptions',False))
    return result


def project(row, projection):
    if not row or not projection: return row
    included = {k for k, v in projection.items() if v and k != '_id'}
    if included:
        return {k: v for k, v in row.items() if k in included or (k == '_id' and projection.get('_id', 1))}
    return {k: v for k, v in row.items() if projection.get(k, 1)}


class AccountCursor:
    def __init__(self, db, query, projection):
        self.db, self.projection = db, projection
        self.cursors = [db.users.find(query)]
        if getattr(db, 'organization_accounts', None) is not None: self.cursors.append(db.organization_accounts.find(query))
    async def to_list(self, length=None):
        rows = []
        for cursor in self.cursors:
            for row in await cursor.to_list(length):
                rows.append(project(await effective_account(self.db, row), self.projection))
        return rows if length is None else rows[:length]


class Accounts:
    def __init__(self, db): self.db = db
    def collection(self, identifier): return collection(self.db, identifier)
    async def find_one(self, query, projection=None, **kwargs):
        identifier = query.get('id')
        if isinstance(identifier, str):
            raw = await self.collection(identifier).find_one(query, **kwargs)
            return project(await effective_account(self.db, raw), projection)
        # Provider identifier lookups must return the original billing document.
        legacy = await self.db.users.find_one(query, projection, **kwargs)
        if legacy or getattr(self.db, 'organization_accounts', None) is None: return legacy
        return await self.db.organization_accounts.find_one(query, projection, **kwargs)
    async def update_one(self, query, update, **kwargs):
        identifier = query.get('id')
        if isinstance(identifier, str): return await self.collection(identifier).update_one(query, update, **kwargs)
        target = self.db.users
        if not await self.db.users.find_one(query) and getattr(self.db, 'organization_accounts', None) is not None and await self.db.organization_accounts.find_one(query): target = self.db.organization_accounts
        return await target.update_one(query, update, **kwargs)
    def find(self, query, projection=None): return AccountCursor(self.db, query, projection)


def accounts(db): return Accounts(db)
