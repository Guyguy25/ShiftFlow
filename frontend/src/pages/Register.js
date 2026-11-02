import InviteRegister from "./InviteRegister";
import { pendingInvitation } from "../lib/invitation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, ArrowRight, ArrowLeft, Eye, EyeOff, Check, Building2, BarChart3, PenLine, ShieldCheck, CreditCard, Timer, CornerDownLeft, Pencil } from "lucide-react";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { useAuth } from "../context/AuthContext";
import { API, api, markLoggedOut, formatApiError } from "../lib/api";
import { LEGAL_VERSION } from "../constants/legal";
import { DRAFT_KEY, newDraftToken, draftSnapshot, sendDraft } from "../lib/registrationDraft";
import SignupCelebration from "../components/SignupCelebration";
import RegisterPreview from "../components/RegisterPreview";
import { registrationSavings } from "../lib/registrationSavings";
import { questions, SCREENS, isAnswered } from "../constants/registrationQuestions";
import { suggestEmail, passwordChecks, passwordScore } from "../lib/emailSuggestion";
import "./Register.css";

export const AUTO_ADVANCE_MS = 320;
const LETTERS = "ABCDEFGHIJ";
const byKey = Object.fromEntries(questions.map(q => [q.key, q]));
const QUESTION_COUNT = SCREENS.filter(id => byKey[id]).length;
const SECTIONS = [{ label: "Compte", step: 0 }, { label: "Activité", step: 1 }, { label: "Bilan", step: 2 }];
const stepOf = id => (id === "account" ? 0 : id === "recap" ? 2 : 1);
const fmt = value => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);

export default function Register() {
  const [invitation] = useState(pendingInvitation);
  return invitation ? <InviteRegister token={invitation}/> : <OrganizationRegister/>;
}

