// Mirrors the server's operational manager permission; billing is always owner-only.
export function canManageOperations(user) {
  const role = user?.organization?.role;
  if (!role || role === "owner") return true;
  if (role === "admin" && user?.subscription_tier !== "business") return false;
  return user?.subscription_tier !== "business" || role === "admin";
}
