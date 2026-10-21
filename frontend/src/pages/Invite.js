import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export const INVITATION_KEY = "shiftflow_pending_invitation";
export default function Invite() {
  const { user, loading, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [token] = useState(() => {
    try { return new URLSearchParams(window.location.hash.slice(1)).get("token") || sessionStorage.getItem(INVITATION_KEY) || ""; } catch { return ""; }
  });
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    if (!token) { setError("Ouvrez le lien d’invitation transmis par votre organisation."); return undefined; }
    try { sessionStorage.setItem(INVITATION_KEY, token); window.history.replaceState(null, "", "/invite"); } catch {}
    api.post("/organization/invitation-info", { token }).then(({ data }) => { if (live) setInfo(data); }).catch(err => { if (live) setError(formatApiError(err.response?.data?.detail)); });
    return () => { live = false; };
  }, [token]);
  async function accept() {
    setBusy(true); setError("");
    try {
      await api.post("/organization/accept-invitation", { token });
      try { sessionStorage.removeItem(INVITATION_KEY); } catch {}
      await refresh(); navigate("/app/dashboard", { replace: true });
    } catch (err) { setError(formatApiError(err.response?.data?.detail)); setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5 py-12"><section className="w-full max-w-md rounded-2xl border bg-white p-7 shadow-sm">
    <Building2 className="h-9 w-9 text-blue-600"/><h1 className="mt-4 text-2xl font-bold">Rejoindre une organisation</h1>
    {info && <><p className="mt-3 text-gray-700">Vous êtes invité dans <strong>{info.name}</strong>.</p><p className="mt-2 text-sm text-gray-500">Utilisez le compte correspondant à {info.email_hint}. Vos missions et votre espace personnel seront conservés.</p></>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <p className="mt-5 text-sm text-gray-500">Vérification de votre compte…</p> : info && (user ? <><p className="mt-5 text-sm text-gray-600">Connecté : {user.email}</p><button disabled={busy} onClick={accept} className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Ouverture de l’espace…" : "Accepter l’invitation"}</button><button disabled={busy} onClick={async () => { await logout(); navigate("/login"); }} className="mt-4 text-sm text-blue-700 underline">Utiliser un autre compte</button></> : <div className="mt-6 grid gap-3"><Link to="/login" className="rounded-lg bg-blue-600 px-4 py-3 text-center font-semibold text-white">J’ai déjà un compte</Link><Link to="/register" className="rounded-lg border px-4 py-3 text-center font-semibold">Créer mon compte</Link></div>)}
    <Link to="/" className="mt-6 block text-center text-xs text-gray-500 underline">ShiftFlow</Link>
  </section></main>;
}
