"""Business accounts are separate from login identities; legacy agencies stay in users."""
class AccountCursor:
    def __init__(self, db, query, projection):
        self.cursors = [db.users.find(query, projection)]
        if getattr(db, "organization_accounts", None) is not None: self.cursors.append(db.organization_accounts.find(query, projection))
    async def to_list(self, length=None):
        rows = []
        for cursor in self.cursors:
            rows.extend(await cursor.to_list(length))
        return rows if length is None else rows[:length]

class Accounts:
    def __init__(self, db): self.db = db
    def collection(self, identifier):
        return self.db.organization_accounts if isinstance(identifier, str) and identifier.startswith('org_') else self.db.users
    async def find_one(self, query, projection=None, **kwargs):
        identifier = query.get('id')
        if isinstance(identifier, str):
            return await self.collection(identifier).find_one(query, projection, **kwargs)
        legacy = await self.db.users.find_one(query, projection, **kwargs)
        if legacy or getattr(self.db, "organization_accounts", None) is None: return legacy
        return await self.db.organization_accounts.find_one(query, projection, **kwargs)
    async def update_one(self, query, update, **kwargs):
        identifier = query.get('id')
        if isinstance(identifier, str):
            return await self.collection(identifier).update_one(query, update, **kwargs)
        collection = self.db.users
        if not await self.db.users.find_one(query) and getattr(self.db, "organization_accounts", None) is not None and await self.db.organization_accounts.find_one(query): collection = self.db.organization_accounts
        return await collection.update_one(query, update, **kwargs)
    def find(self, query, projection=None): return AccountCursor(self.db, query, projection)

def accounts(db): return Accounts(db)
