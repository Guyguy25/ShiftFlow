import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Clock3, CheckCircle2, AlertTriangle, Send, Zap } from "lucide-react";
import { api, formatApiError } from "../lib/api";

const localInput = value => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const p = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
};
const toUtc = value => {
  const time = new Date(value);
  if (!value || Number.isNaN(time.getTime())) throw new Error("Renseignez une date et une heure valides.");
  return time.toISOString();
};

export default function PublicTimesheet() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [note, setNote] = useState("");
  const load = useCallback(async () => {
    try {
      const { data: result } = await api.get(`/public/timesheets/${token}`);
      setData(result);
      setStart(localInput(result.timesheet.started_at));
      setEnd(localInput(result.timesheet.ended_at));
      setBreakMinutes(String(result.timesheet.break_minutes ?? 0));
      setError("");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Ce lien n'est plus valide.");
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const pause = Number(breakMinutes);
      if (!Number.isInteger(pause) || pause < 0 || pause > 720) throw new Error("La pause doit être comprise entre 0 et 720 minutes.");
      const started_at = toUtc(start);
      const ended_at = toUtc(end);
      if (new Date(ended_at) <= new Date(started_at)) throw new Error("L'heure de fin doit être après l'heure de début.");
      await api.post(`/public/timesheets/${token}`, { started_at, ended_at, break_minutes: pause, note });
      await load();
    } catch (err) {
      setError(err.response ? formatApiError(err.response.data?.detail) : (err.message || "Déclaration impossible."));
    } finally { setSaving(false); }
  };

  const status = data?.timesheet?.status;
  const readOnly = status === "approved";
  const submitted = status === "submitted";

  return <div className="min-h-screen bg-[#F9FAFB]">
    <header className="border-b border-gray-200 bg-white px-5 py-4">
      <div className="mx-auto flex max-w-xl items-center gap-2 font-display font-bold">
        <div className="rounded-md bg-blue-600 p-1.5 text-white"><Zap size={18}/></div>
        ShiftFlow
        <span className="ml-auto text-xs font-normal text-gray-500">Déclaration des heures</span>
      </div>
    </header>
    <main className="mx-auto max-w-xl px-5 py-8" data-testid="public-timesheet-page">
      {!data && !error && <p className="text-sm text-gray-500">Chargement de votre mission…</p>}
      {!data && error && <div className="rounded-xl border border-red-200 bg-white p-6">
        <AlertTriangle className="text-red-600"/><h1 className="mt-3 text-xl font-bold">Lien indisponible</h1>
        <p className="mt-2 text-sm text-gray-600">{error}</p>
      </div>}
      {data && <>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Vos heures de mission</p>
        <h1 className="mt-2 text-3xl font-display font-bold">{data.mission.name}</h1>
        <p className="mt-2 text-sm text-gray-600">Bonjour {data.worker.first_name}, confirmez les heures que vous avez réellement effectuées. Aucun compte à créer.</p>
        <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4 text-sm">
          <p className="font-semibold">{data.mission.location}</p>
          <p className="mt-1 text-gray-600">Prévu : {data.shift.date.split("-").reverse().join("/")} · {data.shift.start_time}–{data.shift.end_time}</p>
          <p className="mt-1 text-xs text-gray-500">Rémunération : {data.shift.pay_type === "fixed" ? "au cachet" : "à l'heure"}</p>
        </div>
        {status === "needs_correction" && <div role="alert" className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          <strong>Une correction est demandée.</strong>
          <p className="mt-1">{data.timesheet.review_note || "Merci de vérifier votre déclaration."}</p>
        </div>}
        {readOnly ? <div className="mt-5 rounded-xl border border-green-200 bg-white p-6">
          <CheckCircle2 className="text-green-600" size={30}/>
          <h2 className="mt-3 text-xl font-bold">Vos heures ont été validées</h2>
          <p className="mt-2 text-sm text-gray-600">Temps travaillé validé : {(data.timesheet.worked_minutes / 60).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h. Cette déclaration ne peut plus être modifiée.</p>
        </div> : <form onSubmit={submit} className="mt-5 rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          {submitted && <p className="rounded-lg bg-blue-50 px-3 py-3 text-sm text-blue-800 flex items-start gap-2"><CheckCircle2 size={18} className="shrink-0"/> Déclaration envoyée : elle attend la validation de l'organisateur. Vous pouvez encore la corriger.</p>}
          <div>
            <label htmlFor="timesheet-start" className="block text-sm font-semibold">Début réel</label>
            <input id="timesheet-start" type="datetime-local" required value={start} onChange={e => setStart(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-gray-300 p-3 text-base" />
          </div>
          <div>
            <label htmlFor="timesheet-end" className="block text-sm font-semibold">Fin réelle</label>
            <input id="timesheet-end" type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-gray-300 p-3 text-base" />
          </div>
          <div>
            <label htmlFor="timesheet-break" className="block text-sm font-semibold">Pause non travaillée (minutes)</label>
            <input id="timesheet-break" type="number" min="0" max="720" step="1" inputMode="numeric" required
              value={breakMinutes} onChange={e => setBreakMinutes(e.target.value)}
              className="mt-2 min-h-12 w-full rounded-lg border border-gray-300 p-3 text-base" />
          </div>
          <div>
            <label htmlFor="timesheet-note" className="block text-sm font-semibold">Commentaire (facultatif)</label>
            <textarea id="timesheet-note" maxLength={500} rows={2} value={note} onChange={e => setNote(e.target.value)}
              placeholder="Ex. : fin de mission retardée" className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-base" />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-50">
            <Send size={17}/> {saving ? "Envoi…" : submitted ? "Mettre à jour ma déclaration" : "Envoyer mes heures"}
          </button>
          <p className="text-xs text-gray-500 flex items-start gap-2"><Clock3 size={15} className="shrink-0"/> Les heures sont soumises à vérification par l'organisateur. L'envoi n'entraîne aucun paiement automatique.</p>
        </form>}
      </>}
    </main>
  </div>;
}
