import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useAuth } from "../context/AuthContext";
import { API, api, markLoggedOut, formatApiError } from "../lib/api";
import { LEGAL_VERSION } from "../constants/legal";
import { DRAFT_KEY, readDraft, newDraftToken, draftSnapshot, sendDraft } from "../lib/registrationDraft";
import { registrationSavings } from "../lib/registrationSavings";

const number = value => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
const euros = value => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
const titles = ["Créez votre compte", "Parlons de vos événements", "Du temps pour l’essentiel."];

export default function Register() {
  const nav = useNavigate();
  const { register, refresh } = useAuth();
  const [initial] = useState(readDraft);
  const [token] = useState(() => initial?.token || newDraftToken());
  // Credentials are never restored from storage; a reload returns to step one.
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ email: initial?.form?.email || "", password: "" });
  const [answers, setAnswers] = useState({ annual_events: initial?.answers?.annual_events || 30, people_per_mission: initial?.answers?.people_per_mission || 15 });
  const [googleCredential, setGoogleCredential] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const finished = useRef(false);
  const heading = useRef(null);
  const latest = useRef(null);
  const queue = useRef(Promise.resolve());
  const previousStep = useRef(null);
  const savings = registrationSavings(answers.annual_events, answers.people_per_mission);
  const safeFormKey = JSON.stringify({ email: form.email });
  const answersKey = JSON.stringify(answers);
  useEffect(() => {
    const snapshot = draftSnapshot(token, step, JSON.parse(safeFormKey), JSON.parse(answersKey));
    latest.current = snapshot;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot)); } catch {}
    const stepChanged = previousStep.current !== step;
    previousStep.current = step;
    const timer = setTimeout(() => {
      queue.current = queue.current.catch(() => {}).then(async () => {
        if (finished.current || (!stepChanged && latest.current !== snapshot)) return;
        try {
          await sendDraft(snapshot);
        } catch {
        }
      });
    }, stepChanged ? 0 : 800);
    return () => clearTimeout(timer);
  }, [token, step, safeFormKey, answersKey]);
  useEffect(() => {
    const flush = () => {
      if (finished.current || !latest.current) return;
      const snapshot = latest.current;
      fetch(`${API}/registration/draft`, { method: "PUT", credentials: "include", keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: snapshot.token, step: snapshot.step, revision: snapshot.updatedAt, fields: snapshot.form, answers: snapshot.answers }) }).catch(() => {});
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);
  function validateCredentials() {
    if (googleCredential) return true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Indiquez une adresse email valide."); return false;
    }
    if (form.password.length < 8 || !/[0-9]/.test(form.password) || !Array.from(form.password).some(c => c.toLowerCase() !== c.toUpperCase())) {
      setError("Choisissez un mot de passe de 8 caractères minimum, avec une lettre et un chiffre."); return false;
    }
    return true;
  }
  function googleSelected(credential) {
    setGoogleCredential(credential);
    setForm(previous => ({ ...previous, password: "" }));
    setStep(1);
  }
  function attribution() {
    try {
      if (localStorage.getItem("shiftflow_cookie_consent") !== "accepted") return {};
      const cookie = name => {
        const item = document.cookie.split("; ").find(part => part.startsWith(`${name}=`));
        return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
      };
      const meta = JSON.parse(localStorage.getItem("shiftflow_meta_attribution") || "null");
      const captured = Date.parse(meta?.captured_at || "") || Date.now();
      return { meta_consent: true, meta_attribution: meta, meta_fbp: cookie("_fbp"), meta_fbc: cookie("_fbc") || (meta?.fbclid ? `fb.1.${Math.floor(captured / 1000)}.${meta.fbclid}` : null) };
    } catch { return {}; }
  }
  async function submit(event) {
    event.preventDefault(); setError("");
    if (!validateCredentials()) { setStep(0); return; }
    if (step < 2) { setStep(step + 1); return; }
    if (loading) return;
    setLoading(true);
    const acceptedAt = new Date().toISOString();
    const payload = {
      registration_token: token, onboarding_answers: answers,
      legal_acceptance: { version: LEGAL_VERSION, accepted_at: acceptedAt, scope: "account" }, ...attribution(),
    };
    try {
      if (googleCredential) {
        markLoggedOut(false);
        const { data } = await api.post("/auth/google", { credential: googleCredential, registration: payload, legal_version: LEGAL_VERSION });
        try { localStorage.setItem(`shiftflow-welcome-${data.user.id}`, "pending"); } catch {}
        await refresh();
      } else {
        await register({ ...payload, email: form.email.trim(), password: form.password });
      }
      finished.current = true;
      try {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.setItem("shiftflow_legal_acceptance", JSON.stringify({ version: LEGAL_VERSION, acceptedAt, scope: "account" }));
      } catch {}
      nav("/app/dashboard");
    } catch (err) {
      const message = formatApiError(err.response?.data?.detail) || "Impossible de créer le compte. Réessayez.";
      if (googleCredential) { setGoogleCredential(""); setStep(0); }
      setError(message);
    } finally { setLoading(false); }
  }
  return <div className="flex-1 bg-[#F7F9FC]">
    <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4">
      <Link to="/" className="flex items-center gap-2 font-display font-bold"><span className="rounded-lg bg-blue-600 p-2"><Zap size={18} className="text-white" /></span>ShiftFlow</Link>
      <Link to="/login" className="text-sm font-medium text-blue-700">Se connecter</Link>
    </header>
    <main className="mx-auto max-w-xl px-5 py-8 sm:py-14" data-testid="register-page">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-9">
        <div className="flex justify-between text-xs font-semibold text-gray-500"><span>{["Votre compte", "Votre activité", "Votre estimation"][step]}</span><span>Étape {step + 1} sur 3</span></div>
        <div className="mt-3 flex gap-2" role="progressbar" aria-label="Inscription" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} data-testid="register-progress">{titles.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-blue-600" : "bg-gray-100"}`} />)}</div>
        <h1 ref={heading} tabIndex={-1} className="mt-8 font-display text-3xl font-bold tracking-tight outline-none">{titles[step]}</h1>
        {step === 0 && <>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">3 missions offertes. Sans carte bancaire.</p>
          <GoogleAuthButton onCredential={googleSelected} />
          <div className="my-6 flex items-center gap-4 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />ou avec votre email<span className="h-px flex-1 bg-gray-200" /></div>
        </>}
        <form onSubmit={submit} noValidate className="mt-6" data-testid="register-form">
          {step === 0 && <div className="space-y-5">
            <label className="block text-sm font-medium text-gray-700">Email<input type="email" name="email" autoComplete="username" required maxLength={254} value={form.email} onChange={e => { setForm({ ...form, email: e.target.value }); setGoogleCredential(""); }} placeholder="vous@entreprise.fr" className="mt-2 h-12 w-full rounded-lg border border-gray-300 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="register-email-input" /></label>
            <label className="block text-sm font-medium text-gray-700">Mot de passe<span className="relative mt-2 block"><input type={showPassword ? "text" : "password"} name="password" autoComplete="new-password" required minLength={8} maxLength={128} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} aria-describedby="password-help" className="h-12 w-full rounded-lg border border-gray-300 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="register-password-input" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
            <p id="password-help" className="text-xs text-gray-500">8 caractères minimum, avec une lettre et un chiffre.</p>
          </div>}
          {step === 1 && <div className="space-y-9 py-3">
            {googleCredential && <p className="text-sm text-emerald-700">Compte Google sélectionné</p>}
            <Slider id="annual_events" label="Combien d’événements organisez-vous en moyenne par an ?" value={answers.annual_events} max={300} unit="événements / an" onChange={value => setAnswers({ ...answers, annual_events: value })} />
            <Slider id="people_per_mission" label="Combien de personnes mobilisez-vous en moyenne par mission ?" value={answers.people_per_mission} max={150} unit="personnes / mission" onChange={value => setAnswers({ ...answers, people_per_mission: value })} />
          </div>}
          {step === 2 && <div className="space-y-6 leading-relaxed" data-testid="register-savings">
            <p className="text-gray-600">Avec {number(savings.annualEvents)} événements par an et {number(savings.peoplePerMission)} personnes par mission, vous pourriez économiser environ :</p>
            <p className="font-display text-5xl font-bold tracking-tight text-blue-700">{number(savings.hours)} h<span className="ml-2 font-sans text-base font-normal text-gray-500">par an</span></p>
            <p className="text-gray-600">Soit <strong className="text-2xl text-gray-900">{euros(savings.value)}</strong> de temps de coordination libéré chaque année.</p>
            <p className="text-sm text-gray-500">Moins de relances et de suivi manuel. Plus de temps pour vos événements.</p>
            <p className="text-xs text-gray-400">Estimation indicative : 3 minutes gagnées par personne et par événement (4 minutes de coordination manuelle contre 1 minute avec l’outil), valorisées à 30 €/heure. Il s’agit de la valeur du temps libéré, hors coût de l’abonnement, et non d’une économie garantie.</p>
          </div>}
          {error && <p className="mt-5 text-sm text-red-600" role="alert">{error}</p>}
          <button type="submit" disabled={loading} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50" data-testid={step === 2 ? "register-submit-btn" : "register-next-btn"}>{loading ? "Création du compte…" : step === 2 ? "Commencer" : "Continuer"}<ArrowRight size={17} /></button>
          {step === 2 && <p className="mt-3 text-center text-xs leading-relaxed text-gray-500">En cliquant sur « Commencer », vous acceptez les <Link to="/conditions" target="_blank" className="underline">Conditions générales</Link> et reconnaissez avoir pris connaissance de la <Link to="/confidentialite" target="_blank" className="underline">Politique de confidentialité</Link>.</p>}
          {step > 0 && <button type="button" disabled={loading} onClick={() => { if (step === 1) setGoogleCredential(""); setError(""); setStep(step - 1); }} className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm text-gray-500"><ArrowLeft size={16} />Retour</button>}
        </form>
      </section>
      <p className="mt-5 text-center text-xs leading-relaxed text-gray-500">Votre email et vos réponses peuvent être conservés 7 jours pour reprendre l’inscription. Le mot de passe et la connexion Google restent uniquement en mémoire pendant ce parcours.</p>
    </main>
  </div>;
}
function Slider({ id, label, value, max, unit, onChange }) {
  return <div>
    <label htmlFor={id} className="block text-sm font-medium leading-relaxed text-gray-700">{label}</label>
    <p className="mt-3 text-blue-700"><output htmlFor={id} className="font-display text-3xl font-bold">{value}</output><span className="ml-2 text-xs text-gray-500">{unit}</span></p>
    <input id={id} name={id} type="range" min={1} max={max} step={1} value={value} onChange={e => onChange(Number(e.target.value))} aria-valuetext={`${value} ${unit}`} className="mt-4 h-6 w-full cursor-pointer accent-blue-600" />
    <div className="mt-1 flex justify-between text-xs text-gray-400"><span>1</span><span>{max}</span></div>
  </div>;
}
