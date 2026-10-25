import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calculator, CheckCircle2 } from "lucide-react";
import { PLAN_OFFERS } from "../lib/billingConfig";
import { pricingRecommendation } from "../lib/pricingRecommendation";
import { estimateLandingVolume, formatLandingTime } from "../lib/landingVolume";

const number = (value) => new Intl.NumberFormat("fr-FR").format(value);
const euros = (value) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

function RangeField({ id, label, value, onChange, min, max }) {
  return <div>
    <label htmlFor={id} className="mb-3 flex items-center justify-between gap-4 text-sm font-semibold text-slate-800">
      <span>{label}</span><output htmlFor={id} className="text-xl font-bold tabular-nums text-blue-700">{value}</output>
    </label>
    <input id={id} type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))}
      className="h-10 w-full cursor-pointer accent-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" />
    <div className="flex justify-between text-xs text-slate-500"><span>{min}</span><span>{max}</span></div>
  </div>;
}

export default function LandingVolumeCalculator() {
  const [missions, setMissions] = useState(10);
  const [people, setPeople] = useState(15);
  const [refusals, setRefusals] = useState(3);
  const offer = PLAN_OFFERS.find(plan => plan.key === pricingRecommendation({monthly_missions: missions}).tier);
  const volume = estimateLandingVolume({ missions, people, refusals });

  return <section id="calculateur" className="scroll-mt-24 border-y border-slate-200 bg-slate-50 py-16 sm:py-20" aria-labelledby="landing-calculator-title">
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-700"><Calculator size={16} aria-hidden="true" /> Votre activité, en chiffres</p>
        <h2 id="landing-calculator-title" className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Combien de sollicitations gérez-vous chaque mois ?</h2>
        <p className="mt-4 text-base leading-relaxed text-slate-600">Réglez les curseurs selon vos missions. Visualisez les demandes et rappels qu'il faudrait gérer manuellement.</p>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <div className="space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <RangeField id="landing-missions" label="Missions par mois" min={1} max={30} value={missions} onChange={setMissions} />
          <RangeField id="landing-people" label="Personnes à confirmer par mission" min={5} max={40} value={people} onChange={setPeople} />
          <RangeField id="landing-refusals" label="Refus ou désistements par mission" min={0} max={10} value={refusals} onChange={setRefusals} />
        </div>
        <div className="flex flex-col rounded-2xl border border-blue-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium text-slate-600">Actions répétitives potentielles par mois</p>
          <p className="mt-2 text-5xl font-bold tabular-nums tracking-tight text-blue-700 sm:text-6xl" role="status" aria-live="polite" data-testid="landing-volume-total">{number(volume.actions)}</p>
          <p className="mt-2 text-sm text-slate-600">sollicitations, remplacements et rappels cumulés</p>
          <dl className="mt-7 divide-y divide-slate-100 text-sm">
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-slate-600">Propositions initiales</dt><dd className="font-bold tabular-nums">{number(volume.initialRequests)}</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-slate-600">Demandes de remplacement</dt><dd className="font-bold tabular-nums">{number(volume.replacementRequests)}</dd></div>
            <div className="flex items-center justify-between gap-3 py-3"><dt className="text-slate-600">Rappels la veille</dt><dd className="font-bold tabular-nums">{number(volume.reminders)}</dd></div>
          </dl>
          <div className="mt-5 rounded-xl bg-blue-50 p-4">
            <p className="flex items-start gap-2 text-sm font-semibold text-blue-900"><CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />Soit environ {formatLandingTime(volume.estimatedMinutes)} de gestion manuelle, sur l'hypothèse d'une minute par action.</p>
          </div>
          <div className="mt-auto pt-6">
            <Link to="/register" data-testid="landing-calculator-cta" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700">Tester ShiftFlow sur mes 3 premières missions <ArrowRight size={17} aria-hidden="true" /></Link>
            <p className="mt-3 text-center text-xs text-slate-600">{offer.name} à {offer.monthly} €/mois, soit {euros(offer.monthly / missions)} par mission avec ce volume. <Link to="/pricing" className="font-semibold text-blue-700 underline underline-offset-2">Voir les 3 offres</Link></p>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-5 max-w-4xl text-center text-xs leading-relaxed text-slate-600">Estimation illustrative et non une mesure de votre activité : une proposition par poste, une sollicitation supplémentaire par refus ou désistement et un rappel par personne confirmée. La minute par action est une hypothèse de calcul, pas un gain de temps garanti. Les volumes réels varient.</p>
    </div>
  </section>;
}
