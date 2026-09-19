import React, { useEffect, useMemo, useRef, useState } from "react";
import { Crown, ExternalLink, Save, LockKeyhole, RotateCcw, MessageCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { toast, Toaster } from "sonner";

const URL_LIKE_RE = /(?:https?:\/\/|www\.|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i;
const PLACEHOLDER_RE = /\{[^{}]+\}/g;
const DEFAULT_REQUIRED_TOKENS = ["{prenom}", "{mission}", "{date}", "{lien}"];

export default function Settings() {
  const { user, refresh } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [quota, setQuota] = useState(null);
  const [form, setForm] = useState({ name: "", agency_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [messageConfig, setMessageConfig] = useState(null);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [messageSaving, setMessageSaving] = useState(false);
  const messageRef = useRef(null);

  useEffect(() => {
    api.get("/plan/quota").then((r) => setQuota(r.data)).catch(() => {});
    api.get("/whatsapp/message-template").then((r) => {
      setMessageConfig(r.data);
      setMessageTemplate(r.data.template || "");
    }).catch(() => {});
    reloadNotifs();
  }, []);

  useEffect(() => {
    if (user) setForm({ name: user.name || "", agency_name: user.agency_name || "", phone: user.phone || "" });
  }, [user]);

  const reloadNotifs = () => api.get("/notifications/recent").then((r) => setNotifs(r.data.filter((n) => (n.channel || "whatsapp") === "whatsapp"))).catch(() => {});
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

  const isPro = user?.plan === "pro";
  const maxChars = messageConfig?.max_chars || 500;
  const maxLines = messageConfig?.max_lines || 10;
  const variables = useMemo(() => messageConfig?.variables || [], [messageConfig?.variables]);
  const requiredTokens = useMemo(() => messageConfig?.required || DEFAULT_REQUIRED_TOKENS, [messageConfig?.required]);
  const allowedTokens = useMemo(() => new Set(variables.map((v) => v.token)), [variables]);

  const messageValidation = useMemo(() => {
    const errors = [];
    const normalized = (messageTemplate || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const placeholders = normalized.match(PLACEHOLDER_RE) || [];
    const unknown = placeholders.filter((p) => allowedTokens.size > 0 && !allowedTokens.has(p));
    const missing = requiredTokens.filter((token) => !normalized.includes(token));
    const lines = normalized.split("\n").length;
    const withoutRequiredLink = normalized.replace("{lien}", "");

    if (!normalized.trim()) errors.push("Le message ne peut pas être vide.");
    if (normalized.length > maxChars) errors.push(`Maximum ${maxChars} caractères.`);
    if (lines > maxLines) errors.push(`Maximum ${maxLines} lignes.`);
    if (unknown.length) errors.push(`Variable inconnue : ${[...new Set(unknown)].join(", ")}.`);
    if (missing.length) errors.push(`Variables obligatoires manquantes : ${missing.join(", ")}.`);
    if ((normalized.match(/\{lien\}/g) || []).length !== 1) errors.push("{lien} doit apparaître exactement une fois.");
    if (URL_LIKE_RE.test(withoutRequiredLink)) errors.push("Les liens ajoutés manuellement ne sont pas autorisés.");

    return { errors, lines, valid: errors.length === 0 };
  }, [allowedTokens, maxChars, maxLines, messageTemplate, requiredTokens]);

  const insertToken = (token) => {
    if (!isPro) return;
    const textarea = messageRef.current;
    if (!textarea) {
      setMessageTemplate((prev) => `${prev}${prev ? " " : ""}${token}`);
      return;
    }
    const start = textarea.selectionStart ?? messageTemplate.length;
    const end = textarea.selectionEnd ?? start;
    const next = `${messageTemplate.slice(0, start)}${token}${messageTemplate.slice(end)}`;
    if (next.length > maxChars) return;
    setMessageTemplate(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const pos = start + token.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const saveMessageTemplate = async () => {
    if (!isPro || !messageValidation.valid) return;
    setMessageSaving(true);
    try {
      const { data } = await api.put("/whatsapp/message-template", { template: messageTemplate });
      setMessageTemplate(data.template);
      toast.success("Message WhatsApp enregistré");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Impossible d'enregistrer le message.");
    } finally { setMessageSaving(false); }
  };

  const resetMessageTemplate = async () => {
    if (!isPro) return;
    setMessageSaving(true);
    try {
      const { data } = await api.delete("/whatsapp/message-template");
      setMessageTemplate(data.template);
      toast.success("Message par défaut restauré");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Impossible de restaurer le message.");
    } finally { setMessageSaving(false); }
  };

  const inputCls = "mt-1 w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  return (
    <div data-testid="settings-page">
      <Toaster position="top-right" richColors/>
      <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Paramètres</div>
      <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Compte & Agence</h1>

      <div className="mt-8 grid gap-6 max-w-3xl">
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

        <form onSubmit={saveProfile} className="bg-white border border-gray-200 rounded-xl p-6" data-testid="settings-profile-form">
          <h2 className="font-display font-bold text-lg">Profil</h2>
          <p className="text-xs text-gray-500 mt-1">Vos coordonnées servent à identifier l'agence et à gérer votre compte.</p>
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

        <div className={`relative bg-white border rounded-xl p-6 overflow-hidden ${isPro ? "border-gray-200" : "border-blue-200"}`} data-testid="settings-whatsapp-template-block">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <h2 className="font-display font-bold text-lg">Message WhatsApp des cascades</h2>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-1"><Crown className="w-3 h-3"/> Pro</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">Personnalisez le message envoyé automatiquement aux intervenants lors d'une cascade ou d'une relance.</p>
            </div>
            {!isPro && <LockKeyhole className="w-5 h-5 text-blue-600 shrink-0" />}
          </div>

          <div className={`mt-5 ${!isPro ? "pointer-events-none select-none opacity-45 blur-[0.2px]" : ""}`}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-sm font-medium text-gray-900">Message envoyé</label>
              <div className={`text-xs font-medium ${messageTemplate.length > maxChars ? "text-red-600" : "text-gray-500"}`}>{messageTemplate.length}/{maxChars} caractères · {messageValidation.lines}/{maxLines} lignes</div>
            </div>
            <textarea
              ref={messageRef}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value.slice(0, maxChars + 20))}
              disabled={!isPro}
              rows={8}
              spellCheck="true"
              data-testid="settings-whatsapp-template-input"
              className={`w-full px-3 py-3 rounded-lg border font-mono text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 ${messageValidation.valid ? "border-gray-300 focus:ring-blue-500" : "border-red-300 focus:ring-red-400"}`}
            />

            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">Variables disponibles</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {variables.map((variable) => (
                  <button
                    key={variable.token}
                    type="button"
                    onClick={() => insertToken(variable.token)}
                    title={variable.label}
                    className={`px-2.5 py-1.5 rounded-md border font-mono text-xs transition-colors ${variable.required ? "bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"}`}
                  >
                    {variable.token}{variable.required ? " *" : ""}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">* obligatoires : {requiredTokens.join(", ")}. Les sauts de ligne sont conservés dans WhatsApp.</p>
            </div>

            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div><strong>Protection anti-abus :</strong> aucun lien externe n'est autorisé. Le lien sécurisé ShiftFlow doit être ajouté uniquement avec <code className="font-mono">{'{lien}'}</code> et exactement une fois.</div>
            </div>

            {messageValidation.errors.length > 0 ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {messageValidation.errors.map((err) => <div key={err}>• {err}</div>)}
              </div>
            ) : (
              <div className="mt-3 inline-flex items-center gap-2 text-xs text-green-700"><CheckCircle2 className="w-4 h-4"/> Message valide et prêt à être utilisé.</div>
            )}

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <button type="button" onClick={resetMessageTemplate} disabled={!isPro || messageSaving} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                <RotateCcw className="w-4 h-4"/> Restaurer le message par défaut
              </button>
              <button type="button" onClick={saveMessageTemplate} disabled={!isPro || messageSaving || !messageValidation.valid} data-testid="settings-whatsapp-template-save" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                <Save className="w-4 h-4"/>{messageSaving ? "Enregistrement…" : "Enregistrer le message"}
              </button>
            </div>
          </div>

          {!isPro && (
            <div className="absolute inset-x-4 bottom-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[340px] bg-white/95 backdrop-blur border border-blue-200 shadow-lg rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><Crown className="w-4 h-4 text-blue-700"/></div>
                <div>
                  <div className="font-semibold text-sm text-gray-900">Personnalisation réservée au Pro</div>
                  <p className="mt-1 text-xs text-gray-600">Vous pouvez voir les variables et le format, mais seuls les comptes Pro peuvent modifier le message envoyé automatiquement.</p>
                  <Link to="/pricing" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:text-blue-800">Découvrir le plan Pro <ExternalLink className="w-3.5 h-3.5"/></Link>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6" data-testid="settings-notif-log">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-lg">Journal des envois WhatsApp</h2>
              <p className="mt-1 text-xs text-gray-500">Invitations, relances et rappels automatiques.</p>
            </div>
          </div>
          {notifs.length === 0 ? (<div className="mt-4 text-sm text-gray-500">Aucun envoi enregistré.</div>) : (
            <ul className="mt-4 divide-y divide-gray-100">
              {notifs.map((n) => (
                <li key={n.id} className="py-3 text-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      → {n.to || "n/a"}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${n.status === "sent" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>{n.channel || "whatsapp"}</span>
                      <span className="text-[10px] uppercase tracking-widest text-gray-400">{n.kind || "invite"}</span>
                    </div>
                    <div className="text-xs text-gray-500 whitespace-pre-line max-w-lg">{n.body}</div>
                    {n.error && <div className="text-xs text-red-600 mt-0.5">{n.error}</div>}
                  </div>
                  <div className="text-xs text-gray-400 shrink-0">{n.sent_at ? new Date(n.sent_at).toLocaleString("fr-FR") : ""} · {n.status}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6" data-testid="settings-reminder-block">
          <h2 className="font-display font-bold text-lg">Rappels automatiques 24h</h2>
          <p className="mt-2 text-sm text-gray-600">Les rappels sont envoyés automatiquement par WhatsApp aux intervenants confirmés ~24h avant leur shift. Si WhatsApp est déconnecté au moment de l'envoi, l'échec est enregistré dans le journal.</p>
        </div>
      </div>
    </div>
  );
}
