import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, formatApiError } from "../lib/api";
import { compensationLabel } from "../lib/compensation";
import { HOUR_STATUS } from "./PublicHours";

const input = "rounded-lg border border-gray-300 p-2 bg-white";
const button = "min-h-11 rounded-lg border px-3 text-sm font-medium disabled:opacity-50";
const money = cents => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const duration = minutes => (minutes / 60).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " h";
const ACTION_LABEL = { created: "Déclaration créée", submitted: "Heures soumises", approved: "Validation", rejected: "Refus", correction_requested: "Correction demandée", link_renewed: "Lien renouvelé", delivery_sent: "Message envoyé", delivery_failed: "Échec d’envoi" };

export default function Hours() {
  const [params] = useSearchParams();
  const [mission, setMission] = useState(params.get("mission") || "");
  const [missions, setMissions] = useState([]);
  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [reasons, setReasons] = useState({});
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadSequence = useRef(0);
  const filters = { ...(mission ? { mission_id: mission } : {}), ...(status ? { status } : {}) };
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try { const result = await api.get("/hours", { params: { ...(mission ? { mission_id: mission } : {}), ...(status ? { status } : {}) } }); if (sequence === loadSequence.current) setData(result.data); }
    catch (err) { if (sequence === loadSequence.current) setError(formatApiError(err.response?.data?.detail)); }
  }, [mission, status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([api.get("/missions"), api.get("/hours/settings")]).then(([m, s]) => { setMissions(m.data); setSettings(s.data); }).catch(err => setError(formatApiError(err.response?.data?.detail)));
  }, []);
  const action = async task => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await task(); await load(); }
    catch (err) { setError(formatApiError(err.response?.data?.detail)); }
    finally { lock.current = false; setBusy(false); }
  };
  const review = (row, value) => action(async () => {
    const { data } = await api.post(`/hours/${row.id}/review`, { version: row.version, action: value, reason: reasons[row.id] || "" });
    setNotice(data.delivery === "failed" ? "Décision enregistrée. Le message a échoué : vérifiez WhatsApp puis relancez l’envoi." : "Décision enregistrée.");
  });
  const exportCsv = () => action(async () => {
    const result = await api.get("/hours/export", { params: filters, responseType: "blob" });
    const url = URL.createObjectURL(result.data); const link = document.createElement("a");
    link.href = url; link.download = "shiftflow-heures.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return <div className="max-w-6xl mx-auto space-y-5">
    <div><h1 className="text-2xl font-bold">Heures après mission</h1><p className="text-gray-600 mt-1">Demandez, vérifiez et exportez les heures de vos intervenants confirmés.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-blue-50 p-3 text-blue-900">{notice}</p>}
    <div className="flex flex-wrap gap-3">
      <label className="text-sm">Mission<select aria-label="Mission" className={input + " block mt-1 max-w-xs"} value={mission} onChange={e => setMission(e.target.value)}><option value="">Toutes les missions</option>{missions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label className="text-sm">Statut<select aria-label="Statut" className={input + " block mt-1"} value={status} onChange={e => setStatus(e.target.value)}><option value="">Tous les statuts</option>{Object.entries(HOUR_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button disabled={busy || !mission} className={button + " self-end bg-blue-600 text-white"} onClick={() => action(async () => {
        const { data } = await api.post(`/missions/${mission}/hours/request`);
        setNotice(`${data.sent} message(s) envoyé(s), ${data.failed} échec(s), ${data.skipped} affectation(s) ignorée(s) (créneau non terminé, limite de relance, déjà soumis ou indisponible).`);
      })}>Demander / relancer les heures</button>
      <button disabled={busy} className={button + " self-end"} onClick={exportCsv}>Exporter CSV</button>
      <button disabled={busy} className={button + " self-end"} onClick={() => action(load)}>Actualiser</button>
    </div>
    <p className="text-sm text-gray-600">Sélectionnez une mission pour envoyer les liens. Seuls les créneaux terminés et les intervenants confirmés sont concernés.</p>
    {data && <>
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-4"><p className="text-sm text-gray-600">Heures validées (filtres actifs)</p><strong className="text-2xl">{duration(data.summary.approved_minutes)}</strong></div><div className="rounded-xl border bg-white p-4"><p>À vérifier</p><strong>{data.summary.counts.submitted}</strong></div><div className="rounded-xl border bg-white p-4 text-sm space-y-1"><p className="font-semibold">Montants validés indicatifs</p><p>{money(data.summary.approved_amount_cents.gross)} brut</p><p>{money(data.summary.approved_amount_cents.net)} net</p><p>{money(data.summary.approved_amount_cents.unspecified)} base non précisée</p></div></div>
      {!data.items.length && <div className="rounded-xl border bg-white p-8 text-gray-600">Aucune déclaration pour ces filtres. Sélectionnez une mission terminée et demandez les heures.</div>}
      {data.items.map(row => <article key={row.id} className="rounded-xl border bg-white p-4 sm:p-6 space-y-3">
        <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-semibold">{row.worker_name}</h2><Link className="text-blue-700 underline" to={`/app/missions/${row.mission_id}`}>{row.mission_name}</Link></div><span className="font-semibold text-blue-900">{HOUR_STATUS[row.status]}</span></div>
        <p className="text-sm">{compensationLabel(row.compensation)} · {row.timezone} · {row.minutes == null ? "Non soumis" : `${duration(row.minutes)} · ${money(row.amount_cents)}`}</p>
        <details><summary className="cursor-pointer text-sm">Comparer avec le prévu</summary>{row.planned_entries.map((entry, i) => <p key={i} className="text-sm mt-2">{entry.start.slice(0,16).replace("T", " ")} → {entry.end.slice(0,16).replace("T", " ")} · Pause {entry.break_minutes} min · {duration(entry.minutes)}</p>)}</details>
        {row.entries.map((entry, i) => <p key={i} className="text-sm">{entry.start.slice(0,16).replace("T", " ")} → {entry.end.slice(0,16).replace("T", " ")} · Pause {entry.break_minutes} min · {duration(entry.minutes)}</p>)}
        {row.note && <p className="text-sm">Commentaire : {row.note}</p>}{row.reason && <p className="text-sm">Motif : {row.reason}</p>}
        {row.delivery_status === "failed" && <p className="text-red-700 text-sm">{row.delivery_error}</p>}
        {row.status === "submitted" || ["approved", "rejected"].includes(row.status) ? <div className="space-y-2">
          <label className="block text-sm">Motif (obligatoire pour refus/correction)<textarea className={input + " block w-full mt-1"} maxLength={2000} value={reasons[row.id] || ""} onChange={e => setReasons(previous => ({ ...previous, [row.id]: e.target.value }))} /></label>
          <div className="flex flex-wrap gap-2">{row.status === "submitted" && <><button disabled={busy} className={button + " bg-green-700 text-white"} onClick={() => review(row, "approved")}>Valider</button><button disabled={busy || !reasons[row.id]?.trim()} className={button} onClick={() => review(row, "rejected")}>Refuser</button></>}<button disabled={busy || !reasons[row.id]?.trim()} className={button} onClick={() => review(row, "correction_requested")}>Demander une correction</button></div>
        </div> : <button disabled={busy} className={button} onClick={() => action(async () => {
          const { data } = await api.post(`/hours/${row.id}/renew`);
          setNotice(data.delivery === "sent" ? "Nouveau lien envoyé. L’ancien lien est invalidé." : "Lien renouvelé. L’envoi a échoué : vérifiez la connexion WhatsApp.");
        })}>Renouveler le lien et envoyer</button>}
        <details><summary className="cursor-pointer text-sm text-gray-600">Historique · version {row.version}</summary><ol className="mt-2 space-y-2 text-sm">{row.history.map((event, i) => <li key={i}><p>{new Date(event.at).toLocaleString("fr-FR")} · {ACTION_LABEL[event.action] || event.action} · {event.actor.startsWith("worker:") ? "Intervenant" : event.actor === "system" ? "Système" : "Organisateur"}{event.reason && ` · ${event.reason}`}{event.error && ` · ${event.error}`}</p>{event.entries && <p>{event.entries.map(entry => `${entry.start} → ${entry.end}, pause ${entry.break_minutes} min`).join(" ; ")} · {duration(event.minutes)} · {money(event.amount_cents)} · {event.note}</p>}</li>)}</ol></details>
      </article>)}
    </>}
    {settings && <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-semibold">Envois automatiques et relances</summary><form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); action(async () => { await api.put("/hours/settings", settings); setNotice("Réglages enregistrés."); }); }}>
      <label className="flex gap-2"><input type="checkbox" checked={settings.enabled} onChange={e => setSettings(previous => ({ ...previous, enabled: e.target.checked }))} />Demander automatiquement les heures après les créneaux</label>
      <div className="grid sm:grid-cols-2 gap-4">{[["delay_hours", "Délai après la fin (heures)", 0, 168], ["reminder_hours", "Intervalle entre relances (heures)", 1, 720], ["max_reminders", "Nombre maximal de relances", 0, 10], ["link_days", "Validité des nouveaux liens (jours)", 1, 90]].map(([key, label, min, max]) => <label key={key} className="text-sm">{label}<input type="number" required min={min} max={max} step="1" className={input + " block w-full mt-1"} value={settings[key]} onChange={e => setSettings(previous => ({ ...previous, [key]: Number(e.target.value) }))} /></label>)}</div>
      <p className="text-sm text-gray-600">Les envois s’arrêtent à la soumission, au refus, à la validation ou à l’annulation. Les réglages s’appliquent à votre agence ; la validité s’applique aux nouveaux liens. Activer les envois inclut les anciennes missions terminées non archivées.</p>
      <button disabled={busy} className={button}>Enregistrer les réglages</button>
    </form></details>}
    <p className="text-xs text-gray-500">Montants indicatifs hors charges et frais, sans paiement automatique. Un cachet reste fixe quelle que soit la durée déclarée. Les montants brut/net sont séparés.</p>
  </div>;
}
