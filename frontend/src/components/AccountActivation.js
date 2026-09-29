import FirstMissionHelp from "./FirstMissionHelp";
import React from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Check, MessageCircle, Send, Users } from "lucide-react";
import { useActivation } from "../context/ActivationContext";
import ActionCoach from "./ActionCoach";

const icons = [CalendarClock, Users, MessageCircle, Send];

export default function AccountActivation() {
  const activation = useActivation();
  if (!activation?.summary) return <section className="account-activation mt-6" aria-live="polite">
    {activation?.error ? <><p>Votre progression n’a pas pu être chargée.</p><button type="button" onClick={activation.retry} className="mt-2 min-h-11 text-blue-700 underline">Réessayer</button></> : <p className="text-sm text-gray-500">Chargement de vos premiers pas…</p>}
  </section>;
  if (activation.summary.activation?.first_invite_sent) return null;
  const { steps, next } = activation;
  if (!steps?.length || !next) return null;
  const completed = steps.filter(step => step.done).length;
  const currentIndex = next.connect ? 2 : next.href?.startsWith("/app/workers") ? 1 : next.href === "/app/missions/new" ? 0 : next.href === "/pricing" ? -1 : 3;
  const href = next.href || "/app/workers?connect=1";
  return <section className="account-activation mt-6" aria-labelledby="account-activation-title" data-testid="account-activation">
    <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Votre compte est créé · Passons à l’action</p>
    <h2 id="account-activation-title" className="mt-3 text-2xl sm:text-3xl font-display font-bold tracking-tight text-gray-950">{activation.summary.missions_total === 0 ? "Votre première mission vous attend." : "Allons jusqu’à votre première demande."}</h2>
    <p className="mt-3 max-w-2xl text-sm sm:text-base leading-relaxed text-gray-600">{activation.summary.missions_total === 0 ? "Aucune mission pour le moment. Préparez votre besoin, ajoutez votre équipe, puis recevez vos premières réponses dans ShiftFlow." : "Votre espace prend forme. Suivez la prochaine étape pour contacter vos intervenants et centraliser leurs réponses."}</p>
    <div className="mt-6 flex items-center justify-between gap-4 text-sm"><span className="font-medium text-gray-700">Premiers pas</span><span className="shrink-0 font-bold text-blue-700" aria-live="polite">{completed}/4 réalisés</span></div>
    <div className="mt-2 flex gap-2" role="progressbar" aria-label="Actions de démarrage réalisées" aria-valuemin={0} aria-valuemax={4} aria-valuenow={completed}>
      {[0, 1, 2, 3].map(index => <span key={index} className={`h-2 flex-1 rounded-full ${index < completed ? "bg-blue-600" : "bg-blue-100"}`} />)}
    </div>
    <ol className="account-activation-steps">
      {steps.map((step, index) => { const Icon = icons[index]; return <li key={step.id} className={`${step.done ? "is-done" : ""} ${index === currentIndex ? "is-next" : ""}`} aria-current={index === currentIndex ? "step" : undefined}>
        <span className="account-step-icon" aria-hidden="true">{step.done ? <Check size={19} /> : <Icon size={19} />}</span><span><span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">{step.done ? "Terminé" : index === currentIndex ? "À faire maintenant" : `Étape ${index + 1}`}</span><span className="mt-1 block text-sm font-semibold">{step.shortLabel}</span></span>
      </li>; })}
    </ol>
    <ActionCoach key={`${currentIndex}-${href}`} id={`account-${currentIndex}`} step={currentIndex + 1 || undefined} href={href} label={next.label} description={next.description} />
<p className="mt-4 text-sm leading-relaxed text-gray-600">Préparer votre mission n’envoie aucun message. Vous vérifierez les destinataires et le message avant de confirmer les demandes.</p>
    <Link to="/demo" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 underline">Besoin de voir un exemple ? Essayer sans envoi</Link>
    <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-gray-700">Questions sur les contacts et les envois</summary><FirstMissionHelp /></details>
  </section>;
}
