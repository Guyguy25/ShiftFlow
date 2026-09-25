import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Zap } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const QUESTIONS = [
  {
    key: "team_size",
    q: "Combien d’intervenants mobilisez-vous en moyenne par mission ?",
    options: ["1-5", "6-15", "16-30", "31+"],
  },
  {
    key: "monthly_missions",
    q: "En moyenne, combien de missions gérez-vous chaque mois ?",
    options: ["1-3", "4-10", "11-20", "21+"],
  },
  {
    key: "current_tool",
    q: "Comment confirmez-vous aujourd’hui la disponibilité de vos intervenants ?",
    options: [
      "WhatsApp / SMS manuellement",
      "Appels téléphoniques",
      "Excel / Google Sheets",
      "Outil de planning / staffing",
      "Au cas par cas",
    ],
  },
];

const PAIN_OPTIONS = [
  "Relancer les intervenants pour obtenir une réponse",
  "Gérer les annulations de dernière minute",
  "Trouver rapidement un remplaçant",
  "Savoir qui est disponible pour une mission",
  "Suivre les confirmations et les refus",
  "Passer trop de temps sur WhatsApp / les appels",
  "Éviter les absences non prévenues",
];

export default function Onboarding() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    team_size: "",
    monthly_missions: "",
    current_tool: "",
    main_pain: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setA = (k, v) => setAnswers((prev) => ({ ...prev, [k]: v }));

  const togglePain = (pain) => {
    setAnswers((prev) => ({
      ...prev,
      main_pain: prev.main_pain.includes(pain)
        ? prev.main_pain.filter((item) => item !== pain)
        : [...prev.main_pain, pain],
    }));
  };

  const next = async () => {
    if (step < QUESTIONS.length - 1) {
      if (!answers[QUESTIONS[step].key]) return;
      setStep(step + 1);
    } else if (step === QUESTIONS.length - 1) {
      if (!answers[QUESTIONS[step].key]) return;
      setStep(step + 1);
    } else if (step === QUESTIONS.length) {
      if (answers.main_pain.length === 0) return;
      setStep(step + 1);
    } else {
      setSaving(true);
      try {
        await api.post("/onboarding", {
          ...answers,
          main_pain: answers.main_pain.join(" | "),
        });
        await refresh();
        nav("/app/dashboard");
      } catch (err) {
        setError(formatApiError(err.response?.data?.detail) || err.message);
      } finally {
        setSaving(false);
      }
    }
  };

  const totalSteps = QUESTIONS.length + 2;
  const currentStepLabel = step < QUESTIONS.length + 1
    ? `Question ${step + 1}/${QUESTIONS.length + 1}`
    : "Prêt à démarrer";
  const progress = Math.min(100, Math.round(((step + 1) / totalSteps) * 100));
  const currentQ = step < QUESTIONS.length ? QUESTIONS[step] : null;

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white"/>
        </div>
        <span className="font-display font-bold">ShiftFlow</span>
        <span className="ml-auto text-xs text-gray-500">Bienvenue</span>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-6 py-10" data-testid="onboarding-page">
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-8" data-testid="onboarding-progress">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }}/>
        </div>

        {currentQ && (
          <div data-testid={`onboarding-step-${step}`}>
            <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">{currentStepLabel}</div>
            <h1 className="mt-3 text-3xl font-display font-bold tracking-tight">{currentQ.q}</h1>
            <div className="mt-8 space-y-3">
              {currentQ.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setA(currentQ.key, opt)}
                  data-testid={`onboarding-opt-${currentQ.key}-${opt}`}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-colors ${
                    answers[currentQ.key] === opt
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{opt}</span>
                    {answers[currentQ.key] === opt && <Check className="w-5 h-5 text-blue-600"/>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === QUESTIONS.length && (
          <div data-testid="onboarding-pain">
            <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">{currentStepLabel}</div>
            <h1 className="mt-3 text-3xl font-display font-bold tracking-tight">
              Quels problèmes rencontrez-vous le plus souvent dans la gestion de vos équipes ?
            </h1>
            <p className="mt-3 text-sm text-gray-500">Vous pouvez en sélectionner plusieurs.</p>

            <div className="mt-6 space-y-3">
              {PAIN_OPTIONS.map((pain) => {
                const selected = answers.main_pain.includes(pain);
                return (
                  <button
                    key={pain}
                    onClick={() => togglePain(pain)}
                    data-testid={`onboarding-pain-${pain}`}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-colors ${
                      selected
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">{pain}</span>
                      {selected && <Check className="w-5 h-5 text-blue-600 shrink-0"/>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === QUESTIONS.length + 1 && (
          <div className="text-center" data-testid="onboarding-final">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-600 flex items-center justify-center">
              <Check className="w-8 h-8 text-white"/>
            </div>
            <h1 className="mt-6 text-3xl font-display font-bold tracking-tight">Vous êtes prêt !</h1>
            <p className="mt-3 text-gray-600">Votre compte gratuit ShiftFlow est prêt. Créez votre première mission dès maintenant.</p>
            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-gray-700 text-left">
              <div className="font-semibold text-blue-900 mb-1">Plan gratuit — sans limite de temps</div>
              <ul className="space-y-1 text-gray-700">
                <li>• 1 mission active max</li>
                <li>• 10 intervenants max</li>
                <li>• Toutes les fonctionnalités : cascade, SMS, dashboard</li>
              </ul>
            </div>
          </div>
        )}

        {error && <div className="mt-4 text-sm text-red-600" data-testid="onboarding-error">{error}</div>}

        <div className="mt-8">
          <button
            onClick={next}
            disabled={
              saving ||
              (currentQ && !answers[currentQ.key]) ||
              (step === QUESTIONS.length && answers.main_pain.length === 0)
            }
            data-testid="onboarding-next-btn"
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors"
          >
            {step === QUESTIONS.length + 1 ? (saving ? "Création…" : "Créer mon compte gratuit") : "Suivant"}
            <ArrowRight className="w-4 h-4"/>
          </button>
        </div>
      </main>
    </div>
  );
}
