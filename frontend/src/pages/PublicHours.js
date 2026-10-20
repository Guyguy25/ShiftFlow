import React, { useEffect, useRef, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { compensationLabel } from "../lib/compensation";

export const HOUR_STATUS = { pending: "À déclarer", submitted: "En attente de validation", approved: "Validée", rejected: "Refusée", correction_requested: "Correction demandée" };
const field = "block mt-1 w-full rounded-lg border border-gray-300 p-3 text-gray-950";
const editableEntry = entry => ({ start: entry.start.slice(0, 16), end: entry.end.slice(0, 16), break_minutes: entry.break_minutes, start_fold: entry.start_fold || 0, end_fold: entry.end_fold || 0 });

export default function PublicHours() {
  const [token] = useState(() => window.location.hash.slice(1));
  const [sheet, setSheet] = useState(null);
  const [entries, setEntries] = useState([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    if (!token) { setError("Lien personnel manquant. Ouvrez le lien reçu sur WhatsApp."); return; }
    api.post("/public/hours/access", { token }).then(({ data }) => {
      if (!active) return;
      setSheet(data); setEntries(data.entries.map(editableEntry)); setNote(data.note || "");
    }).catch(err => { if (active) setError(formatApiError(err.response?.data?.detail)); });
    return () => { active = false; };
  }, [token]);
  const change = (index, key, value) => setEntries(previous => previous.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const submit = async event => {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const { data } = await api.post("/public/hours/submit", { token, version: sheet.version, entries, note });
      setSheet(data);
    } catch (err) { setError(formatApiError(err.response?.data?.detail)); }
    finally { lock.current = false; setBusy(false); }
  };
  const editable = sheet && ["pending", "correction_requested"].includes(sheet.status);
  return <main className="min-h-screen bg-slate-50 px-4 py-8">
    <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-5 sm:p-8 space-y-5">
      <div className="text-blue-700 font-bold">ShiftFlow</div><h1 className="text-2xl font-bold">Mes heures après mission</h1>
      <p className="text-sm text-gray-600">Ce lien personnel identifie votre affectation. Ne le partagez pas.</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {!sheet && !error && <p role="status">Chargement…</p>}
      {sheet && <>
        <div><h2 className="text-xl font-semibold">{sheet.mission_name}</h2><p>{sheet.worker_name}</p><p className="text-sm text-gray-600">{compensationLabel(sheet.compensation)} · Horaires en {sheet.timezone}</p></div>
        <p role="status" className="rounded-lg bg-blue-50 p-3 font-semibold text-blue-900">{HOUR_STATUS[sheet.status]}</p>
        {sheet.reason && <p className="rounded-lg bg-amber-50 p-3">Message de l’organisateur : {sheet.reason}</p>}
        <details><summary className="cursor-pointer text-sm">Horaires initialement prévus</summary>{sheet.planned_entries.map((entry, i) => <p key={i} className="text-sm mt-2">{entry.start.slice(0,16).replace("T", " ")} → {entry.end.slice(0,16).replace("T", " ")} · Pause {entry.break_minutes} min</p>)}</details>
        {editable ? <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-gray-600">Vérifiez les dates, les horaires et les pauses non rémunérées. Ajoutez une période pour chaque journée ou coupure.</p>
          <fieldset disabled={busy} className="space-y-4 min-w-0">
            {entries.map((entry, i) => <div key={i} className="rounded-xl border p-4 space-y-3">
              <h3 className="font-semibold">Période {i + 1}</h3>
              <label className="block text-sm">Début<input required type="datetime-local" className={field} value={entry.start} onChange={e => change(i, "start", e.target.value)} /></label>
              <label className="block text-sm">Fin<input required type="datetime-local" className={field} value={entry.end} onChange={e => change(i, "end", e.target.value)} /></label>
              <label className="block text-sm">Pause non rémunérée (minutes)<input required type="number" min="0" max="44639" step="1" className={field} value={entry.break_minutes} onChange={e => change(i, "break_minutes", Number(e.target.value))} /></label>
              <details className="text-sm"><summary>Changement d’heure (heure répétée)</summary><p className="my-2">Si un horaire apparaît deux fois lors du passage à l’heure d’hiver, indiquez son occurrence.</p>{["start", "end"].map(key => <label key={key} className="block mt-2">{key === "start" ? "Début" : "Fin"}<select className={field} value={entry[key + "_fold"]} onChange={e => change(i, key + "_fold", Number(e.target.value))}><option value={0}>Première occurrence</option><option value={1}>Seconde occurrence</option></select></label>)}</details>
              {entries.length > 1 && <button type="button" className="min-h-11 text-red-700" onClick={() => setEntries(previous => previous.filter((_, index) => index !== i))}>Supprimer cette période</button>}
            </div>)}
            <button type="button" disabled={entries.length >= 100} className="min-h-11 rounded-lg border px-4" onClick={() => setEntries(previous => [...previous, { start: "", end: "", break_minutes: 0, start_fold: 0, end_fold: 0 }])}>Ajouter une période</button>
            <label className="block text-sm">Commentaire (facultatif)<textarea maxLength={2000} className={field} value={note} onChange={e => setNote(e.target.value)} /></label>
            <button className="w-full min-h-12 rounded-xl bg-blue-600 px-4 text-white font-semibold">{busy ? "Envoi…" : "Soumettre mes heures"}</button>
          </fieldset>
        </form> : <div className="space-y-2">
          {sheet.entries.map((entry, i) => <p key={i}>{entry.start.slice(0,16).replace("T", " ")} → {entry.end.slice(0,16).replace("T", " ")} · Pause {entry.break_minutes} min</p>)}
          {sheet.minutes != null && <p className="font-semibold">{(sheet.minutes / 60).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h · {(sheet.amount_cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} indicatifs</p>}
          <p className="text-sm text-gray-600">{sheet.status === "submitted" ? "Vos heures sont enregistrées. L’organisateur peut les valider ou vous demander une correction." : "Pour une modification, contactez l’organisateur."}</p>
        </div>}
        <p className="text-xs text-gray-500">Les montants sont indicatifs, hors charges et frais. La validation ne déclenche aucun paiement.</p>
      </>}
    </div>
  </main>;
}
