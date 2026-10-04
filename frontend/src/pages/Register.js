import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, ArrowRight, ArrowLeft, Check, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { API, formatApiError } from "../lib/api";
import { LEGAL_VERSION } from "../constants/legal";
import { DRAFT_KEY, readDraft, newDraftToken, emptyForm, emptyAnswers, draftSnapshot, sendDraft } from "../lib/registrationDraft";

export default function Register() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [initial] = useState(readDraft);
  const [token] = useState(() => initial?.token || newDraftToken());
  const [step, setStep] = useState(initial?.step || 0);
  const [form, setForm] = useState(initial?.form || emptyForm);
  const [answers] = useState(emptyAnswers);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const finished = useRef(false);
  const heading = useRef(null);
  const latest = useRef(null);
  const queue = useRef(Promise.resolve());
  const previousStep = useRef(null);
  const setF = key => e => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === "email") setEmailError("");
    if (key === "phone") setPhoneError("");
  };
  const safeFormKey = JSON.stringify({ name: form.name, agency_name: form.agency_name, email: form.email, phone: form.phone });
  const answersKey = JSON.stringify(answers);
  useEffect(() => {
    const snapshot = draftSnapshot(token, step, JSON.parse(safeFormKey), JSON.parse(answersKey));
    latest.current = snapshot;
    let localSaved = false;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot)); localSaved = true; } catch {}
    setSaveStatus(localSaved ? "Brouillon enregistré sur cet appareil." : "Sauvegarde en cours…");
    const stepChanged = previousStep.current !== step;
    previousStep.current = step;
    const timer = setTimeout(() => {
      queue.current = queue.current.catch(() => {}).then(async () => {
        if (finished.current || (!stepChanged && latest.current !== snapshot)) return;
        try {
          await sendDraft(snapshot);
          if (latest.current === snapshot) setSaveStatus(localSaved ? "Brouillon enregistré. Vous pouvez reprendre ici." : "Progression enregistrée. Gardez cette page ouverte pour conserver votre saisie.");
        } catch {
          if (latest.current === snapshot) setSaveStatus(localSaved ? "Brouillon conservé sur cet appareil · synchronisation indisponible." : "Sauvegarde indisponible. Gardez cette page ouverte.");
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
  useEffect(() => { heading.current?.focus(); setError(""); }, [step]);
  const validatePhone = raw => {
    const value = raw.replace(/[\s.\-()]/g, "");
    return /^(?:0[1-9]\d{8}|\+33[1-9]\d{8}|\+(?!33)\d{10,15})$/.test(value) ? "" : "Indiquez un numéro valide, par exemple 0612345678.";
  };
  const passwordChecks = (raw) => {
    const v = raw || "";
    return {
      length: v.length >= 8,
      letter: Array.from(v).some((ch) => ch.toLowerCase() !== ch.toUpperCase()),
      digit: /\d/.test(v),
    };
  };
  const validatePassword = (raw) => {
    const checks = passwordChecks(raw);
    if (!checks.length || !checks.letter || !checks.digit) {
      return "8 caractères minimum, avec au moins une lettre et un chiffre.";
    }
    return "";
  };
  const advance = e => {
    e.preventDefault();
    if (step === 0 && (!form.name.trim() || !form.agency_name.trim())) { setError("Renseignez votre nom et celui de votre organisation."); return; }
    if (step === 1) {
      const eMessage = validateEmail(form.email);
      const pMessage = validatePhone(form.phone);
      setEmailError(eMessage);
      setPhoneError(pMessage);
      if (eMessage || pMessage) return;
    }
    setStep(s => Math.min(2, s + 1));
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
    if (!form.name.trim() || !form.agency_name.trim()) { setStep(0); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) || validatePhone(form.phone)) { setStep(1); return; }
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
      let metaConsent = false;
      try { metaConsent = localStorage.getItem("shiftflow_cookie_consent") === "accepted"; } catch {}
      const metaAttribution = metaConsent ? readMetaAttribution() : null;
      const metaFbp = metaConsent ? readCookie("_fbp") : "";
      const metaFbc = metaConsent ? (readCookie("_fbc") || buildFallbackFbc(metaAttribution)) : "";

      await register({
        ...form,
        registration_token: token,
        legal_acceptance: { version: LEGAL_VERSION, accepted_at: acceptedAt, scope: "account" },
        meta_consent: metaConsent,
        meta_attribution: metaAttribution,
        meta_fbp: metaFbp || null,
        meta_fbc: metaFbc || null,
      });
      try { localStorage.setItem("shiftflow_legal_acceptance", JSON.stringify({ version: LEGAL_VERSION, acceptedAt, scope: "account" })); } catch {}
      finished.current = true;
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      nav("/app/dashboard");
    } catch (err) {
      const message = formatApiError(err.response?.data?.detail) || err.message || "Impossible de créer le compte.";
      const normalized = String(message).toLowerCase();
      if (normalized.includes("email") && (normalized.includes("invalid") || normalized.includes("valide") || normalized.includes("address"))) {
        setEmailError("Email invalide.");
        setError("");
        setStep(1);
      } else setError(message);
    } finally { setLoading(false); }
  };

  const inputCls = "mt-2 block w-full min-h-12 rounded-xl border border-gray-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500";
  const titles = ["Préparez votre première mission", "Comment vous joindre ?", "Votre espace est presque prêt."];
  const input = (key, label, props = {}) => <label className="block text-sm font-medium text-gray-800" key={key}>{label}<input className={inputCls} value={form[key]} onChange={setF(key)} name={key} required maxLength={key === "password" ? 128 : 254} data-testid={`register-${key === "agency_name" ? "agency" : key}-input`} {...props} /></label>;
  return <div className="min-h-screen bg-[#F7F9FC] pb-16">
    <header className="border-b border-gray-200 bg-white px-5 py-4 flex items-center justify-between gap-4">
      <Link to="/" className="flex items-center gap-2 font-display font-bold"><span className="rounded-lg bg-blue-600 p-2"><Zap size={18} className="text-white" /></span>ShiftFlow</Link>
      <Link to="/login" className="text-sm font-medium text-blue-700">Se connecter</Link>
    </header>
    <main className="mx-auto grid max-w-5xl gap-12 px-5 py-8 sm:px-8 sm:py-14 lg:grid-cols-[0.8fr_1fr]" data-testid="register-page">
      <aside className="hidden lg:block pt-8">
        <span className="text-xs font-bold uppercase tracking-widest text-blue-700">Moins de relances. Plus de sérénité.</span>
        <h2 className="mt-5 font-display text-4xl font-bold leading-tight text-gray-900">Votre prochaine mission commence ici.</h2>
        <p className="mt-5 text-gray-600 leading-relaxed">Créez votre espace, ajoutez votre équipe et envoyez vos demandes de disponibilité depuis WhatsApp.</p>
        <ul className="mt-8 space-y-4 text-sm text-gray-700">{["3 missions offertes sans date limite", "Tous vos intervenants, sans supplément", "Aucune carte bancaire requise"].map(text => <li key={text} className="flex items-center gap-3"><Check size={18} className="text-emerald-600" />{text}</li>)}</ul>
      </aside>
      <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex justify-between gap-3 text-xs font-semibold text-gray-500"><span>{step === 0 ? "Votre organisation" : step === 1 ? "Vos coordonnées" : "Sécurité"}</span><span>Étape {step + 1} sur 3</span></div>
        <div className="mt-3 flex gap-1.5" role="progressbar" aria-label="Inscription" aria-valuemin={0} aria-valuemax={3} aria-valuenow={step + 1} data-testid="register-progress">{titles.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-blue-600" : "bg-gray-100"}`} />)}</div>
        <h1 ref={heading} tabIndex={-1} className="mt-7 text-2xl sm:text-3xl font-display font-bold tracking-tight outline-none">{titles[step]}</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">{step === 0 ? "Deux informations pour personnaliser votre espace." : step === 1 ? "Ces coordonnées seront celles de votre compte." : step === 2 ? "Choisissez un mot de passe pour protéger votre compte." : "Adaptons ShiftFlow à vos besoins. Vous pouvez passer ces questions."}</p>
        {initial && Object.values(initial.form || {}).some(value => typeof value === "string" && value.trim()) && step === initial.step && <p className="mt-3 text-sm text-blue-700">Bon retour ! Votre saisie a été restaurée, sauf le mot de passe.</p>}
        <p className="mt-3 text-sm text-gray-600">Sans carte bancaire. Aucun message envoyé à vos intervenants pendant l’inscription.</p>
        <form onSubmit={step === 2 ? submit : advance} noValidate className="mt-6" data-testid="register-form" autoComplete="on">
          <div className="space-y-5">
            {step === 0 && <>{input("name", "Votre nom", { autoComplete: "name", placeholder: "Camille Martin" })}{input("agency_name", "Nom de votre entreprise ou de votre structure", { autoComplete: "organization", placeholder: "Ma structure" })}</>}
            {step === 1 && <>{input("email", "Adresse e-mail professionnelle", { type: "email", autoComplete: "username", placeholder: "vous@entreprise.fr", "aria-describedby": emailError ? "email-error" : undefined })}{emailError && <p id="email-error" role="alert" className="text-sm text-red-600">{emailError}</p>}{input("phone", "Numéro de téléphone", { type: "tel", autoComplete: "tel", placeholder: "06 12 34 56 78", "aria-describedby": phoneError ? "phone-error" : undefined })}{phoneError && <p id="phone-error" role="alert" className="text-sm text-red-600">{phoneError}</p>}</>}
            {step === 2 && <>
              <input
                type="email"
                name="username"
                autoComplete="username"
                value={form.email}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
              />
              {input("password", "Mot de passe", { type: showPassword ? "text" : "password", autoComplete: "new-password", minLength: 8, "aria-describedby": "password-help" })}
              <button type="button" onClick={() => setShowPassword(v => !v)} className="flex min-h-11 items-center gap-2 text-sm text-blue-700" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}{showPassword ? "Masquer" : "Afficher le mot de passe"}</button>
              <div className="flex flex-wrap gap-3 text-xs">{[["length", "8 caractères"], ["letter", "1 lettre"], ["digit", "1 chiffre"]].map(([key, label]) => <span key={key} className={passwordChecks(form.password)[key] ? "text-emerald-700" : "text-gray-500"}>{passwordChecks(form.password)[key] ? "✓" : "○"} {label}</span>)}</div>
              <p id="password-help" className={`text-xs ${passwordError ? "text-red-600" : "text-gray-500"}`}>{passwordError || "8 caractères minimum, dont une lettre et un chiffre."}</p>
              <label className="flex items-start gap-3 text-sm leading-relaxed text-gray-600"><input type="checkbox" required checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-blue-600" /><span>J’accepte les <Link to="/conditions" target="_blank" className="text-blue-700 underline">Conditions générales</Link> et la <Link to="/confidentialite" target="_blank" className="text-blue-700 underline">Politique de confidentialité</Link>.</span></label>
            </>}
          </div>
          {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}
          <button type="submit" disabled={loading} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50" data-testid={step === 2 ? "register-submit-btn" : "register-next-btn"}>{loading ? "Création…" : step === 2 ? "Créer mon compte gratuitement" : "Continuer"}<ArrowRight size={17} /></button>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {step > 0 && <button type="button" disabled={loading} onClick={() => setStep(s => s - 1)} className="inline-flex min-h-11 items-center gap-1 text-sm text-gray-600"><ArrowLeft size={16} />Retour</button>}
          </div>
        </form>
        <div className="mt-5 border-t border-gray-100 pt-4 text-xs leading-relaxed text-gray-500"><p className="flex items-start gap-2"><ShieldCheck size={15} className="shrink-0" />{saveStatus}</p><p className="mt-2">Votre saisie est conservée pendant 7 jours pour vous permettre de reprendre votre inscription. Ces étapes nous aident aussi à améliorer le parcours. Votre mot de passe n’est jamais enregistré dans ce brouillon.</p></div>
      </section>
    </main>
  </div>;
}

