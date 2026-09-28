import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/api";
import { LEGAL_VERSION } from "../constants/legal";

export default function Register() {
  const nav = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", agency_name: "", email: "", phone: "", password: "" });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
  const currentPasswordChecks = passwordChecks(form.password);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-2">
        <Link to="/" className="flex items-center gap-2" data-testid="register-logo">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center"><Zap className="w-4 h-4 text-white"/></div>
          <span className="font-display font-bold">ShiftFlow</span>
        </Link>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-6 py-10" data-testid="register-page">
          <form onSubmit={submit} data-testid="register-form" autoComplete="on">
            <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Créer mon compte</div>
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
              <div>
                <label className="text-sm font-medium">Mot de passe *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="new-password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    data-testid="register-password-input"
                    className={`${inputCls} pr-11`}
                    value={form.password}
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((previous) => ({ ...previous, password: value }));
                      if (passwordError) setPasswordError(validatePassword(value));
                    }}
                    placeholder="Minimum 8 caractères, 1 lettre + 1 chiffre"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    data-testid="register-password-toggle"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <span className={currentPasswordChecks.length ? "text-green-700" : "text-gray-500"}>{currentPasswordChecks.length ? "✓" : "○"} 8 caractères</span>
                  <span className={currentPasswordChecks.letter ? "text-green-700" : "text-gray-500"}>{currentPasswordChecks.letter ? "✓" : "○"} 1 lettre</span>
                  <span className={currentPasswordChecks.digit ? "text-green-700" : "text-gray-500"}>{currentPasswordChecks.digit ? "✓" : "○"} 1 chiffre</span>
                </div>
                <div className="mt-1 text-[11px] text-gray-400">Aucune majuscule n’est obligatoire.</div>
                {passwordError && <div className="text-xs text-red-600 mt-1" data-testid="register-password-error">{passwordError}</div>}
              </div>
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
      </main>
    </div>
  );
}
