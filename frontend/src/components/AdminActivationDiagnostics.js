import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const LABELS = {
  mission_form_opened: "Formulaire ouvert",
  mission_form_step: "Étape mission",
  mission_form_error: "Erreur mission",
  whatsapp_session_started: "Session WhatsApp tentée",
  whatsapp_session_error: "Erreur session WhatsApp",
  whatsapp_pair_requested: "Code WhatsApp demandé",
  whatsapp_pair_error: "Erreur de code WhatsApp",
  invitation_review_opened: "Vérification de l'invitation",
  invitation_send_attempted: "Envoi tenté",
  invitation_send_error: "Erreur d'envoi",
  onboarding_guide_dismissed: "Guide masqué",
};
const date = value => value ? new Date(value).toLocaleString("fr-FR", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";

export default function AdminActivationDiagnostics() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  const load = () => {
    setFailed(false);
    api.get("/admin/activation-diagnostics").then(({data}) => setData(data)).catch(() => setFailed(true));
  };
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => (data?.users || []).filter(u => {
    const needle = query.toLowerCase().trim();
    return !needle || [u.name, u.agency_name, u.email].some(v => (v || "").toLowerCase().includes(needle));
  }).filter(u => (u.recent || []).length || u.reason), [data, query]);

  return <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="Diagnostic de l'activation">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Activation</p>
        <h2 className="mt-1 text-xl font-bold">Pourquoi les utilisateurs s'arrêtent-ils ?</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">Tentatives et erreurs observées, plus les raisons déclarées. Une erreur ne prouve pas à elle seule la raison de l'abandon.</p></div>
      <button type="button" onClick={load} className="min-h-10 rounded-lg border border-gray-200 px-4 text-sm font-semibold hover:bg-gray-50">Actualiser</button>
    </div>
    {failed ? <p className="mt-4 text-sm text-red-700">Chargement impossible. Réessayez.</p> : !data ? <p className="mt-4 text-sm text-gray-500">Chargement des diagnostics…</p> : <>
      <p className="mt-3 text-xs text-gray-400">Suivi actif uniquement après le déploiement de cette fonctionnalité, avec conservation des événements pendant 90 jours.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.reasons.map(r => <div key={r.key} className="flex justify-between gap-2 rounded-xl bg-gray-50 px-4 py-3 text-sm"><span className="text-gray-700">{r.label}</span><strong>{r.count}</strong></div>)}
      </div>
      <label className="mt-5 block text-sm font-semibold text-gray-700">Recherche utilisateur
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom, organisation, email" className="mt-2 block min-h-11 w-full max-w-md rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-blue-400" />
      </label>
      <div className="mt-4 divide-y divide-gray-100">
        {rows.length === 0 && <p className="py-4 text-sm text-gray-500">Aucune interaction récente ou raison déclarée pour ces comptes.</p>}
        {rows.slice(0, 60).map(u => <details key={u.id} className="py-3">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900">{u.agency_name || u.name || u.email} <span className="font-normal text-gray-500">· {u.email} · {(u.recent || []).length} derniers événements{u.reason ? " · Motif renseigné" : ""}</span></summary>
          <div className="mt-3 rounded-xl bg-gray-50 p-4 text-sm">
            {u.reason && <p className="mb-3 font-medium text-blue-700">Raison déclarée : {data.reasons.find(r => r.key === u.reason)?.label || "Autre"}</p>}
            <ol className="space-y-2">
              {u.recent.map((ev, i) => <li key={i} className="flex flex-wrap justify-between gap-2"><span>{LABELS[ev.event] || ev.event}{ev.detail ? " · "+ev.detail : ""}</span><time className="text-gray-500">{date(ev.at)}</time></li>)}
            </ol>
          </div>
        </details>)}
      </div>
    </>}
  </section>;
}
