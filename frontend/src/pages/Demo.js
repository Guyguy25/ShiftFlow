import React, { useState } from "react";
import { Link } from "react-router-dom";
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
  return <main className="min-h-screen bg-slate-50 px-5 py-8 text-gray-900" data-testid="mission-demo">
    <div className="mx-auto max-w-2xl">
      <Link to={user ? "/app/dashboard" : "/"} className="inline-flex min-h-11 items-center font-semibold text-blue-700">← Retour à {user ? "mon espace" : "ShiftFlow"}</Link>
      <p className="mt-6 text-xs font-bold uppercase tracking-widest text-blue-700">Simulation · aucun envoi réel</p>
      <h1 className="mt-3 text-3xl font-bold">Découvrez votre première cascade</h1>
      <p className="mt-3 leading-relaxed text-gray-600">Contacts fictifs, sans connexion WhatsApp. Cette démonstration ne crée aucune mission, ne consomme aucun quota et ne consomme aucune mission offerte.</p>
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-8">
        <div aria-live="polite" aria-atomic="true"><p className="text-sm text-blue-700">Étape {step + 1} sur {steps.length}</p><h2 className="mt-2 text-xl font-bold">{current.title}</h2><p className="mt-3 leading-relaxed text-gray-600">{current.description}</p>
          <ol className="my-5 space-y-3">{["Camille", "Alex"].map((name, index) => <li key={name} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3"><span className="font-semibold">{index + 1}. {name} · fictif</span><span className="text-sm">{current.status[index]}</span></li>)}</ol>
        </div>
        <details className="rounded-lg border border-gray-200 p-3"><summary className="cursor-pointer font-semibold">Voir un exemple de message</summary><p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{`Bonjour ${step < 2 ? "Camille" : "Alex"} 👋\n\nVotre organisation vous propose une mission de montage, vendredi de 8 h à 12 h.\n\n[Informations de la mission et lien pour accepter ou refuser]`}</p><p className="mt-2 text-xs text-gray-500">Exemple illustratif. Dans votre mission, l’aperçu utilise vos informations et le modèle de votre compte.</p></details>
        {current.action && <button type="button" onClick={() => setStep(value => Math.min(steps.length - 1, value + 1))} className="mt-5 min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">{current.action}</button>}
        {step > 0 && <button type="button" onClick={() => setStep(0)} className="mt-3 min-h-11 text-sm font-semibold text-blue-700">Recommencer la simulation</button>}
      </section>
      <Link to={user ? "/app/missions/new" : "/register"} className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-gray-900 px-5 py-3 font-semibold text-white">{user ? "Préparer ma vraie mission" : "Créer mon compte gratuitement"}</Link>
      <p className="mt-3 text-sm text-gray-600">Pour une vraie mission, utilisez votre réseau d’intervenants. La création utilise une de vos missions offertes ; l’envoi des demandes se confirme séparément.</p>
    </div>
  </main>;
}

