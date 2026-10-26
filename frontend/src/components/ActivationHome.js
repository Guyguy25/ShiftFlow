import React, { useEffect } from "react";
import { trackActivation } from "../lib/activationTracking";
import { Link } from "react-router-dom";
import { ArrowRight, Check, CalendarClock, Users, MessageCircle, PlayCircle, ShieldCheck } from "lucide-react";
import { activationSteps } from "../lib/activation";
import FirstMissionHelp from "./FirstMissionHelp";
import ActivationReasonPrompt from "./ActivationReasonPrompt";

const icons = { mission: CalendarClock, workers: Users, whatsapp: MessageCircle, invite: ShieldCheck };

export default function ActivationHome({ summary, whatsapp, quota, next }) {
  useEffect(() => { trackActivation("activation_home_viewed"); }, []);
  const steps = activationSteps(summary, whatsapp, quota);
  const done = steps.filter(step => step.done).length;
  const fresh = !summary.missions_total;
  const href = next.href || "/app/workers?connect=1";
  const progress = steps.length ? Math.round(done / steps.length * 100) : 0;
  return <div className="mx-auto max-w-3xl pb-20" data-testid="activation-home">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Votre première équipe</p>
      <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">Mise en route · {done}/{steps.length || 4}</span>
    </div>
    <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{quota?.trial_expired ? "Reprenez votre préparation" : fresh ? "Votre première équipe, sans relances à la main." : "Vous y êtes presque."}</h1>
    <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600">
      {fresh ? "Préparez une mission, choisissez vos intervenants et lancez vos premières demandes depuis WhatsApp. Vous validez toujours l'envoi." : "Votre travail est sauvegardé. Reprenez exactement à la prochaine étape pour lancer vos demandes."}
    </p>
    <section className="mt-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-7" aria-label="Votre prochaine action">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><CalendarClock size={23} aria-hidden="true"/></span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">À faire maintenant</p>
          <h2 className="mt-1 text-xl font-bold text-gray-950">{next.label}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{next.description}</p>
        </div>
      </div>
      <Link onClick={() => trackActivation("activation_cta_clicked")} data-onboarding={fresh ? "start" : "resume"} to={href} className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-center font-semibold text-white transition hover:bg-blue-700" data-testid="activation-next">
        {fresh && !quota?.trial_expired ? "Créer ma première mission" : next.label}<ArrowRight size={18} aria-hidden="true"/>
      </Link>
      <p className="mt-3 text-center text-xs text-gray-500">{fresh ? "Créer une mission n'envoie aucun message et ne déclenche aucun paiement." : "Vous gardez toujours le contrôle du premier envoi."}</p>
    </section>
    <section className="mt-7 rounded-2xl border border-gray-200 bg-white p-5 sm:p-7" aria-label="Le parcours vers votre première invitation">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-gray-950">Votre parcours de démarrage</h2>
        <span className="text-sm font-semibold text-gray-600">{progress} %</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="Progression vers votre premier envoi" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: progress + "%" }} />
      </div>
      <ol className="mt-5 grid gap-2">
        {steps.map((step, i) => {
          const Icon = icons[step.id] || Check;
          const current = !step.done && steps.findIndex(item => !item.done) === i;
          return <li key={step.id} className={"flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 " + (step.done ? "border-emerald-100 bg-emerald-50/40" : current ? "border-blue-200 bg-blue-50/70" : "border-gray-100 bg-white")}>
            <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-full " + (step.done ? "bg-emerald-100 text-emerald-700" : current ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500")}>{step.done ? <Check size={18} aria-hidden="true"/> : <Icon size={18} aria-hidden="true"/>}</span>
            <div className="min-w-0 flex-1"><p className={"text-sm font-semibold " + (step.done ? "text-gray-600" : "text-gray-900")}>{step.shortLabel}</p>{current && <p className="mt-0.5 text-xs text-blue-700">Votre prochaine étape</p>}</div>
            <span className={"shrink-0 text-xs font-semibold " + (step.done ? "text-emerald-700" : current ? "text-blue-700" : "text-gray-400")}>{step.done ? "Fait" : i + 1 + "/" + steps.length}</span>
          </li>;
        })}
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-gray-500">Une fois les invitations envoyées, suivez les réponses sur votre mission. Un envoi n'est pas encore une confirmation.</p>
    </section>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-sm text-gray-700">Vous voulez comprendre la cascade avant de vous lancer ?</p>
      <Link to="/demo" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 underline underline-offset-2"><PlayCircle size={18} aria-hidden="true"/> Tester avec des contacts fictifs</Link>
    </div>
    <details className="mt-6 border-t border-gray-200 pt-2"><summary className="cursor-pointer py-3 text-sm font-medium text-gray-600">Contacts, WhatsApp et envois : comment ça marche ?</summary><FirstMissionHelp /></details>
    {quota?.plan === "free" && !quota.trial_started && <p className="mt-3 text-xs leading-relaxed text-gray-500">Vos 3 premières missions sont offertes, sans carte bancaire et sans limite de temps.</p>}
    <ActivationReasonPrompt />
  </div>;
}
