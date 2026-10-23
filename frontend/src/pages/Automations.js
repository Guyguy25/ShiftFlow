import { useAuth } from "../context/AuthContext";
import { canManageOperations } from "../lib/permissions";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Save, RotateCcw, MessageCircle, Info, CheckCircle2, ArrowRight, Clock3, History, CalendarClock, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { workspacePath } from "../lib/workspacePaths";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

const URL_LIKE_RE = /(?:https?:\/\/|www\.|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i;
const PLACEHOLDER_RE = /\{[^{}]+\}/g;
const DEFAULT_REQUIRED_TOKENS = ["{prenom}", "{mission}", "{date}", "{lien}"];


export default function Automations() {
  const user = useAuth()?.user;
  const canManage = canManageOperations(user);
  const scoped = path => workspacePath(user?.organization?.id, path);
  const [tab, setTab] = useState("messages");
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

  const reloadNotifs = () => api.get("/notifications/recent").then(r => setNotifs((Array.isArray(r.data) ? r.data : []).filter(n => (n.channel || "whatsapp") === "whatsapp"))).catch(() => {});
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

  // Illustrative local preview only: never sends an invitation or generates a real link.
  const preview = useMemo(() => {
    const example = {
      "{prenom}": "Camille", "{nom}": "Martin", "{mission}": "Montage Festival",
      "{date}": "12 novembre 2026", "{heure_debut}": "08:00",
      "{heure_fin}": "18:00", "{lieu}": "Lille",
      "{remuneration}": "150 € net", "{tarif}": "150 € net",
      "{agence}": "Votre organisation", "{lien}": "[lien sécurisé ShiftFlow]"
    };
    return (messageTemplate || "").replace(PLACEHOLDER_RE, token => example[token] || token);
  }, [messageTemplate]);

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

  const storedTemplate = automationConfig?.templates?.[automationKind] ?? automationConfig?.template ?? "";
  const isDirty = !!automationConfig && messageTemplate !== storedTemplate;
  const changeKind = kind => {
    if (!automationConfig || messageSaving || kind === automationKind) return true;
    if (isDirty && !window.confirm("Abandonner les modifications non enregistrées ?")) return false;
    setAutomationKind(kind);
    setMessageTemplate(automationConfig.templates?.[kind] || "");
    return true;
  };

  const kinds = [
    ["invite", "Première invitation"],
    ["followup", "Relance sans réponse"],
    ["cancellation", "Annulation"],
    ["removal", "Retrait d’un intervenant"],
    ["change", "Modification de créneau"],
  ];

  const notificationName = kind => ({
    invite: "Invitation", followup: "Relance", reminder: "Rappel avant mission",
    cancellation: "Annulation", removal: "Retrait", change: "Changement de créneau"
  })[kind] || "Message WhatsApp";

  return <div data-testid="automations-page" className="max-w-6xl">
    <header>
      <div className="text-[11px] sm:text-xs uppercase tracking-[0.16em] text-blue-700 font-bold">Communications</div>
      <h1 className="mt-1.5 text-[28px] leading-tight sm:text-3xl font-display font-bold tracking-tight">Messages & relances</h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-500">Préparez vos messages WhatsApp, retrouvez les rappels et consultez les envois de votre organisation.</p>
    </header>

    <nav aria-label="Rubriques des communications" role="tablist" className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5 sm:inline-flex">
      {[
        ["messages", "Messages", MessageCircle],
        ["relances", "Relances & rappels", Clock3],
        ["historique", "Historique des envois", History],
      ].map(([key, label, Icon]) => <button key={key} type="button" role="tab" aria-selected={tab === key} data-testid={`communications-tab-${key}`} onClick={() => setTab(key)} className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-colors ${tab === key ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}><Icon size={16}/>{label}</button>)}
    </nav>

    {tab === "messages" && <div role="tabpanel" className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]" data-testid="automations-whatsapp-template-block">
      <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="font-display text-lg font-bold text-gray-950">Personnaliser un message</h2><p className="mt-1 text-xs sm:text-sm text-gray-500">Les modèles sont partagés dans votre organisation et s'appliquent aux prochains envois.</p></div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600"><MessageCircle size={19}/></span>
        </div>
        <label className="mt-5 block text-sm font-semibold text-gray-900" htmlFor="message-kind">Type de message</label>
        <select id="message-kind" aria-label="Type de message" className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={automationKind} disabled={!canManage || messageSaving || !automationConfig} onChange={event => changeKind(event.target.value)}>
          {kinds.map(([key,label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="automation-template" className="text-sm font-semibold text-gray-900">Votre message</label>
          <span className={`text-xs ${messageTemplate.length > maxChars || messageValidation.lines > maxLines ? "text-red-600" : "text-gray-500"}`}>{messageTemplate.length}/{maxChars} caractères · {messageValidation.lines}/{maxLines} lignes</span>
        </div>
        <textarea
          id="automation-template"
          ref={messageRef}
          value={messageTemplate}
          onChange={event => setMessageTemplate(event.target.value.slice(0, maxChars + 20))}
          disabled={!canManage || !automationConfig || messageSaving}
          rows={10}
          spellCheck="true"
          data-testid="automations-whatsapp-template-input"
          className={`mt-2 w-full resize-y rounded-xl border px-3 py-3 font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 ${messageValidation.valid ? "border-gray-200 focus:ring-blue-500" : "border-red-300 focus:ring-red-400"}`}
        />
        <p className="mt-2 text-xs leading-relaxed text-gray-500">Modifiez simplement le texte. Les informations entre accolades sont remplacées automatiquement pour chaque intervenant.</p>

        <details className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3" data-testid="automations-advanced-options">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">Options avancées : ajouter une information</summary>
          <p className="mt-3 text-xs text-gray-500">Cliquez sur une variable pour l’insérer à l’emplacement du curseur.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {variables.map(variable => <button key={variable.token} type="button" disabled={!canManage || messageSaving} onClick={() => insertToken(variable.token)} title={variable.label} className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs disabled:opacity-50 ${variable.required ? "border-blue-200 bg-blue-50 text-blue-800" : "border-gray-200 bg-white text-gray-700"}`}>{variable.token}{variable.required ? " *" : ""}</button>)}
          </div>
          <p className="mt-3 text-xs text-gray-500">* Variables obligatoires : {requiredTokens.join(", ")}.</p>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
            <Info size={16} className="mt-0.5 shrink-0"/>
            <p>Utilisez une seule fois <code className="font-mono">{'{lien}'}</code> pour le lien sécurisé ShiftFlow. Les liens externes ne sont pas autorisés.</p>
          </div>
        </details>

        {messageValidation.errors.length ? <div role="alert" className="mt-4 space-y-1 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{messageValidation.errors.map(error => <p key={error}>• {error}</p>)}</div> : <div className="mt-4 flex items-center gap-2 text-xs text-green-700"><CheckCircle2 size={16}/>Message valide et prêt à être utilisé.</div>}
        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={resetMessageTemplate} disabled={!canManage || !automationConfig?.defaults?.[automationKind] || messageSaving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw size={16}/>Restaurer par défaut</button>
          <button type="button" data-testid="automations-whatsapp-template-save" onClick={saveMessageTemplate} disabled={!canManage || messageSaving || !automationConfig || !messageValidation.valid || !isDirty} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Save size={16}/>{messageSaving ? "Enregistrement…" : "Enregistrer le message"}</button>
        </div>
        {isDirty && <p className="mt-2 text-xs text-amber-700">Modifications non enregistrées.</p>}
      </section>

      <aside className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 xl:sticky xl:top-24" data-testid="automations-whatsapp-preview" aria-label="Aperçu du message WhatsApp">
        <div className="flex items-center justify-between gap-2"><h2 className="font-display text-lg font-bold text-gray-950">Aperçu WhatsApp</h2><span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-500">Exemple fictif</span></div>
        <p className="mt-1 text-xs text-gray-500">Visualisez le message tel qu'il pourrait être reçu.</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-[#e9eeeb]">
          <div className="flex items-center gap-2 bg-white/90 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700"><MessageCircle size={17}/></span>
            <div><p className="text-sm font-semibold text-gray-900">Conversation WhatsApp</p><p className="text-[11px] text-gray-500">Aperçu uniquement</p></div>
          </div>
          <div className="min-h-[180px] px-3 py-5 sm:px-4">
            <div className="ml-auto max-w-[95%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-4 py-3 text-sm leading-relaxed text-gray-900 shadow-sm whitespace-pre-wrap break-words">{preview || "Votre message apparaîtra ici."}</div>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-900"><Info size={16} className="mt-0.5 shrink-0"/><span>Camille et les informations de la mission sont des exemples. Aucun message n'est envoyé depuis cet aperçu.</span></div>
      </aside>
    </div>}

    {tab === "relances" && <section role="tabpanel" className="mt-5 space-y-4" data-testid="communications-reminders">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">Relances et rappels WhatsApp</h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-500">Les automatisations suivent les règles de vos missions. Cette page explique les messages prévus et vous permet d'en modifier le texte, sans changer leur fréquence.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><MessageCircle size={20}/></span><h3 className="font-semibold text-gray-950">Relance sans réponse</h3></div>
          <p className="mt-4 text-sm leading-relaxed text-gray-600">Personnalisez le texte utilisé lorsqu'une relance est envoyée à un intervenant qui n'a pas répondu. Le déclenchement dépend du suivi de la mission.</p>
          <button type="button" onClick={() => { if (changeKind("followup")) setTab("messages"); }} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">Modifier le message de relance <ArrowRight size={16}/></button>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6" data-testid="automations-reminder-block">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><CalendarClock size={20}/></span><h3 className="font-semibold text-gray-950">Rappel avant mission</h3></div>
          <p className="mt-4 text-sm leading-relaxed text-gray-600">Un rappel est prévu environ 24 h avant le créneau des intervenants confirmés. Si WhatsApp est déconnecté, l'échec d'envoi est consigné dans l'historique.</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"><Clock3 size={14}/>Envoi automatique prévu ~24 h avant</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Clock3 size={20}/></span><h3 className="font-semibold text-gray-950">Demandes d'heures après mission</h3></div>
          <p className="mt-4 text-sm leading-relaxed text-gray-600">Les demandes d'heures et leurs relances se configurent dans la section Heures, indépendamment des modèles de messages ci-dessus.</p>
          <Link to={scoped("/app/hours")} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">Gérer les heures et leurs relances <ArrowRight size={16}/></Link>
        </div>
      </div>
    </section>}

    {tab === "historique" && <section role="tabpanel" className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6" data-testid="automations-notif-log">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-lg font-bold text-gray-950">Historique des envois</h2><p className="mt-1 text-sm text-gray-500">Dernières invitations et relances WhatsApp enregistrées.</p></div>
        <button type="button" onClick={reloadNotifs} className="min-h-10 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">Actualiser</button>
      </div>
      {notifs.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center"><History size={27} className="mx-auto text-gray-300"/><h3 className="mt-2 text-sm font-semibold">Aucun envoi enregistré</h3><p className="mt-1 text-xs text-gray-500">Vos prochains messages apparaîtront dans cet historique.</p></div> :
        <ul className="mt-5 divide-y divide-gray-100">
          {notifs.map((notification, index) => <li key={notification.id || index} className="py-4 first:pt-0">
            <div className="flex flex-wrap items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${notification.status === "failed" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-600"}`}>{notification.status === "failed" ? <AlertCircle size={17}/> : <MessageCircle size={17}/>}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{notificationName(notification.kind)}</p>
                <p className="mt-0.5 break-words text-xs text-gray-500">{notification.to || "Destinataire non indiqué"}{notification.sent_at ? ` · ${new Date(notification.sent_at).toLocaleString("fr-FR")}` : ""}</p>
              </div>
              <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${notification.status === "sent" ? "bg-green-50 text-green-800" : notification.status === "failed" ? "bg-red-50 text-red-800" : "bg-gray-100 text-gray-700"}`}>{notification.status === "sent" ? "Envoyé" : notification.status === "failed" ? "Échec" : "En traitement"}</span>
            </div>
            {(notification.body || notification.error) && <details className="mt-2 pl-12 text-xs text-gray-600"><summary className="cursor-pointer font-medium text-blue-700">Voir le détail</summary>{notification.body && <p className="mt-2 whitespace-pre-wrap break-words">{notification.body}</p>}{notification.error && <p className="mt-2 text-red-700">{notification.error}</p>}</details>}
          </li>)}
        </ul>}
    </section>}
  </div>;
}
