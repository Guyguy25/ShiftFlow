import React, { useEffect, useMemo, useRef, useState } from "react";
import { Save, RotateCcw, MessageCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

const URL_LIKE_RE = /(?:https?:\/\/|www\.|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i;
const PLACEHOLDER_RE = /\{[^{}]+\}/g;
const DEFAULT_REQUIRED_TOKENS = ["{prenom}", "{mission}", "{date}", "{lien}"];


export default function Automations() {
  const [notifs, setNotifs] = useState([]);
  const [messageConfig, setMessageConfig] = useState(null);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [messageSaving, setMessageSaving] = useState(false);
  const messageRef = useRef(null);
  const [automationKind, setAutomationKind] = useState("invite");
  const [automationConfig, setAutomationConfig] = useState(null);

  useEffect(() => {
    api.get("/whatsapp/automations").then((r) => {
      setAutomationConfig(r.data);
      setMessageConfig(r.data);
      setMessageTemplate(r.data.template || "");
    }).catch(() => toast.error("Impossible de charger les modèles. Réessayez en rechargeant cette page."));
    reloadNotifs();
  }, []);

  const reloadNotifs = () => api.get("/notifications/recent").then((r) => setNotifs(r.data.filter((n) => (n.channel || "whatsapp") === "whatsapp"))).catch(() => {});
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
    if (!messageValidation.valid) return;
    setMessageSaving(true);
    try {
      const { data } = await api.put(`/whatsapp/automations/${automationKind}`, { template: messageTemplate });
      setMessageTemplate(data.template);
      setAutomationConfig(prev => ({ ...prev, templates: { ...prev.templates, [automationKind]: data.template } }));
      toast.success("Message WhatsApp enregistré");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Impossible d'enregistrer le message.");
    } finally { setMessageSaving(false); }
  };

  const resetMessageTemplate = async () => {
    setMessageSaving(true);
    try {
      const { data } = await api.put(`/whatsapp/automations/${automationKind}`, { template: automationConfig.defaults[automationKind] });
      setMessageTemplate(data.template);
      setAutomationConfig(prev => ({ ...prev, templates: { ...prev.templates, [automationKind]: data.template } }));
      toast.success("Message par défaut restauré");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Impossible de restaurer le message.");
    } finally { setMessageSaving(false); }
  };

  return (
    <div data-testid="automations-page">
      <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Communications</div>
      <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Automatisations</h1>
      <p className="mt-2 text-sm text-gray-500">Personnalisez vos messages WhatsApp, consultez les envois et retrouvez les rappels automatiques.</p>
      <div className="mt-8 grid gap-6 max-w-3xl">
        <div className="relative bg-white border border-gray-200 rounded-xl p-6" data-testid="automations-whatsapp-template-block">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-600" />
                <h2 className="font-display font-bold text-lg">Messages WhatsApp</h2>

              </div>
              <p className="mt-1 text-sm text-gray-600">Modèles accessibles à tous. Les modifications s’appliquent aux prochains envois. Les messages déjà validés pour une sélection sont conservés.</p>
            </div>
          </div>

          <label className="mt-4 block text-sm font-medium">Type de message
            <select aria-label="Type de message" className="mt-2 w-full border rounded-lg p-3" value={automationKind} disabled={messageSaving || !automationConfig} onChange={event => {
              if (messageTemplate !== automationConfig.templates[automationKind] && !window.confirm("Abandonner les modifications non enregistrées ?")) return;
              const kind = event.target.value; setAutomationKind(kind); setMessageTemplate(automationConfig.templates[kind]);
            }}>
              <option value="invite">Première invitation</option><option value="followup">Relance sans réponse</option><option value="cancellation">Annulation</option><option value="removal">Retrait d’un intervenant</option><option value="change">Modification de créneau</option>
            </select>
          </label>
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-sm font-medium text-gray-900">Message envoyé</label>
              <div className={`text-xs font-medium ${messageTemplate.length > maxChars ? "text-red-600" : "text-gray-500"}`}>{messageTemplate.length}/{maxChars} caractères · {messageValidation.lines}/{maxLines} lignes</div>
            </div>
            <textarea
              ref={messageRef}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value.slice(0, maxChars + 20))}
              disabled={!automationConfig || messageSaving}
              rows={8}
              spellCheck="true"
              data-testid="automations-whatsapp-template-input"
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
              <button type="button" onClick={resetMessageTemplate} disabled={messageSaving || !automationConfig} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                <RotateCcw className="w-4 h-4"/> Restaurer le message par défaut
              </button>
              <button type="button" onClick={saveMessageTemplate} disabled={messageSaving || !automationConfig || !messageValidation.valid} data-testid="automations-whatsapp-template-save" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                <Save className="w-4 h-4"/>{messageSaving ? "Enregistrement…" : "Enregistrer le message"}
              </button>
            </div>
          </div>


        </div>

        <details><summary className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 font-semibold">Consulter le journal des envois</summary>
        <div className="bg-white border border-gray-200 rounded-xl p-6" data-testid="automations-notif-log">
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

        </details>
        <div className="bg-white border border-gray-200 rounded-xl p-6" data-testid="automations-reminder-block">
          <h2 className="font-display font-bold text-lg">Rappels automatiques 24h</h2>
          <p className="mt-2 text-sm text-gray-600">Les rappels sont envoyés automatiquement par WhatsApp aux intervenants confirmés ~24h avant leur shift. Si WhatsApp est déconnecté au moment de l'envoi, l'échec est enregistré dans le journal.</p>
        </div>

      </div>
    </div>
  );
}
