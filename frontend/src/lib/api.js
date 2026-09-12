import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// --- Session persistante ---
// Le access_token expire au bout de 24h. Plutôt que de déconnecter l'utilisateur
// à ce moment-là, on tente une fois un rafraîchissement silencieux via le
// refresh_token (cookie longue durée, 90 jours) avant de considérer que la
// session est vraiment terminée. C'est ce qui évite de redemander une connexion
// à chaque retour sur le site.
let refreshPromise = null;
let justLoggedOut = false; // sécurité : après un logout explicite, on ne tente plus jamais un refresh silencieux
const AUTH_ROUTES_NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

export function markLoggedOut(value) {
  justLoggedOut = value;
}

function refreshSession() {
  if (justLoggedOut) {
    return Promise.reject(new Error("Logged out — refresh disabled"));
  }
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API}/auth/refresh`, {}, { withCredentials: true })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const isUnauthorized = response && response.status === 401;
    const alreadyRetried = config?._retriedAfterRefresh;
    const isAuthRoute = AUTH_ROUTES_NO_REFRESH.some((path) => config?.url?.includes(path));

    if (!isUnauthorized || alreadyRetried || isAuthRoute || !config) {
      return Promise.reject(error);
    }

    try {
      await refreshSession();
      config._retriedAfterRefresh = true;
      return api(config);
    } catch (refreshError) {
      return Promise.reject(error);
    }
  }
);

export function formatApiError(detail) {
  if (detail == null) return "Une erreur s'est produite. Veuillez réessayer.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}