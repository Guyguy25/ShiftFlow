import React from "react";
import { MessageCircle, CalendarClock, Users, CheckCircle2 } from "lucide-react";

const steps = [
  { icon: CalendarClock, title: "Créer une mission", text: "Ajoutez les dates, horaires, le nombre de personnes nécessaires et les informations utiles pour votre équipe." },
  { icon: Users, title: "Choisir les intervenants", text: "Sélectionnez les intervenants et définissez l'ordre de priorité utilisé par la cascade." },
  { icon: MessageCircle, title: "Connecter WhatsApp", text: "Connectez votre compte WhatsApp une seule fois afin que ShiftFlow puisse envoyer les missions et les relances." },
  { icon: CheckCircle2, title: "Laisser ShiftFlow gérer", text: "Les invitations, réponses, relances et rappels sont ensuite centralisés automatiquement." },
];

export default function Tutorial() {
  return (
    <div data-testid="tutorial-page" className="max-w-5xl">
      <div className="text-xs uppercase tracking-widest text-amber-700 font-bold">Tutoriel</div>
      <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Bien démarrer avec ShiftFlow</h1>
      <p className="mt-3 text-gray-600 max-w-2xl">
        Une courte vidéo pour comprendre le fonctionnement de ShiftFlow : créer une mission, connecter WhatsApp, sélectionner les intervenants et lancer la cascade.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-black shadow-sm">
        <video
          className="block w-full aspect-video bg-black object-contain"
          src="/shiftflow-tutorial.mp4"
          controls
          preload="metadata"
          playsInline
          aria-label="Tutoriel de prise en main de ShiftFlow"
        >
          Votre navigateur ne permet pas de lire cette vidéo.
        </video>
      </div>

      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        {steps.map((step, index) => (
          <div key={step.title} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <step.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-gray-400">Étape {index + 1}</div>
                <h2 className="mt-1 font-display font-bold text-lg text-gray-900">{step.title}</h2>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">{step.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
