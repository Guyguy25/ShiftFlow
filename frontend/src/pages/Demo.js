import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const steps = [
  { title: "Préparez votre demande", description: "Exemple : montage d’un stand, vendredi de 8 h à 12 h. Une personne est nécessaire. Camille sera contactée avant Alex.", status: ["À contacter en premier", "En attente"], action: "Simuler la première demande" },
  { title: "Camille reçoit la demande", description: "Le lien permet d’accepter ou de refuser sans créer de compte. Ici, simulons un refus pour voir ce qui se passe ensuite.", status: ["Demande simulée", "En attente"], action: "Simuler le refus de Camille" },
  { title: "Le suivant est contacté", description: "Camille a refusé. Il reste une place : la demande passe à Alex, selon l’ordre que vous avez choisi.", status: ["Refus simulé", "Demande simulée"], action: "Simuler la confirmation d’Alex" },
  { title: "L’équipe de l’exemple est complète", description: "Alex a accepté : la place est pourvue. Dans une vraie mission, les réponses de vos intervenants déterminent la suite ; une confirmation n’est pas garantie.", status: ["Refus simulé", "Confirmation simulée"], action: null },
];

export default function Demo() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const current = steps[step];
  const completed = step === steps.length - 1;
  return <main className="min-h-screen bg-slate-50 px-5 py-8 text-gray-900" data-testid="mission-demo">
    <div className="mx-auto max-w-2xl">
      <Link to={user ? "/app/dashboard" : "/"} className="inline-flex min-h-11 items-center font-semibold text-blue-700">← Retour à {user ? "mon espace" : "ShiftFlow"}</Link>
      <p className="mt-6 text-xs font-bold uppercase tracking-widest text-blue-700">Démo interactive · aucun envoi réel</p>
      <h1 className="mt-3 text-3xl font-bold">Un refus ? Voyez comment le suivant est contacté.</h1>
      <p className="mt-3 leading-relaxed text-gray-600">Parcourez une demande de mission, du premier message à la confirmation. Contacts fictifs, sans connexion WhatsApp ni envoi réel. Cette démo ne consomme aucune mission.</p>
      {!completed && <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-relaxed text-blue-900">Cliquez pour simuler la demande, le refus de Camille puis la confirmation d’Alex. Dans vos vraies missions, vous choisissez les intervenants de votre propre réseau.</p>}
      {!completed && <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-8">
        <div aria-live="polite" aria-atomic="true"><p className="text-sm text-blue-700">Étape {step + 1} sur {steps.length}</p><h2 className="mt-2 text-xl font-bold">{current.title}</h2><p className="mt-3 leading-relaxed text-gray-600">{current.description}</p>
          <ol className="my-5 space-y-3">{["Camille", "Alex"].map((name, index) => <li key={name} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3"><span className="font-semibold">{index + 1}. {name} · fictif</span><span className="text-sm">{current.status[index]}</span></li>)}</ol>
        </div>
        <details className="rounded-lg border border-gray-200 p-3"><summary className="cursor-pointer font-semibold">Voir un exemple de message</summary><p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{`Bonjour ${step < 2 ? "Camille" : "Alex"} 👋\n\nVotre organisation vous propose une mission de montage, vendredi de 8 h à 12 h.\n\n[Informations de la mission et lien pour accepter ou refuser]`}</p><p className="mt-2 text-xs text-gray-500">Exemple illustratif. Dans votre mission, l’aperçu utilise vos informations et le modèle de votre compte.</p></details>
        {current.action && <button type="button" onClick={() => setStep(value => Math.min(steps.length - 1, value + 1))} className="mt-5 min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">{current.action}</button>}
      </section>}
      {completed ? <section aria-labelledby="demo-success-title" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-8" data-testid="demo-success">
        <CheckCircle2 size={32} className="text-emerald-700" aria-hidden="true"/>
        <p className="mt-3 text-sm font-semibold text-emerald-800">L’équipe de l’exemple est complète.</p>
        <h2 id="demo-success-title" className="mt-4 text-2xl font-bold tracking-tight">Vous avez vu comment une place se remplit après un refus.</h2>
        <p className="mt-3 leading-relaxed text-gray-700">{user ? "Passez maintenant à une vraie mission avec votre propre équipe. Vous vérifiez le message et les destinataires avant de confirmer l’envoi." : "Essayez maintenant avec votre propre équipe : vos trois premières missions sont offertes, sans carte bancaire ni date limite."}</p>
        <Link to={user ? "/app/missions/new" : "/register"} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-center font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600" data-testid="demo-success-cta">{user ? "Préparer ma vraie mission" : "Créer ma première mission"}<ArrowRight size={18} className="shrink-0" aria-hidden="true"/></Link>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">{user ? "La disponibilité dépend des réponses de vos intervenants." : "Créez votre compte, préparez votre mission, puis connectez WhatsApp pour envoyer vos demandes. Aucun envoi sans votre confirmation."}</p>
      </section> : <Link to={user ? "/app/missions/new" : "/register"} className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 underline underline-offset-4">{user ? "Préparer directement ma vraie mission" : "Déjà convaincu ? Créer mon compte gratuit"}</Link>}
      {step > 0 && <button type="button" onClick={() => setStep(0)} className="mt-3 min-h-11 text-sm font-semibold text-blue-700">Recommencer la simulation</button>}
      <p className="mt-3 text-sm leading-relaxed text-gray-500">Scénario illustratif. Le remplissage d’une vraie mission dépend des réponses de votre réseau ; aucune confirmation n’est garantie.</p>
    </div>
  </main>;
}

