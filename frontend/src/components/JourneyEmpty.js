import React from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Users, Check, ArrowRight, MessageCircle } from "lucide-react";
import { useActivation } from "../context/ActivationContext";

export default function JourneyEmpty({ kind = "mission", onAction }) {
  const activation = useActivation();
  const team = kind === "team";
  const returning = activation?.summary?.missions_total > 0;
  const title = team ? "Votre prochaine équipe commence ici." : returning ? "Préparez votre prochaine équipe." : "Bientôt, votre première équipe confirmée.";
  const description = team ? "Ajoutez vos intervenants une seule fois. Vous pourrez ensuite leur proposer vos missions et suivre leurs réponses au même endroit." : "Créez votre mission, choisissez les personnes à contacter et retrouvez leurs confirmations ici. Vous saurez qui vient, sans multiplier les relances.";
  const label = team
    ? "Ajouter mes intervenants"
    : activation?.next?.label || (returning ? "Créer une nouvelle mission" : "Créer ma première mission");
  const href = team ? "/app/workers?add=1" : activation?.next?.connect ? "/app/workers?connect=1" : activation?.next?.href || "/app/missions/new";
  return <section className="journey-empty" data-testid={`journey-empty-${kind}`}>
    <div className="journey-illustration" aria-hidden="true">
      <span className="journey-mini"><CalendarClock size={22} /><span>Votre mission</span></span><span className="journey-line" />
      <span className="journey-mini"><Users size={22} /><span>Votre équipe</span></span><span className="journey-line" />
      <span className="journey-mini journey-result"><Check size={22} /><span>Confirmations</span></span>
    </div>
    <span className="text-[11px] font-bold uppercase tracking-widest text-blue-700">Un premier pas, moins de relances</span>
    <h2 className="mt-3 font-display text-xl sm:text-2xl font-bold text-gray-950">{title}</h2>
    <p className="mx-auto mt-3 max-w-lg text-sm sm:text-base leading-relaxed text-gray-600">{description}</p>
    {onAction ? <button type="button" onClick={onAction} data-onboarding={team ? "workers" : "start"} className="journey-action">{label}<ArrowRight size={17} /></button> : <Link to={href} data-onboarding={team ? "workers" : "start"} className="journey-action">{label}<ArrowRight size={17} /></Link>}
    <p className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500"><MessageCircle size={14} />Vous choisissez quand envoyer vos demandes.</p>
    <Link to="/app/help" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-blue-700 underline underline-offset-4">Besoin d’un coup de main ?</Link>
  </section>;
}

