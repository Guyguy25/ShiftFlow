// Display hint only: never use this value to authorize access or restore a user.
const SESSION_HINT_KEY = "shiftflow-session-known";
export function hasSessionHint() {
  try { return localStorage.getItem(SESSION_HINT_KEY) === "1"; } catch { return false; }
}
export function saveSessionHint(connected) {
  try {
    if (connected) localStorage.setItem(SESSION_HINT_KEY, "1");
    else localStorage.removeItem(SESSION_HINT_KEY);
  } catch { /* Storage may be unavailable in private browsing. */ }
}
