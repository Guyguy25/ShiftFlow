import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/api";
import { LEGAL_VERSION } from "../constants/legal";

const QUESTIONS = [
  { key: "team_size", q: "Combien d’intervenants mobilisez-vous en moyenne par mission ?",
    options: ["1-5", "6-15", "16-30", "31+"] },
  { key: "monthly_missions", q: "En moyenne, combien de missions gérez-vous chaque mois ?",
    options: ["1-3", "4-10", "11-20", "21+"] },
  { key: "current_tool", q: "Comment confirmez-vous aujourd’hui la disponibilité de vos intervenants ?",
    options: ["WhatsApp / SMS manuellement", "Appels téléphoniques", "Excel / Google Sheets", "Outil de planning / staffing", "Au cas par cas"] },
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

export default function Register() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ team_size: "", monthly_missions: "", current_tool: "", main_pain: [] });
  const [form, setForm] = useState({ name: "", agency_name: "", email: "", phone: "", password: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);

  const setA = (k, v) => setAnswers((prev) => ({ ...prev, [k]: v }));
  const togglePain = (pain) => {
    setAnswers((prev) => ({
      ...prev,
      main_pain: prev.main_pain.includes(pain)
        ? prev.main_pain.filter((item) => item !== pain)
        : [...prev.main_pain, pain],
    }));
  };
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isPhoneValid = (raw) => {
    const digits = (raw || "").replace(/[\s.\-()]/g, "");
    if (!digits) return true;
    if (digits.startsWith("+33")) return /^\+33[1-9]\d{8}$/.test(digits);
    if (digits.startsWith("0")) return /^0[1-9]\d{8}$/.test(digits);
    if (digits.startsWith("+")) return /^\+\d{10,15}$/.test(digits);
    return false;
  };
  const validatePhone = (raw) => {
    if (isPhoneValid(raw)) return "";
    return "Téléphone invalide (ex : +33612345678 ou 0612345678).";
  };
  const validatePassword = (raw) => {
    const v = raw || "";
    if (v.length < 8 || !/[A-Za-z]/.test(v) || !/\d/.test(v)) {
      return "8 caractères minimum, avec au moins une lettre et un chiffre.";
    }
    return "";
  };
  const totalSteps = QUESTIONS.length + 2;
  const progress = Math.round(((step + 1) / totalSteps) * 100);

  const canProceed = () => {
    if (step < QUESTIONS.length) return !!answers[QUESTIONS[step].key];
    if (step === QUESTIONS.length) return answers.main_pain.length > 0;
    return false;
  };

  const readCookie = (name) => {
    const prefix = `${name}=`;
    const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
    return item ? decodeURIComponent(item.slice(prefix.length)) : "";
  };

  const readMetaAttribution = () => {
    try {
      return JSON.parse(localStorage.getItem("shiftflow_meta_attribution") || "null");
    } catch {
      return null;
    }
  };

  const buildFallbackFbc = (attribution) => {
    if (!attribution?.fbclid) return "";
    const captured = Date.parse(attribution.captured_at || "") || Date.now();
    return `fb.1.${Math.floor(captured / 1000)}.${attribution.fbclid}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!acceptedTerms) {
      setError("Vous devez accepter les Conditions et la Politique de confidentialité pour créer votre compte.");
      return;
    }
    setLoading(true);
    const pErr = validatePhone(form.phone);
    setPhoneError(pErr);
    const pwErr = validatePassword(form.password);
    setPasswordError(pwErr);
    if (pErr || pwErr) { setLoading(false); return; }
    const acceptedAt = new Date().toISOString();
    try {
      const metaConsent = localStorage.getItem("shiftflow_cookie_consent") === "accepted";
      const metaAttribution = metaConsent ? readMetaAttribution() : null;
      const metaFbp = metaConsent ? readCookie("_fbp") : "";
      const metaFbc = metaConsent ? (readCookie("_fbc") || buildFallbackFbc(metaAttribution)) : "";

      await register({
        ...form,
        onboarding_answers: {
          ...answers,
          main_pain: answers.main_pain.join(" | "),
        },
        legal_acceptance: { version: LEGAL_VERSION, accepted_at: acceptedAt, scope: "account" },
        meta_consent: metaConsent,
        meta_attribution: metaAttribution,
        meta_fbp: metaFbp || null,
        meta_fbc: metaFbc || null,
      });
      localStorage.setItem("shiftflow_legal_acceptance", JSON.stringify({ version: LEGAL_VERSION, acceptedAt, scope: "account" }));
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

        {step <= QUESTIONS.length && <button type="button" onClick={() => setStep(QUESTIONS.length + 1)} className="mb-5 text-sm text-blue-700 underline">Passer ces questions facultatives et créer mon compte</button>}
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
            <h1 className="mt-3 text-3xl font-display font-bold tracking-tight">Quels problèmes rencontrez-vous le plus souvent dans la gestion de vos équipes ?</h1>
            <p className="mt-3 text-sm text-gray-500">Vous pouvez en sélectionner plusieurs.</p>
            <div className="mt-6 space-y-3">
              {PAIN_OPTIONS.map((pain) => {
                const selected = answers.main_pain.includes(pain);
                return (
                  <button
                    key={pain}
                    type="button"
                    onClick={() => togglePain(pain)}
                    data-testid={`register-pain-${pain}`}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-colors ${
                      selected ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
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
          <form onSubmit={submit} data-testid="register-form" autoComplete="on">
            <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Finalisation</div>
            <h1 className="mt-3 text-3xl font-display font-bold tracking-tight">Démarrez votre essai gratuit</h1>
            <p className="mt-2 text-gray-600 text-sm">30 jours gratuits à partir de votre première mission · 3 missions · jusqu’à 30 intervenants · aucune carte bancaire requise.</p>
            <div className="mt-6 space-y-4">
              <div><label className="text-sm font-medium">Nom de l'agence *</label>
                <input required data-testid="register-agency-input" className={inputCls} value={form.agency_name} onChange={setF("agency_name")} placeholder="Mon Agence Event"/></div>
              <div><label className="text-sm font-medium">Votre nom *</label>
                <input required data-testid="register-name-input" className={inputCls} value={form.name} onChange={setF("name")} placeholder="Tanguy Dupont"/></div>
              <div><label className="text-sm font-medium">Email *</label>
                <input type="email" name="email" autoComplete="username" required data-testid="register-email-input" className={inputCls} value={form.email} onChange={setF("email")} placeholder="vous@agence.com"/></div>
              <div><label className="text-sm font-medium">Téléphone *</label>
                <input required data-testid="register-phone-input" className={inputCls} value={form.phone} onChange={setF("phone")} placeholder="+33612345678"/>
                {phoneError && <div className="text-xs text-red-600 mt-1" data-testid="register-phone-error">{phoneError}</div>}
              </div>
              <div><label className="text-sm font-medium">Mot de passe *</label>
                <input type="password" name="new-password" autoComplete="new-password" required minLength={8} data-testid="register-password-input" className={inputCls} value={form.password} onChange={setF("password")} placeholder="Minimum 8 caractères, 1 lettre + 1 chiffre"/>
                {passwordError && <div className="text-xs text-red-600 mt-1" data-testid="register-password-error">{passwordError}</div>}</div>
            </div>

            <label className="mt-5 flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 cursor-pointer" data-testid="register-legal-consent">
              <input type="checkbox" required checked={acceptedTerms} onChange={(e)=>setAcceptedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span>
                J'ai lu et j'accepte les <Link to="/conditions" target="_blank" className="text-blue-600 font-medium hover:underline">Conditions générales d'utilisation et de vente</Link>
                {" "}et la <Link to="/confidentialite" target="_blank" className="text-blue-600 font-medium hover:underline">Politique de confidentialité</Link>.
              </span>
            </label>

            {error && <div className="mt-4 text-sm text-red-600" data-testid="register-error">{error}</div>}
            <button type="submit" disabled={loading || !acceptedTerms} data-testid="register-submit-btn"
              className="mt-6 w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2">
              {loading ? "Création…" : "Créer mon compte gratuitement"} <ArrowRight className="w-4 h-4"/>
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