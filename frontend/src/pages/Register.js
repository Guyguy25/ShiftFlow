import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/api";

const QUESTIONS = [
  { key: "team_size", q: "Combien de personnes travaillent en moyenne sur vos missions ?",
    options: ["1-5", "6-15", "16-30", "30+"] },
  { key: "monthly_missions", q: "Combien de missions gérez-vous par mois environ ?",
    options: ["1-3", "4-10", "11-20", "20+"] },
  { key: "current_tool", q: "Comment gérez-vous actuellement les confirmations d'équipe ?",
    options: ["WhatsApp / SMS manuel", "Appels téléphoniques", "Tableur Excel", "Autre outil"] },
];

export default function Register() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [step, setStep] = useState(0); // 0..3 = onboarding, 4 = signup form
  const [answers, setAnswers] = useState({ team_size: "", monthly_missions: "", current_tool: "", main_pain: "" });
  const [form, setForm] = useState({ name: "", agency_name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [loading, setLoading] = useState(false);

  const setA = (k, v) => setAnswers({ ...answers, [k]: v });
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const PHONE_RE = /^\+?\d{8,15}$/;
  const validatePhone = (raw) => {
    const digits = (raw || "").replace(/[\s.\-()]/g, "");
    if (!digits) return ""; // facultatif
    return PHONE_RE.test(digits) ? "" : "Téléphone invalide (ex : +33612345678 ou 0612345678).";
  };
  const totalSteps = QUESTIONS.length + 2; // 3 QCM + 1 pain + 1 signup
  const progress = Math.round(((step + 1) / totalSteps) * 100);

  const canProceed = () => {
    if (step < QUESTIONS.length) return !!answers[QUESTIONS[step].key];
    if (step === QUESTIONS.length) return answers.main_pain.trim().length > 0;
    return false;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const pErr = validatePhone(form.phone);
    setPhoneError(pErr);
    if (pErr) { setLoading(false); return; }
    try {
      await register({ ...form, onboarding_answers: answers });
      nav("/app/dashboard");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  const inputCls = "mt-1 w-full h-11 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const currentQ = step < QUESTIONS.length ? QUESTIONS[step] : null;

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-2">
        <Link to="/" className="flex items-center gap-2" data-testid="register-logo">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center"><Zap className="w-4 h-4 text-white"/></div>
          <span className="font-display font-bold">ShiftFlow</span>
        </Link>
        <span className="ml-auto text-xs text-gray-500">Étape {Math.min(step + 1, totalSteps)}/{totalSteps}</span>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-6 py-10" data-testid="register-page">
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-8" data-testid="register-progress">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
        </div>

        {step > 0 && step <= QUESTIONS.length && (
          <button onClick={()=>setStep(step-1)} data-testid="register-back-btn" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="w-4 h-4"/> Retour
          </button>
        )}

        {currentQ && (
          <div data-testid={`register-step-${step}`}>
            <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Question {step + 1}/{QUESTIONS.length + 1}</div>
            <h1 className="mt-3 text-3xl font-display font-bold tracking-tight">{currentQ.q}</h1>
            <div className="mt-8 space-y-3">
              {currentQ.options.map((opt) => (
                <button key={opt} onClick={()=>setA(currentQ.key, opt)}
                  data-testid={`register-opt-${currentQ.key}-${opt}`}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-colors ${
                    answers[currentQ.key] === opt ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                  }`}>
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
          <div data-testid="register-pain">
            <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Question {step + 1}/{QUESTIONS.length + 1}</div>
            <h1 className="mt-3 text-3xl font-display font-bold tracking-tight">Quel est votre plus gros problème avec la gestion d'équipe actuellement ?</h1>
            <textarea rows={4} data-testid="register-input-pain" value={answers.main_pain}
              onChange={(e)=>setA("main_pain", e.target.value)}
              placeholder="Un mot ou deux phrases suffisent…"
              className="mt-6 w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-blue-600 bg-white"/>
          </div>
        )}

        {step === QUESTIONS.length + 1 && (
          <form onSubmit={submit} data-testid="register-form">
            <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Finalisation</div>
            <h1 className="mt-3 text-3xl font-display font-bold tracking-tight">Créez votre compte gratuit</h1>
            <p className="mt-2 text-gray-600 text-sm">Pas de carte bancaire requise. Compte gratuit permanent.</p>
            <div className="mt-6 space-y-4">
              <div><label className="text-sm font-medium">Nom de l'agence *</label>
                <input required data-testid="register-agency-input" className={inputCls} value={form.agency_name} onChange={setF("agency_name")} placeholder="Mon Agence Event"/></div>
              <div><label className="text-sm font-medium">Votre nom *</label>
                <input required data-testid="register-name-input" className={inputCls} value={form.name} onChange={setF("name")} placeholder="Tanguy Dupont"/></div>
              <div><label className="text-sm font-medium">Email *</label>
                <input type="email" required data-testid="register-email-input" className={inputCls} value={form.email} onChange={setF("email")} placeholder="vous@agence.com"/></div>
              <div><label className="text-sm font-medium">Téléphone</label>
                <input data-testid="register-phone-input" className={inputCls} value={form.phone} onChange={setF("phone")} placeholder="+33612345678"/>
                {phoneError && <div className="text-xs text-red-600 mt-1" data-testid="register-phone-error">{phoneError}</div>}
              </div>
              <div><label className="text-sm font-medium">Mot de passe *</label>
                <input type="password" required minLength={6} data-testid="register-password-input" className={inputCls} value={form.password} onChange={setF("password")} placeholder="Minimum 6 caractères"/></div>
            </div>
            {error && <div className="mt-4 text-sm text-red-600" data-testid="register-error">{error}</div>}
            <button type="submit" disabled={loading} data-testid="register-submit-btn"
              className="mt-6 w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2">
              {loading ? "Création…" : "Créer mon compte gratuit"} <ArrowRight className="w-4 h-4"/>
            </button>
            <div className="mt-4 text-center text-sm text-gray-500">
              Déjà un compte ? <Link to="/login" data-testid="register-login-link" className="text-blue-600 font-medium hover:text-blue-700">Se connecter</Link>
            </div>
          </form>
        )}

        {step <= QUESTIONS.length && (
          <button onClick={()=>setStep(step+1)} disabled={!canProceed()} data-testid="register-next-btn"
            className="mt-8 w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors">
            Suivant <ArrowRight className="w-4 h-4"/>
          </button>
        )}
      </main>
    </div>
  );
}