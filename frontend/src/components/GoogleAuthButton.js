import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, markLoggedOut, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

let googleScript;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleScript) googleScript = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = resolve;
    script.onerror = () => { googleScript = null; reject(new Error("Google est indisponible. Rechargez la page pour réessayer.")); };
    document.head.appendChild(script);
  });
  return googleScript;
}

export default function GoogleAuthButton({ registration, acceptedTerms, legalVersion, onSuccess, onCredential }) {
  const container = useRef(null);
  const current = useRef({ registration, acceptedTerms, legalVersion, onSuccess, onCredential });
  current.current = { registration, acceptedTerms, legalVersion, onSuccess, onCredential };
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    const setup = async () => {
      try {
        const { data } = await api.get("/auth/google/config");
        if (!active || !data.enabled) return;
        await loadGoogle();
        if (!active) return;
        window.google.accounts.id.initialize({
          client_id: data.client_id, nonce: data.nonce, auto_select: false,
          callback: async ({ credential }) => {
            if (inFlight.current || !active) return;
            const values = current.current;
            if (values.onCredential) { values.onCredential(credential); return; }
            if (values.registration && !values.acceptedTerms) {
              setError("Acceptez les conditions pour vous inscrire avec Google.");
              return;
            }
            inFlight.current = true;
            setBusy(true); setError("");
            try {
              markLoggedOut(false);
              const result = await api.post("/auth/google", {
                credential, registration: values.registration,
                legal_version: values.registration ? values.legalVersion : undefined,
              });
              if (values.registration) {
                try { localStorage.setItem(`shiftflow-welcome-${result.data.user.id}`, "pending"); } catch {}
              }
              values.onSuccess?.();
              await refresh();
              navigate("/app/dashboard");
            } catch (err) {
              setError(formatApiError(err.response?.data?.detail) || "La connexion Google a échoué.");
              await setup();
            } finally { inFlight.current = false; setBusy(false); }
          },
        });
        container.current.replaceChildren();
        window.google.accounts.id.renderButton(container.current, {
          type: "standard", theme: "outline", size: "large", text: "continue_with", locale: "fr", width: 300,
        });
      } catch { if (active) setError("La connexion Google est indisponible. Vous pouvez utiliser votre email et un mot de passe."); }
    };
    setup();
    return () => { active = false; };
  }, [navigate, refresh]);
  return <div className="mt-5">
    <div ref={container} className={`flex justify-center ${busy ? "pointer-events-none opacity-50" : ""}`} aria-busy={busy} />
    {busy && <p className="mt-2 text-sm text-gray-500" role="status">Connexion Google…</p>}
    {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
  </div>;
}
