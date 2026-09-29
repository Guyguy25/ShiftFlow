import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, CalendarClock } from "lucide-react";
import { activationSteps } from "../lib/activation";
import FirstMissionHelp from "./FirstMissionHelp";

export default function ActivationHome({ summary, whatsapp, quota, next }) {
  const steps = activationSteps(summary, whatsapp, quota);
  const fresh = !summary.missions_total;
  const href = next.href || "/app/workers?connect=1";
  return <div className="max-w-2xl mx-auto pb-20" data-testid="activation-home">
    <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Votre première équipe</p>
    <h1 className="mt-3 text-3xl sm:text-4xl font-display font-bold tracking-tight leading-tight">{quota?.trial_expired ? "Reprenez votre préparation" : fresh ? "Pour quelle mission cherchez-vous du renfort ?" : "Votre mission prend forme."}</h1>
    <p className="mt-3 text-base leading-relaxed text-gray-600">{fresh ? "Préparez votre besoin, puis choisissez les personnes à contacter dans votre propre réseau." : "Continuez là où vous en étiez. Vous vérifierez le message avant de lancer les demandes."}</p>
    <section className="mt-6 rounded-2xl border border-blue-200 bg-white p-5 sm:p-7 shadow-sm" aria-label="Votre prochaine action">
      <CalendarClock className="text-blue-600 mb-3" size={28} aria-hidden="true" />
      <h2 className="text-xl font-semibold">{next.label}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{next.description}</p>
      <Link to={href} className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-3.5 font-semibold text-white">{fresh && !quota?.trial_expired ? "Créer ma première mission" : next.label}<ArrowRight size={18} aria-hidden="true" /></Link>
      <p className="mt-3 text-xs text-center leading-relaxed text-gray-500">Aucune demande envoyée à cette étape.</p>
    </section>
    <section className="mt-7" aria-label="Le parcours vers votre premier envoi">
      <h2 className="text-sm font-semibold text-gray-900">Et ensuite ?</h2>
      <ol className="mt-3 space-y-3">{steps.map((step, i) => <li key={step.id} className="flex items-center gap-3 text-sm">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${step.done ? "bg-emerald-100 text-emerald-700" : "bg-blue-50 text-blue-700"}`} aria-hidden="true">{step.done ? <Check size={16} /> : i + 1}</span>
        <span className={step.done ? "text-gray-500" : "text-gray-700"}>{step.done && <span className="sr-only">Terminé : </span>}{step.shortLabel}</span>
      </li>)}</ol>
    </section>
    <details className="mt-6 border-t border-gray-200 pt-2"><summary className="cursor-pointer py-3 text-sm font-medium text-gray-600">Contacts, WhatsApp et envois : comment ça marche ?</summary><FirstMissionHelp /></details>
    <Link to="/demo" className="inline-flex min-h-11 items-center text-sm text-blue-700 underline">Voir un exemple avec des contacts fictifs</Link>
    {quota?.plan === "free" && !quota.trial_started && <p className="mt-3 text-xs leading-relaxed text-gray-500">Votre essai de 30 jours commence à la création de votre première mission.</p>}
  </div>;
}
