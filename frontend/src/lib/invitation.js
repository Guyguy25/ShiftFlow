export const INVITATION_KEY = "shiftflow_pending_invitation";
export function pendingInvitation() { try { return sessionStorage.getItem(INVITATION_KEY) || ""; } catch { return ""; } }
export function clearInvitation() { try { sessionStorage.removeItem(INVITATION_KEY); } catch {} }
