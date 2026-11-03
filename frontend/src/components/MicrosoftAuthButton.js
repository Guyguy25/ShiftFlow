import React, { useEffect, useState } from "react";
import { API, api } from "../lib/api";

// Logo Microsoft officiel (4 carrés), requis par les règles de marque pour un bouton de connexion.
const MicrosoftLogo = () => <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>;

/**
 * Bouton « Continuer avec Microsoft ». Redirige vers Microsoft ; au retour, la page
 * reçoit un jeton à usage unique dans l'URL (#microsoft=…), lu par readMicrosoftReturn().
 * mode : « login », « register » ou « invite ».
 */
export default function MicrosoftAuthButton({ mode = "login" }) {
  const [enabled, setEnabled] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => api.get("/auth/microsoft/config")).then(({ data }) => { if (live) setEnabled(Boolean(data?.enabled)); }).catch(() => {});
    return () => { live = false; };
  }, []);
  if (!enabled) return null;
  return <div className="mt-3 flex justify-center">
    <button type="button" disabled={leaving} data-testid="microsoft-auth-button"
      onClick={() => { setLeaving(true); window.location.assign(`${API}/auth/microsoft/start?mode=${mode}`); }}
      className="flex h-10 w-[300px] max-w-full items-center justify-center gap-3 rounded-[4px] border border-[#dadce0] bg-white px-3 text-sm font-medium text-[#3c4043] transition-colors hover:border-[#d2e3fc] hover:bg-[#f8faff] disabled:opacity-60">
      <MicrosoftLogo/>{leaving ? "Redirection vers Microsoft…" : "Continuer avec Microsoft"}
    </button>
  </div>;
}

/** Lit le retour Microsoft dans l'URL (#microsoft=… ou #microsoft_error=…), sans le modifier. */
export function readMicrosoftReturn() {
  if (typeof window === "undefined" || !window.location.hash) return {};
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.get("microsoft")) return { credential: params.get("microsoft") };
  if (params.get("microsoft_error")) return { error: params.get("microsoft_error") };
  return {};
}

/** Retire le jeton de l'URL (historique, partage, Referer). À appeler dans un effet. */
export function clearMicrosoftReturn() {
  if (!/(^#|&)microsoft(_error)?=/.test(window.location.hash)) return;
  try { window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search); } catch {}
}
