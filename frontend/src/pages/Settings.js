import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Sparkles, Send, CheckCircle2, AlertCircle, Save, Zap, Crown, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "../lib/api";
import { toast, Toaster } from "sonner";

export default function Settings() {
  const { user, refresh } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [notifs, setNotifs] = useState([]);
  const [quota, setQuota] = useState(null);
  const [form, setForm] = useState({ name: "", agency_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    api.get("/config").then((r) => setCfg(r.data)).catch(() => {});
    api.get("/plan/quota").then((r) => setQuota(r.data)).catch(() => {});
    reloadNotifs();
  }, []);
  useEffect(() => {
    if (user) setForm({ name: user.name || "", agency_name: user.agency_name || "", phone: user.phone || "" });
  }, [user]);

  const reloadNotifs = () => api.get("/notifications/recent").then((r) => setNotifs(r.data)).catch(() => {});
  const set = (k, v) => setForm({ ...form, [k]: v });

  const saveProfile = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put("/auth/me", form);
      await refresh();
      toast.success("Profil mis à jour");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Erreur");
    } finally { setSaving(false); }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const { data } = await api.post("/notifications/test-sms", testTo ? { to: testTo } : {});
      if (data.success) toast.success(`SMS envoyé via ${data.channel} → ${data.to}`);
      else toast.error(data.error || `Échec (status ${data.status})`, { duration: 8000 });
      reloadNotifs();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Erreur d'envoi");
    } finally { setTesting(false); }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data } = await api.post("/payments/portal", {});
      window.location.href = data.url;
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Impossible d'ouvrir le portail");
      setPortalLoading(false);
    }
  };

  const inputCls = "mt-1 w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";
  const isPro = user?.plan === "pro";

  return (
    <div data-testid="settings-page">
      <Toaster position="top-right" richColors/>
      <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Paramètres</div>
      <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Compte & Agence</h1>

      <div className="mt-8 grid gap-6 max-w-3xl">
        {/* Subscription block */}
        <div className={`rounded-xl border p-6 ${isPro ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-700" : "bg-white border-gray-200"}`} data-testid="settings-subscription-block">
          <div className="flex items-center gap-2 font-semibold">
            <Crown className="w-5 h-5"/> Abonnement
            <span className={`ml-auto text-xs px-2 py-1 rounded-md font-bold ${isPro ? "bg-white text-blue-700" : "bg-gray-100 text-gray-700"}`} data-testid="settings-plan-badge">
              {isPro ? "PRO ACTIF" : "GRATUIT"}
            </span>
          </div>
          {quota && (
            <div className={`mt-3 text-sm ${isPro ? "text-blue-100" : "text-gray-700"}`}>
              {isPro ? (
                <>Missions et intervenants <strong>illimités</strong>. Merci pour votre soutien !</>
              ) : (
                <>Missions actives : <strong>{quota.active_missions}/{quota.mission_limit}</strong> · Intervenants : <strong>{quota.workers}/{quota.worker_limit}</strong></>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {isPro ? (
              <button onClick={openPortal} disabled={portalLoading} data-testid="settings-portal-btn"
                className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-gray-100 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60">
                <ExternalLink className="w-4 h-4"/>{portalLoading ? "Ouverture…" : "Gérer mon abonnement"}
              </button>
            ) : (
              <Link to="/pricing" data-testid="settings-upgrade-link"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                <Crown className="w-4 h-4"/> Passer au Pro
              </Link>
            )}
          </div>
        </div>

        {/* Editable profile */}
        <form onSubmit={saveProfile} className="bg-white border border-gray-200 rounded-xl p-6" data-testid="settings-profile-form">
          <h2 className="font-display font-bold text-lg">Profil</h2>
          <p className="text-xs text-gray-500 mt-1">Le numéro de téléphone reçoit les alertes patron (annulation intervenant &lt;24h).</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium">Agence</label>
              <input required data-testid="settings-input-agency" className={inputCls} value={form.agency_name} onChange={(e)=>set("agency_name", e.target.value)}/></div>
            <div><label className="text-sm font-medium">Responsable</label>
              <input required data-testid="settings-input-name" className={inputCls} value={form.name} onChange={(e)=>set("name", e.target.value)}/></div>
            <div><label className="text-sm font-medium">Email</label>
              <input disabled data-testid="settings-input-email" className={`${inputCls} bg-gray-50 text-gray-500`} value={user?.email || ""}/></div>
            <div><label className="text-sm font-medium">Téléphone</label>
              <input data-testid="settings-input-phone" className={inputCls} value={form.phone} onChange={(e)=>set("phone", e.target.value)} placeholder="+33612345678"/></div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={saving} data-testid="settings-save-btn" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60">
              <Save className="w-4 h-4"/>{saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>

        {/* Twilio */}
        <div className={`rounded-xl border p-6 ${cfg?.twilio_ready ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`} data-testid="settings-twilio-block">
          <div className="flex items-center gap-2 font-semibold">
            <Send className="w-5 h-5"/> Notifications SMS (Twilio)
            {cfg?.twilio_ready ? (
              <span className="ml-auto text-xs px-2 py-1 rounded-md bg-green-600 text-white inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Actif</span>
            ) : (
              <span className="ml-auto text-xs px-2 py-1 rounded-md bg-amber-600 text-white inline-flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Non configuré</span>
            )}
          </div>
          <div className="mt-3 text-sm text-gray-700">
            {cfg?.twilio_ready ? (<>Envois SMS depuis <strong>{cfg.twilio_from}</strong>.</>) : (<>Ajoutez <code className="text-xs bg-white px-1 rounded">TWILIO_PHONE_NUMBER</code> dans .env.</>)}
          </div>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input data-testid="settings-test-to" value={testTo} onChange={(e)=>setTestTo(e.target.value)} placeholder={`Vide = mon numéro (${form.phone || "aucun"})`}
              className="flex-1 h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"/>
            <button onClick={sendTest} disabled={testing} data-testid="settings-test-sms-btn"
              className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-md bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium disabled:opacity-60">
              <Zap className="w-4 h-4"/>{testing ? "Envoi…" : "Envoyer un SMS test"}
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6" data-testid="settings-notif-log">
          <h2 className="font-display font-bold text-lg">Journal SMS (30 derniers)</h2>
          {notifs.length === 0 ? (<div className="mt-4 text-sm text-gray-500">Aucun SMS envoyé.</div>) : (
            <ul className="mt-4 divide-y divide-gray-100">
              {notifs.map((n) => (
                <li key={n.id} className="py-3 text-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      → {n.to || "n/a"}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${n.channel === "sms" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>{n.channel}</span>
                      <span className="text-[10px] uppercase tracking-widest text-gray-400">{n.kind || "invite"}</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-lg">{n.body}</div>
                    {n.error && <div className="text-xs text-red-600 mt-0.5">{n.error}</div>}
                  </div>
                  <div className="text-xs text-gray-400 shrink-0">{new Date(n.sent_at).toLocaleString("fr-FR")} · {n.status}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6" data-testid="settings-reminder-block">
          <h2 className="font-display font-bold text-lg">Rappels automatiques 24h</h2>
          <p className="mt-2 text-sm text-gray-600">Rappel SMS envoyé automatiquement à chaque intervenant confirmé ~24h avant son shift.</p>
        </div>
      </div>
    </div>
  );
}
