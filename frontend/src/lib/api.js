import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// --- Protection anti-double-clic pour l'actualisation WhatsApp ---
// Cette garde est volontairement au niveau HTTP : même si React n'a pas encore
// rerendu le bouton, plusieurs clics rapides ne peuvent pas déclencher plusieurs
// POST /whatsapp/refresh vers le backend.
const WHATSAPP_REFRESH_COOLDOWN_MS = 60 * 1000;
let whatsappRefreshUntil = 0;
let whatsappRefreshInFlight = false;
let whatsappRefreshTimer = null;

function getWhatsAppRefreshButtons() {
  if (typeof document === "undefined") return [];
  return Array.from(document.querySelectorAll("button")).filter((button) => {
    const label = (button.textContent || "").trim().toLowerCase();
    return label.startsWith("actualiser");
  });
}

function paintWhatsAppRefreshButtons(disabled) {
  getWhatsAppRefreshButtons().forEach((button) => {
    button.disabled = disabled;
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
    button.style.pointerEvents = disabled ? "none" : "";
    button.style.opacity = disabled ? "0.55" : "";
    button.style.cursor = disabled ? "not-allowed" : "";
  });
}

function scheduleWhatsAppRefreshUnlock() {
  if (whatsappRefreshTimer) clearInterval(whatsappRefreshTimer);
  whatsappRefreshTimer = setInterval(() => {
    if (Date.now() >= whatsappRefreshUntil && !whatsappRefreshInFlight) {
      clearInterval(whatsappRefreshTimer);
      whatsappRefreshTimer = null;
      paintWhatsAppRefreshButtons(false);
    } else {
      paintWhatsAppRefreshButtons(true);
    }
  }, 250);
}

api.interceptors.request.use((config) => {
  const url = String(config?.url || "");
  if (!url.includes("/whatsapp/refresh")) return config;

  const now = Date.now();
  if (whatsappRefreshInFlight || now < whatsappRefreshUntil) {
    paintWhatsAppRefreshButtons(true);
    return Promise.reject(new axios.Cancel("Actualisation WhatsApp déjà en cours ou en cooldown."));
  }

  whatsappRefreshInFlight = true;
  whatsappRefreshUntil = now + WHATSAPP_REFRESH_COOLDOWN_MS;
  paintWhatsAppRefreshButtons(true);
  scheduleWhatsAppRefreshUnlock();
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (String(response?.config?.url || "").includes("/whatsapp/refresh")) {
      whatsappRefreshInFlight = false;
      paintWhatsAppRefreshButtons(Date.now() < whatsappRefreshUntil);
    }
    return response;
  },
  async (error) => {
    const { config, response } = error;
    const isWhatsAppRefresh = String(config?.url || "").includes("/whatsapp/refresh");
    if (isWhatsAppRefresh) {
      whatsappRefreshInFlight = false;
      paintWhatsAppRefreshButtons(Date.now() < whatsappRefreshUntil);
    }

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
