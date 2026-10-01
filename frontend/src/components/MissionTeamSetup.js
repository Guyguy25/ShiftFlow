import { counted } from "../lib/french";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, MessageCircle, ArrowRight } from "lucide-react";
import { WhatsAppImportModal } from "../pages/Workers";
import UpgradeModal from "./UpgradeModal";

export default function MissionTeamSetup({ mission, workers, loading, error, onReloadWorkers, shift, onShiftChange, children }) {
  const [connecting, setConnecting] = useState(false);
  const [quotaError, setQuotaError] = useState(null);
  const returnTo = `/app/missions/${mission.id}?step=select&shift=${encodeURIComponent(shift.id)}`;
  const hasWorkers = workers.length > 0;
  return <div className="max-w-2xl mx-auto pb-24" data-testid="mission-team-setup">
    <UpgradeModal open={!!quotaError} onClose={() => setQuotaError(null)} message={quotaError} />
    <p className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 size={18} aria-hidden="true" /> Mission enregistrée</p>
    <h1 className="mt-3 text-[28px] sm:text-3xl font-display font-bold leading-tight">{hasWorkers ? "Préparez votre première demande" : "Ajoutons votre équipe"}</h1>
    <p className="mt-2 text-sm text-gray-600 break-words">{mission.name} · {mission.location}</p>
    <ol className="mt-5 mb-5 flex gap-2 text-xs" aria-label="Préparation de votre équipe">
      {["Mission créée", "Ajouter l’équipe", "Vérifier l’envoi"].map((label, i) => <li key={label} aria-current={i === (hasWorkers ? 2 : 1) ? "step" : undefined} className={`flex-1 border-t-4 pt-2 ${i <= (hasWorkers ? 2 : 1) ? "border-blue-600 text-blue-700" : "border-gray-200 text-gray-500"}`}>{i + 1}. {label}</li>)}
    </ol>
    {error ? <div role="alert" className="rounded-xl border border-red-200 p-4 text-sm text-red-700">{error}<button onClick={onReloadWorkers} className="block min-h-11 underline">Réessayer</button></div> : loading ? <p role="status">Chargement de votre équipe…</p> : connecting ? <WhatsAppImportModal inline onClose={() => setConnecting(false)} onDone={onReloadWorkers} onQuota={setQuotaError} /> : !hasWorkers ? <>
      <section className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
        <MessageCircle className="text-green-600" size={28} aria-hidden="true" />
        <h2 className="mt-3 text-xl font-semibold">Retrouvez vos intervenants sur WhatsApp</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">Connectez votre compte, puis cochez uniquement les contacts à ajouter à votre équipe.</p>
        <button type="button" onClick={() => setConnecting(true)} className="mt-5 w-full min-h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 font-semibold flex justify-center items-center gap-2">Ajouter via WhatsApp <ArrowRight size={18} aria-hidden="true" /></button>
        <p className="mt-3 text-xs text-center leading-relaxed text-gray-500">L’ajout des contacts n’envoie aucune demande.</p>
      </section>
      <p className="mt-4 text-sm leading-relaxed text-gray-600">Ensuite, vous choisirez qui contacter pour ce créneau et vérifierez le message avant l’envoi.</p>
      <details className="mt-4"><summary className="min-h-11 py-3 text-sm cursor-pointer text-gray-600">Ajouter autrement</summary><Link to={`/app/workers?add=1&returnTo=${encodeURIComponent(returnTo)}`} className="inline-flex min-h-11 items-center text-sm underline text-blue-700">Saisir un contact ou utiliser le répertoire du téléphone</Link></details>
    </> : <section className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6">
      <p className="mb-4 text-sm text-emerald-700">Votre équipe est disponible. Sélectionnez les personnes à contacter.</p>
      {(mission.shifts || []).filter(s => !s.slots?.length && s.status !== "cancelled").length > 1 && <label className="block mb-4 text-sm font-medium">Créneau à préparer<select value={shift.id} onChange={e => onShiftChange(e.target.value)} className="mt-2 w-full h-11 border rounded-lg px-3">{mission.shifts.filter(s => !s.slots?.length && s.status !== "cancelled").map(s => <option key={s.id} value={s.id}>{s.date} · {s.start_time} – {s.end_time}</option>)}</select></label>}
      <p className="mb-4 text-sm text-gray-600">{shift.date.split("-").reverse().join("/")} · {shift.start_time} – {shift.end_time} · {counted(shift.people_needed, "personne")}</p>
      {children}
    </section>}
    {!connecting && <Link to={`/app/missions/${mission.id}`} className="inline-flex min-h-11 mt-3 items-center text-sm text-gray-500 underline">Voir les détails de la mission</Link>}
  </div>;
}