function OrganizationRegister() {
  const nav = useNavigate();
  const { register, refresh } = useAuth();
  // Chaque visite repart de zéro : aucune réponse précédente n'est réaffichée.
  // Le brouillon serveur sert uniquement à mesurer les abandons du parcours.
  const [token] = useState(newDraftToken);
  useEffect(() => { try { localStorage.removeItem(DRAFT_KEY); } catch {} }, []);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState({ email: "", password: "", agency_name: "" });
  const [answers, setAnswers] = useState({ annual_events: 30, people_per_mission: 15 });
  const [googleCredential, setGoogleCredential] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const finished = useRef(false);
  const heading = useRef(null);
  const latest = useRef(null);
  const queue = useRef(Promise.resolve());
  const previousStep = useRef(null);
  const advanceTimer = useRef(null);
  const indexRef = useRef(0);
  indexRef.current = index;

  const screen = SCREENS[index];
  const [volumeSeen, setVolumeSeen] = useState(false);
  useEffect(() => { if (index >= SCREENS.indexOf("volume")) setVolumeSeen(true); }, [index]);
  const step = stepOf(screen);
  const question = byKey[screen];
  const savings = registrationSavings(answers.annual_events, answers.people_per_mission);
  const safeFormKey = JSON.stringify({ email: form.email, agency_name: form.agency_name });
  const answersKey = JSON.stringify(answers);

  // Brouillon : localStorage immédiat + serveur (debounce, immédiat à chaque changement d'étape).
  useEffect(() => {
    const snapshot = draftSnapshot(token, step, JSON.parse(safeFormKey), JSON.parse(answersKey));
    latest.current = snapshot;
    const stepChanged = previousStep.current !== step;
    previousStep.current = step;
    const timer = setTimeout(() => {
      queue.current = queue.current.catch(() => {}).then(async () => {
        if (finished.current || (!stepChanged && latest.current !== snapshot)) return;
        try { await sendDraft(snapshot); } catch {}
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
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const field = SCREENS[index] === "agency" ? document.querySelector('[name="agency_name"]') : null;
    (field || heading.current)?.focus({ preventScroll: true });
  }, [index]);
  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const goTo = useCallback(target => {
    clearTimeout(advanceTimer.current);
    setError("");
    setDirection(target >= indexRef.current ? 1 : -1);
    setIndex(Math.max(0, Math.min(SCREENS.length - 1, target)));
  }, []);

  // Reprise : on saute directement au premier écran sans réponse.
  function resumeIndex() {
    const open = SCREENS.findIndex((id, i) => i > 0 && ((id === "agency" && !form.agency_name.trim()) || (byKey[id] && !isAnswered(id, answers))));
    return open === -1 ? 1 : open;
  }

  function validateCredentials() {
    if (googleCredential) return true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Indiquez une adresse email valide."); return false;
    }
    const checks = passwordChecks(form.password);
    if (!checks.length || !checks.letter || !checks.digit) {
      setError("Choisissez un mot de passe de 8 caractères minimum, avec une lettre et un chiffre."); return false;
    }
    return true;
  }
  function googleSelected(credential) {
    setGoogleCredential(credential);
    setForm(previous => ({ ...previous, password: "" }));
    goTo(resumeIndex());
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

  function choose(q, value) {
    clearTimeout(advanceTimer.current);
    setError("");
    if (q.multi) {
      setAnswers(a => {
        const list = a[q.key] || [];
        return { ...a, [q.key]: list.includes(value) ? list.filter(x => x !== value) : [...list, value] };
      });
      return;
    }
    setAnswers(a => ({ ...a, [q.key]: value }));
    const from = indexRef.current;
    advanceTimer.current = setTimeout(() => { if (indexRef.current === from) goTo(from + 1); }, AUTO_ADVANCE_MS);
  }

  async function createAccount() {
    if (!form.agency_name.trim()) { goTo(SCREENS.indexOf("agency")); setError("Indiquez le nom de votre organisation."); return; }
    const missing = questions.find(q => !isAnswered(q.key, answers));
    if (missing) { goTo(SCREENS.indexOf(missing.key)); setError("Répondez à cette question pour préparer votre bilan."); return; }
    if (loading) return;
    setLoading(true);
    const acceptedAt = new Date().toISOString();
    const payload = {
      registration_token: token, onboarding_answers: answers, agency_name: form.agency_name.trim(),
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
      nav(sessionStorage.getItem("shiftflow_pending_invitation") ? "/invite" : "/app/dashboard");
    } catch (err) {
      const message = formatApiError(err.response?.data?.detail) || "Impossible de créer le compte. Réessayez.";
      if (googleCredential) { setGoogleCredential(""); goTo(0); }
      setError(message);
    } finally { setLoading(false); }
  }

  function next() {
    setError("");
    if (screen === "account") { setTouched(true); if (validateCredentials()) goTo(resumeIndex()); return; }
    if (!validateCredentials()) { goTo(0); return; }
    if (screen === "agency" && !form.agency_name.trim()) { setError("Indiquez le nom de votre organisation."); return; }
    if (question && !isAnswered(question.key, answers)) { setError(question.multi ? "Choisissez au moins une réponse." : "Choisissez une réponse pour continuer."); return; }
    if (screen === "recap") { createAccount(); return; }
    goTo(index + 1);
  }
  const nextRef = useRef(next);
  nextRef.current = next;

  // Raccourcis clavier façon Typeform : A, B, C… ou 1, 2, 3… pour répondre, Entrée pour valider.
  useEffect(() => {
    const onKey = event => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const tag = event.target?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || event.target?.isContentEditable) return;
      if (event.key === "Enter" && !["BUTTON", "A"].includes(tag)) { event.preventDefault(); nextRef.current(); return; }
      if (!question || event.repeat) return;
      const key = event.key.toUpperCase();
      const position = /^[1-9]$/.test(key) ? Number(key) - 1 : LETTERS.indexOf(key);
      if (key.length === 1 && position >= 0 && position < question.options.length) { event.preventDefault(); choose(question, question.options[position].value); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const questionNumber = question ? SCREENS.filter((id, i) => byKey[id] && i <= index).length : 0;
  const progress = Math.round((index / (SCREENS.length - 1)) * 100);
  const remaining = Math.max(0, SCREENS.length - 1 - index);
  const suggestion = screen === "account" && !googleCredential ? suggestEmail(form.email) : null;
  const checks = passwordChecks(form.password);
  const score = passwordScore(form.password);
  const canContinue = screen === "agency" ? Boolean(form.agency_name.trim()) : question ? isAnswered(question.key, answers) : true;

  return <div className="flex-1 bg-[#F7F9FC] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,44%)]">
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link to="/" className="flex items-center gap-2 font-display font-bold"><span className="rounded-lg bg-blue-600 p-2"><Zap size={18} className="text-white" /></span>ShiftFlow</Link>
        <p className="text-sm text-gray-500">Déjà inscrit ? <Link to="/login" className="font-medium text-blue-700">Se connecter</Link></p>
      </header>
      <div className="h-1 w-full bg-gray-200/70"><div className="sf-progress-fill h-full bg-gradient-to-r from-blue-600 to-violet-500" style={{ width: `${progress}%` }} /></div>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8 sm:py-12" data-testid="register-page">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-gray-400">
          <ol className="flex items-center gap-2" role="progressbar" aria-label="Inscription" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} aria-valuetext={`Étape ${step + 1} sur 3 : ${SECTIONS[step].label}`} data-testid="register-progress">
            {SECTIONS.map((section, i) => <li key={section.label} className={`flex items-center gap-2 ${i === step ? "text-blue-700" : i < step ? "text-gray-600" : ""}`}>
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${i < step ? "bg-blue-600 text-white" : i === step ? "bg-blue-100 text-blue-700 ring-2 ring-blue-600/30" : "bg-gray-100"}`}>{i < step ? <Check size={11} strokeWidth={3} /> : i + 1}</span>
              <span className={i === step ? "" : "hidden sm:inline"}>{section.label}</span>
              {i < 2 && <span className="h-px w-4 bg-gray-200 sm:w-6" />}
            </li>)}
          </ol>
          {screen !== "recap" && <span className="flex items-center gap-1 whitespace-nowrap"><Timer size={13} />{remaining <= 3 ? "Presque fini" : `≈ ${Math.max(1, Math.round(remaining * 6 / 60))} min`}</span>}
        </div>

        <form onSubmit={event => { event.preventDefault(); next(); }} noValidate className="mt-8 flex flex-1 flex-col" data-testid="register-form">
          <div key={screen} className="sf-screen" data-dir={direction > 0 ? "forward" : "back"}>
            {question && <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600"><question.icon size={14} />{question.eyebrow}<span className="text-gray-400">· {questionNumber}/{QUESTION_COUNT}</span></p>}

            {screen === "account" && <>
              <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-bold tracking-tight outline-none sm:text-4xl">Créez votre compte</h1>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-1.5"><Check size={15} className="text-emerald-600" />3 missions offertes</li>
                <li className="flex items-center gap-1.5"><CreditCard size={15} className="text-emerald-600" />Sans carte bancaire</li>
                <li className="flex items-center gap-1.5"><Timer size={15} className="text-emerald-600" />Prêt en 1 minute</li>
              </ul>
              <div className="mt-7"><GoogleAuthButton onCredential={googleSelected} /></div>
              <div className="my-6 flex items-center gap-4 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />ou avec votre email<span className="h-px flex-1 bg-gray-200" /></div>
              <div className="space-y-5">
                <label className="block text-sm font-medium text-gray-700">Email professionnel
                  <input type="email" name="email" autoComplete="username" required maxLength={254} autoFocus value={form.email}
                    onChange={e => { setForm({ ...form, email: e.target.value }); setGoogleCredential(""); setError(""); }}
                    placeholder="vous@entreprise.fr" className="sf-input mt-2" data-testid="register-email-input" /></label>
                {suggestion && <button type="button" onClick={() => setForm({ ...form, email: suggestion })} className="sf-pop -mt-3 text-left text-sm text-amber-700" data-testid="register-email-suggestion">Vouliez-vous dire <span className="font-semibold underline">{suggestion}</span> ?</button>}
                <label className="block text-sm font-medium text-gray-700">Mot de passe
                  <span className="relative mt-2 block"><input type={showPassword ? "text" : "password"} name="password" autoComplete="new-password" required minLength={8} maxLength={128} value={form.password}
                    onChange={e => { setForm({ ...form, password: e.target.value }); setError(""); }} aria-describedby="password-help" className="sf-input pr-12" data-testid="register-password-input" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-gray-500">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
                <div id="password-help" aria-live="polite">
                  <div className="flex gap-1.5" aria-hidden="true">{[0, 1, 2, 3].map(i => <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < score ? ["bg-rose-400", "bg-amber-400", "bg-emerald-500", "bg-emerald-600"][score - 1] : "bg-gray-200"}`} />)}</div>
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {[["length", "8 caractères minimum"], ["letter", "Une lettre"], ["digit", "Un chiffre"]].map(([key, label]) => <li key={key} className={`flex items-center gap-1 transition-colors ${checks[key] ? "text-emerald-700" : touched && form.password ? "text-rose-600" : "text-gray-500"}`}><Check size={12} strokeWidth={3} className={checks[key] ? "" : "opacity-30"} />{label}</li>)}
                  </ul>
                </div>
              </div>
            </>}

            {screen === "agency" && <>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600"><Building2 size={14} />Votre espace</p>
              <h1 ref={heading} tabIndex={-1} className="mt-3 font-display text-3xl font-bold tracking-tight outline-none sm:text-4xl">Comment s’appelle votre organisation ?</h1>
              <p className="mt-3 text-sm text-gray-500">{googleCredential ? <span className="mr-1 font-medium text-emerald-700">Compte Google sélectionné.</span> : null}Votre espace de travail sera créé à ce nom. Vous pourrez le modifier ensuite.</p>
              <input name="agency_name" autoComplete="organization" value={form.agency_name} onChange={event => { setForm({ ...form, agency_name: event.target.value }); setError(""); }}
                placeholder="Ex. AXE Events" required maxLength={120} className="sf-input mt-7 h-14 text-lg" data-testid="register-agency-input" />
            </>}

            {question && <>
              <h1 ref={heading} tabIndex={-1} className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight outline-none sm:text-3xl">{question.label}</h1>
              {question.hint && <p className="mt-2 text-sm text-gray-500">{question.hint}</p>}
              <fieldset className="mt-6">
                <legend className="sr-only">{question.label}</legend>
                <div className={`grid gap-2.5 ${question.options.length >= 5 && question.options.every(o => o.icon) ? "sm:grid-cols-2" : ""}`}>
                  {question.options.map((option, i) => {
                    const selected = question.multi ? (answers[question.key] || []).includes(option.value) : answers[question.key] === option.value;
                    const Icon = option.icon;
                    return <button key={option.value} type="button" aria-pressed={selected} onClick={() => choose(question, option.value)}
                      className={`sf-option group ${selected ? "sf-option-on" : ""}`} style={{ animationDelay: `${i * 35}ms` }} data-testid="register-option">
                      <kbd className="sf-key">{LETTERS[i]}</kbd>
                      {Icon && <Icon size={18} className={selected ? "text-blue-600" : "text-gray-400 group-hover:text-blue-500"} />}
                      <span className="flex-1">{option.value}</span>
                      <span className={`sf-check ${selected ? "sf-check-on" : ""}`}><Check size={12} strokeWidth={3} /></span>
                    </button>;
                  })}
                </div>
              </fieldset>
            </>}

            {screen === "volume" && <>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600"><BarChart3 size={14} />Votre volume</p>
              <h1 ref={heading} tabIndex={-1} className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight outline-none sm:text-3xl">Quelle est la taille de votre activité ?</h1>
              <p className="mt-2 text-sm text-gray-500">Approximatif, c’est parfait. On calcule le temps que vous pourriez récupérer.</p>
              <div className="mt-8 space-y-8">
                <Slider id="annual_events" label="Événements par an" value={answers.annual_events} max={300} unit="événements / an" onChange={value => setAnswers(a => ({ ...a, annual_events: value }))} />
                <Slider id="people_per_mission" label="Personnes mobilisées par mission" value={answers.people_per_mission} max={150} unit="personnes / mission" onChange={value => setAnswers(a => ({ ...a, people_per_mission: value }))} />
              </div>
              <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 p-5 text-white shadow-lg shadow-blue-600/20 lg:hidden" aria-live="polite">
                <p className="text-sm text-blue-100">Temps récupérable estimé</p>
                <p className="font-display text-3xl font-bold tabular-nums">{fmt(savings.hours)} h<span className="text-base font-medium text-blue-100">/an</span></p>
              </div>
            </>}

            {screen === "context" && <>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600"><PenLine size={14} />Dernière question · facultative</p>
              <h1 ref={heading} tabIndex={-1} className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight outline-none sm:text-3xl">Racontez une situation récente où la coordination a été compliquée</h1>
              <p className="mt-2 text-sm text-gray-500">Deux lignes suffisent. Ça nous aide à rendre ShiftFlow vraiment utile pour vous.</p>
              <textarea name="context" maxLength={1500} value={answers.context || ""} onChange={e => setAnswers(a => ({ ...a, context: e.target.value }))}
                placeholder="Que s’est-il passé ? Comment avez-vous géré la situation ?" className="sf-input mt-6 min-h-36 py-3" />
              <p className="mt-1 text-right text-xs text-gray-400">{(answers.context || "").length}/1500</p>
            </>}

            {screen === "recap" && <>
              <h1 ref={heading} tabIndex={-1} className="mb-6 text-center font-display text-3xl font-bold tracking-tight outline-none sm:text-4xl">Votre bilan avant de commencer</h1>
              <SignupCelebration savings={savings} />
              <div className="grid gap-2.5 sm:grid-cols-2">
                <RecapCard label="Votre priorité" value={answers.priority} />
                <RecapCard label="Objectif souhaité" value={answers.goal} />
                <RecapCard label="Difficulté principale" value={answers.biggest_problem} />
                <RecapCard label="Aujourd’hui" value={(answers.channels || []).join(", ")} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <span className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white">{form.agency_name.trim().slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0"><span className="block text-xs text-gray-500">Espace de travail</span><span className="block truncate font-semibold" data-testid="register-recap-agency">{form.agency_name.trim()}</span></span></span>
                <button type="button" onClick={() => goTo(SCREENS.indexOf("agency"))} className="flex items-center gap-1 text-sm font-medium text-blue-700"><Pencil size={14} />Modifier</button>
              </div>
            </>}
          </div>

          {error && <p className="sf-shake mt-5 text-sm text-red-600" role="alert">{error}</p>}

          <div className="mt-auto pt-8">
            <div className="flex items-center gap-3">
              {index > 0 && <button type="button" disabled={loading} onClick={() => { if (index === 1) setGoogleCredential(""); goTo(index - 1); }} aria-label="Retour" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"><ArrowLeft size={18} /></button>}
              <button type="submit" disabled={loading} className={`sf-cta ${canContinue ? "" : "opacity-60"}`} data-testid={screen === "recap" ? "register-submit-btn" : "register-next-btn"}>
                {loading ? <><span className="sf-spinner" />Création de votre espace…</> : screen === "recap" ? <>Créer mon espace<ArrowRight size={17} /></> : screen === "context" && !answers.context?.trim() ? <>Passer et voir mon bilan<ArrowRight size={17} /></> : <>Continuer<ArrowRight size={17} /></>}
              </button>
            </div>
            {question && <p className="mt-3 hidden items-center justify-center gap-1.5 text-xs text-gray-400 sm:flex">Astuce : tapez <kbd className="sf-key">A</kbd>, <kbd className="sf-key">B</kbd>… pour répondre{question.multi ? <>, puis <kbd className="sf-key"><CornerDownLeft size={10} /></kbd></> : ""}</p>}
            {screen === "recap" && <p className="mt-3 text-center text-xs leading-relaxed text-gray-500">En cliquant sur « Créer mon espace », vous acceptez les <Link to="/conditions" target="_blank" className="underline">Conditions générales</Link> et reconnaissez avoir pris connaissance de la <Link to="/confidentialite" target="_blank" className="underline">Politique de confidentialité</Link>.</p>}
            {screen === "account" && <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-gray-500"><ShieldCheck size={14} className="mt-0.5 shrink-0" />Si vous n’allez pas au bout, votre email et vos réponses peuvent être conservés 7 jours. Le mot de passe et la connexion Google restent uniquement en mémoire pendant ce parcours.</p>}
          </div>
        </form>
      </main>
    </div>
    <div className="hidden lg:block"><RegisterPreview agency={form.agency_name.trim()} answers={answers} savings={savings} volumeSeen={volumeSeen} /></div>
  </div>;
}

function RecapCard({ label, value }) {
  if (!value) return null;
  return <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3"><p className="text-xs font-medium text-blue-700/80">{label}</p><p className="mt-0.5 text-sm font-semibold text-gray-900">{value}</p></div>;
}

function Slider({ id, label, value, max, unit, onChange }) {
  const fill = ((value - 1) / (max - 1)) * 100;
  return <div>
    <div className="flex items-end justify-between gap-4">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
      <p className="text-blue-700"><output htmlFor={id} className="font-display text-3xl font-bold tabular-nums">{value}</output><span className="ml-1.5 text-xs text-gray-500">{unit}</span></p>
    </div>
    <input id={id} name={id} type="range" min={1} max={max} step={1} value={value} onChange={e => onChange(Number(e.target.value))} aria-valuetext={`${value} ${unit}`} className="sf-range mt-4" style={{ "--fill": `${fill}%` }} />
    <div className="mt-1 flex justify-between text-xs text-gray-400"><span>1</span><span>{max}</span></div>
  </div>;
}
