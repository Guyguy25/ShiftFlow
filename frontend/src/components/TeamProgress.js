import React from "react";

// The initial confirmations belong only to the explicitly fictional scenario.
export default function TeamProgress({ complete = false }) {
  const confirmed = complete ? 15 : 14;
  return <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <strong>Équipe road · 15 personnes</strong>
      <span className={complete ? "font-semibold text-emerald-700" : "font-semibold text-blue-700"}>{confirmed}/15 confirmés</span>
    </div>
    <div role="progressbar" aria-label="Confirmations de l’équipe fictive" aria-valuemin={0} aria-valuemax={15} aria-valuenow={confirmed} className="mt-3 flex gap-1">
      {Array.from({ length: 15 }, (_, i) => <span key={i} className={`h-2 min-w-0 flex-1 rounded-full ${i < confirmed ? "bg-emerald-500" : "bg-slate-300"}`} />)}
    </div>
    <p className="mt-2 text-xs leading-relaxed text-slate-600">{complete ? "La dernière réponse complète l’équipe de cet exemple." : "Scénario fictif : 14 personnes ont déjà confirmé. Suivez la dernière place ci-dessous."}</p>
  </div>;
}
