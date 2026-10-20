import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock3, Send, FileDown, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

const STATUS = {
  not_sent: ["Non demandé", "bg-gray-100 text-gray-600"],
  sent: ["En attente", "bg-blue-50 text-blue-700"],
  submitted: ["À valider", "bg-amber-50 text-amber-800"],
  needs_correction: ["À corriger", "bg-orange-50 text-orange-700"],
  approved: ["Validé", "bg-green-50 text-green-700"],
};
const formatHours = (minutes) => minutes == null ? "—" : `${(minutes / 60).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h`;
const formatDate = value => value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";
const amount = row => row.worked_minutes == null ? null : row.pay_type === "fixed"
  ? Number(row.fixed_amount || 0) : (row.worked_minutes / 60) * Number(row.rate_hourly || 0);

export default function Timesheets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [missions, setMissions] = useState([]);
  const [selected, setSelected] = useState(searchParams.get("mission") || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyRow, setBusyRow] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/missions").then(({ data: list }) => {
      if (!active) return;
      setMissions(list);
      setSelected(old => old || list[0]?.id || "");
    }).catch(() => { if (active) setError("Impossible de charger les missions."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    if (!selected) return;
    try {
      const { data: response } = await api.get(`/missions/${selected}/timesheets`);
      setData(response); setError("");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Impossible de charger les déclarations.");
    }
  }, [selected]);

  useEffect(() => { setData(null); load(); }, [load]);

  const rows = data?.rows || [];
  const counts = useMemo(() => ({
    pending: rows.filter(r => r.status === "submitted").length,
    approved: rows.filter(r => r.status === "approved").length,
    total: rows.length,
  }), [rows]);

  const send = async (row = null, resend = false) => {
    if (!selected || busy || busyRow) return;
    row ? setBusyRow(row.slot_id) : setBusy(true);
    try {
      const { data: result } = await api.post(`/missions/${selected}/timesheets/send`,
        row ? { slot_ids: [row.slot_id], resend } : {});
      if (result.sent) toast.success(`${result.sent} demande(s) WhatsApp envoyée(s).`);
      if (result.failed) toast.error(`${result.failed} envoi(s) en échec. Vérifiez la connexion WhatsApp.`);
      if (!result.sent && !result.failed) toast.info("Aucun envoi nécessaire : vérifiez la fin des créneaux et les statuts.");
      await load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Impossible d'envoyer la demande.");
    } finally { setBusy(false); setBusyRow(""); }
  };

  const review = async (row, decision) => {
    let note = "";
    if (decision === "request_correction") {
      const answer = window.prompt("Quelle correction demander à l'intervenant ?");
      if (!answer?.trim()) return;
      note = answer.trim();
    }
    setBusyRow(row.slot_id);
    try {
      const { data: result } = await api.post(
        `/missions/${selected}/timesheets/${row.slot_id}/review`, { decision, note });
      if (decision === "approve") toast.success("Heures validées.");
      else if (result.correction_message === "sent") toast.success("Correction demandée par WhatsApp.");
      else toast.info("Correction enregistrée. Vous pourrez réessayer l'envoi WhatsApp.");
      await load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Validation impossible.");
    } finally { setBusyRow(""); }
  };

  const download = async () => {
    try {
      const { data: blob } = await api.get(`/missions/${selected}/timesheets/export`, { responseType: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shiftflow-heures-${selected}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error("Export impossible."); }
  };

  return <div className="max-w-5xl pb-20" data-testid="timesheets-page">
    <p className="text-xs uppercase tracking-widest text-blue-700 font-bold">Suivi terrain</p>
    <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Heures des intervenants</h1>
    <p className="mt-2 text-sm text-gray-600 max-w-2xl">Demandez les heures sur WhatsApp après la mission, vérifiez les écarts puis exportez uniquement les heures validées. Aucun compte n'est requis pour les intervenants.</p>

    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <label htmlFor="timesheet-mission" className="block text-sm font-semibold">Mission</label>
      <select id="timesheet-mission" className="mt-2 w-full rounded-lg border border-gray-300 p-3 text-sm"
        value={selected} onChange={e => { setSelected(e.target.value); setSearchParams({ mission: e.target.value }); }}>
        {missions.length === 0 && <option value="">Aucune mission</option>}
        {missions.map(m => <option key={m.id} value={m.id}>{m.name} · {m.first_date || "sans date"}</option>)}
      </select>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!selected || busy || !!busyRow || !data} onClick={() => send()}
          className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2">
          <Send size={16}/> {busy ? "Envoi…" : "Demander les heures"}
        </button>
        <button type="button" disabled={!selected || !counts.approved} onClick={download}
          className="min-h-11 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
          <FileDown size={16}/> Exporter les heures validées
        </button>
        <button type="button" disabled={!selected} onClick={load} className="min-h-11 rounded-lg px-3 text-blue-700 inline-flex items-center gap-2"><RefreshCw size={16}/> Actualiser</button>
      </div>
      <p className="mt-2 text-xs text-gray-500">Seuls les intervenants confirmés dont le créneau est terminé reçoivent une demande. Un nouvel envoi évite les doublons.</p>
    </div>

    <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
      {[[counts.total, "Intervenants"], [counts.pending, "À valider"], [counts.approved, "Validés"]].map(([count, label]) =>
        <div key={label} className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
          <div className="text-2xl font-bold">{count}</div><div className="text-xs sm:text-sm text-gray-500">{label}</div>
        </div>)}
    </div>

    {loading && <p className="mt-6 text-gray-500">Chargement…</p>}
    {error && <p className="mt-6 flex items-center gap-2 text-sm text-red-600"><AlertCircle size={16}/>{error}</p>}
    {!loading && data && rows.length === 0 && <p className="mt-5 rounded-xl border bg-white p-6 text-sm text-gray-600">Aucun intervenant confirmé sur cette mission.</p>}
    <div className="mt-5 space-y-3">
      {rows.map(row => {
        const [label, badge] = STATUS[row.status] || [row.status, "bg-gray-100"];
        const finished = new Date(row.planned_end).getTime() <= Date.now();
        const isBusy = !!busyRow || busy;
        const delta = row.worked_minutes == null ? null : row.worked_minutes - row.expected_minutes;
        const estimated = amount(row);
        return <article key={row.slot_id} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5" data-testid="timesheet-row">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h2 className="font-semibold text-gray-900">{row.worker_name}</h2>
              <p className="mt-1 text-xs text-gray-500">{row.date.split("-").reverse().join("/")} · {row.start_time}–{row.end_time} · {row.pay_type === "fixed" ? "Cachet" : "À l'heure"}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}>{label}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><p className="text-gray-500 text-xs">Prévu</p><strong>{formatHours(row.expected_minutes)}</strong></div>
            <div><p className="text-gray-500 text-xs">Déclaré</p><strong>{formatHours(row.worked_minutes)}</strong></div>
            <div><p className="text-gray-500 text-xs">Écart</p><strong className={delta && delta !== 0 ? "text-amber-700" : ""}>{delta == null ? "—" : `${delta > 0 ? "+" : ""}${formatHours(delta)}`}</strong></div>
            <div><p className="text-gray-500 text-xs">Estimation</p><strong>{estimated == null ? "—" : `${estimated.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`}</strong></div>
          </div>
          {row.started_at && <p className="mt-2 text-xs text-gray-600">Présence déclarée : {formatDate(row.started_at)} → {formatDate(row.ended_at)} · Pause {row.break_minutes} min</p>}
          {row.worker_note && <p className="mt-2 text-xs text-gray-600"><strong>Note :</strong> {row.worker_note}</p>}
          {row.review_note && <p className="mt-2 text-xs text-orange-700"><strong>Correction :</strong> {row.review_note}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {row.status === "not_sent" && <button disabled={!finished || isBusy} onClick={() => send(row)} className="min-h-10 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Envoyer WhatsApp</button>}
            {(row.status === "sent" || row.status === "needs_correction") && <button disabled={isBusy} onClick={() => send(row, true)} className="min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50">Renvoyer le lien</button>}
            {row.status === "submitted" && <>
              <button disabled={isBusy} onClick={() => review(row, "approve")} className="min-h-10 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 inline-flex items-center gap-1"><CheckCircle2 size={14}/> Valider</button>
              <button disabled={isBusy} onClick={() => review(row, "request_correction")} className="min-h-10 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">Demander une correction</button>
            </>}
          </div>
          {row.events?.length > 0 && <details className="mt-3 text-xs text-gray-500"><summary className="cursor-pointer">Historique ({row.events.length})</summary>
            <ul className="mt-2 space-y-1">{row.events.map((event, i) => <li key={i}>{formatDate(event.at)} · {event.action}{event.note ? ` : ${event.note}` : ""}</li>)}</ul>
          </details>}
        </article>;
      })}
    </div>
    <p className="mt-6 flex items-start gap-2 text-xs text-gray-500"><Clock3 size={15} className="shrink-0"/> Les montants sont des estimations indicatives, pas une fiche de paie. Vérifiez les règles contractuelles et de rémunération avant paiement.</p>
  </div>;
}
