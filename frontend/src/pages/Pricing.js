import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { LEGAL_VERSION } from "../constants/legal";

const PLANS = [
  {
    key: "free",
    name: "Essai gratuit",
    price: "0 €",
    period: "30 jours",
    features: ["Jusqu'à 3 missions", "Jusqu'à 30 intervenants", "Cascade automatique", "Messages WhatsApp", "Historique"],
    cta: "Essayer 30 jours",
    href: "/register",
    highlighted: false,
    testid: "pricing-free-cta",
  },
  {
    key: "monthly",
    name: "Pro Mensuel",
    price: "49 €",
    period: "/mois",
    subtitle: "TVA non applicable, art. 293 B du CGI",
    lookup: "shiftflow_pro_monthly",
    features: ["Missions illimitées", "Intervenants illimités", "Cascade & relances", "Rappels 24h WhatsApp", "Message de cascade personnalisable", "Historique complet", "Support prioritaire"],
    cta: "Passer au Pro",
    highlighted: true,
    testid: "pricing-monthly-cta",
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");
  const [acceptedPaidTerms, setAcceptedPaidTerms] = useState(false);
  const [highlightConsent, setHighlightConsent] = useState(false);
  const [planState, setPlanState] = useState({ loading: !!user, plan: user?.plan || "free", subscriptionStatus: user?.subscription_status || null, trialExpired: user?.trial_expired || false, trialDaysRemaining: user?.trial_days_remaining ?? 30 });
  const consentRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlan = async () => {
      if (!user) {
        setPlanState({ loading: false, plan: "free", subscriptionStatus: null, trialExpired: false, trialDaysRemaining: 30 });
        return;
      }

      try {
        const { data } = await api.get("/plan/quota", {
          headers: { "Cache-Control": "no-cache" },
          params: { _ts: Date.now() },
        });
        if (!cancelled) {
          setPlanState({
            loading: false,
            plan: data?.plan || "free",
            subscriptionStatus: data?.subscription_status || null,
            trialExpired: !!data?.trial_expired,
            trialDaysRemaining: data?.trial_days_remaining ?? 0,
          });
        }
      } catch (_) {
        if (!cancelled) {
          setPlanState({
            loading: false,
            plan: user?.plan || "free",
            subscriptionStatus: user?.subscription_status || null,
            trialExpired: !!user?.trial_expired,
            trialDaysRemaining: user?.trial_days_remaining ?? 0,
          });
        }
      }
    };

    loadPlan();
    return () => { cancelled = true; };
  }, [user]);

  const startCheckout = async (lookup) => {
    if (!user) { window.location.href = "/register"; return; }
    if (!acceptedPaidTerms) {
      setError("");
      setHighlightConsent(true);
      requestAnimationFrame(() => consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setHighlightConsent(false);
    setLoading(lookup); setError("");
    const acceptedAt = new Date().toISOString();
    localStorage.setItem("shiftflow_paid_terms_acceptance", JSON.stringify({ version: LEGAL_VERSION, acceptedAt, plan: lookup }));
    try {
      const { data } = await api.post("/payments/checkout", {
        lookup_key: lookup,
        origin_url: window.location.origin,
        legal_acceptance: { version: LEGAL_VERSION, accepted_at: acceptedAt, scope: "pro_subscription" },
        meta_consent: localStorage.getItem("shiftflow_cookie_consent") === "accepted",
      });
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
      setLoading(null);
    }
  };

  const handleTermsChange = (e) => {
    const checked = e.target.checked;
    setAcceptedPaidTerms(checked);
    if (checked) {
      setHighlightConsent(false);
      setError("");
    }
  };

  const isPro = planState.plan === "pro" && planState.subscriptionStatus === "active";

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="pricing-logo">
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center"><Zap className="w-4 h-4 text-white"/></div>
            <span className="font-display font-bold text-lg">ShiftFlow</span>
          </Link>
          <Link to={user ? "/app/dashboard" : "/"} data-testid="pricing-back" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4"/> Retour
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold font-display tracking-tight">Un tarif simple, sans surprise.</h1>
          <p className="mt-4 text-gray-600 text-lg">30 jours pour tester ShiftFlow sur de vraies missions, sans carte bancaire.</p>
          {!planState.loading && isPro && (
            <div className="mt-6 inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-full px-4 py-2 text-sm font-medium" data-testid="pricing-current-plan">
              <Check className="w-4 h-4"/> Vous êtes déjà abonné Pro
            </div>
          )}
        </div>

        {error && <div className="mt-6 text-sm text-red-600 text-center" data-testid="pricing-error">{error}</div>}

        <div className="mt-12 grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {PLANS.map((p) => (
            <div key={p.key}
              className={`rounded-2xl p-7 border transition-shadow flex flex-col ${
                p.highlighted ? "bg-gray-900 text-white border-gray-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]" : "bg-white border-gray-200"
              }`} data-testid={`pricing-card-${p.key}`}>
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-display font-bold">{p.name}</h3>
                {p.highlighted && <span className="text-[10px] uppercase tracking-widest bg-blue-500 text-white px-2 py-1 rounded-md font-bold">Populaire</span>}
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-display font-bold">{p.price}</span>
                <span className={p.highlighted ? "text-gray-400" : "text-gray-500"}>{p.period}</span>
              </div>
              {p.subtitle && <div className={`text-xs mt-1 ${p.highlighted ? "text-gray-400" : "text-gray-500"}`}>{p.subtitle}</div>}
              <ul className="mt-6 space-y-2.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${p.highlighted ? "text-blue-400" : "text-green-600"}`}/>
                    <span className={p.highlighted ? "text-gray-200" : "text-gray-700"}>{f}</span>
                  </li>
                ))}
              </ul>
              {p.key === "free" ? (
                <Link to={user ? "/app/dashboard" : "/register"} data-testid={p.testid}
                  className="mt-6 block text-center w-full py-2.5 rounded-md font-medium bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors">
                  {user ? (planState.trialExpired ? "Essai terminé" : `${planState.trialDaysRemaining} j restants`) : p.cta}
                </Link>
              ) : (
                <button onClick={()=>startCheckout(p.lookup)} disabled={loading === p.lookup || planState.loading || isPro} data-testid={p.testid}
                  className={`mt-6 flex items-center justify-center gap-2 w-full py-2.5 rounded-md font-medium transition-colors ${
                    p.highlighted ? "bg-blue-500 hover:bg-blue-400 text-white" : "bg-gray-900 hover:bg-gray-800 text-white"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}>
                  {(loading === p.lookup || planState.loading) && <Loader2 className="w-4 h-4 animate-spin"/>}
                  {isPro ? "Déjà Pro" : loading === p.lookup ? "Redirection…" : planState.loading ? "Vérification…" : p.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        {!planState.loading && !isPro && (
          <div ref={consentRef} className="max-w-4xl mx-auto mt-6">
            {highlightConsent && (
              <div className="mb-2 flex items-center justify-center gap-2 text-sm font-semibold text-red-600" role="alert">
                <AlertCircle className="h-4 w-4" />
                Une dernière étape : cochez la case ci-dessous pour continuer.
              </div>
            )}
            <label className={`flex items-start gap-3 rounded-xl p-4 text-sm cursor-pointer transition-all duration-200 ${
              highlightConsent
                ? "border-2 border-red-500 bg-red-50 text-red-950 shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
                : acceptedPaidTerms
                  ? "border-2 border-green-400 bg-green-50 text-gray-800"
                  : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            }`} data-testid="pricing-legal-consent">
              <input
                type="checkbox"
                checked={acceptedPaidTerms}
                onChange={handleTermsChange}
                aria-invalid={highlightConsent ? "true" : "false"}
                className={`mt-0.5 h-5 w-5 shrink-0 rounded cursor-pointer ${highlightConsent ? "border-red-500 text-red-600 focus:ring-red-500" : "border-gray-300 text-blue-600 focus:ring-blue-500"}`}
              />
              <span>
                <span className="font-semibold">J'accepte les conditions nécessaires pour souscrire au Pro.</span>{" "}
                <span className={highlightConsent ? "text-red-800" : "text-gray-600"}>
                  J'ai lu et j'accepte les <Link to="/conditions" target="_blank" className="text-blue-600 font-medium hover:underline">Conditions générales d'utilisation et de vente</Link>,
                  {" "}la <Link to="/confidentialite" target="_blank" className="text-blue-600 font-medium hover:underline">Politique de confidentialité</Link> et le <Link to="/dpa" target="_blank" className="text-blue-600 font-medium hover:underline">DPA</Link>.
                </span>
              </span>
            </label>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-gray-500">
          Paiement sécurisé via Stripe · Renouvellement mensuel · Résiliation à tout moment · Pas de remboursement au prorata d'une période commencée, sauf obligation légale ou erreur de facturation
        </p>
      </div>
    </div>
  );
}
