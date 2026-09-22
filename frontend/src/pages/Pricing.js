import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, ArrowLeft, Loader2, AlertCircle, CalendarDays, ShieldCheck } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { LEGAL_VERSION } from "../constants/legal";

const FREE_PLAN = {
  name: "Essai gratuit",
  price: "0 €",
  period: "30 jours",
  features: ["30 jours à partir de la 1re mission", "Jusqu'à 3 missions", "Jusqu'à 30 intervenants", "Cascade automatique", "Messages WhatsApp", "Historique"],
  cta: "Essayer 30 jours",
};

const PRO_FEATURES = [
  "Missions illimitées",
  "Intervenants illimités",
  "Cascade & relances",
  "Rappels 24h WhatsApp",
  "Message de cascade personnalisable",
  "Historique complet",
  "Support prioritaire",
];

const BILLING_OPTIONS = {
  monthly: {
    key: "monthly",
    label: "Mensuel",
    lookup: "shiftflow_pro_monthly",
    displayPrice: "49 €",
    period: "/mois",
    billedText: "49 € facturés chaque mois",
    savingsText: null,
    testid: "pricing-monthly-cta",
  },
  yearly: {
    key: "yearly",
    label: "Annuel",
    lookup: "shiftflow_pro_yearly",
    displayPrice: "41,65 €",
    period: "/mois",
    billedText: "499,80 € facturés une fois par an",
    savingsText: "Vous économisez 88,20 € par an",
    badge: "−15 %",
    testid: "pricing-yearly-cta",
  },
};

export default function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");
  const [acceptedPaidTerms, setAcceptedPaidTerms] = useState(false);
  const [billingCycle, setBillingCycle] = useState(() => localStorage.getItem("shiftflow_billing_cycle") || "yearly");
  const [highlightConsent, setHighlightConsent] = useState(false);
  const [planState, setPlanState] = useState({ loading: !!user, plan: user?.plan || "free", subscriptionStatus: user?.subscription_status || null, trialStarted: !!user?.trial_started, trialExpired: user?.trial_expired || false, trialDaysRemaining: user?.trial_days_remaining ?? 30 });
  const consentRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlan = async () => {
      if (!user) {
        setPlanState({ loading: false, plan: "free", subscriptionStatus: null, trialStarted: false, trialExpired: false, trialDaysRemaining: 30 });
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
            trialStarted: !!data?.trial_started,
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
            trialStarted: !!user?.trial_started,
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
  const selectedBilling = BILLING_OPTIONS[billingCycle] || BILLING_OPTIONS.yearly;

  const selectBilling = (cycle) => {
    setBillingCycle(cycle);
    localStorage.setItem("shiftflow_billing_cycle", cycle);
    setError("");
  };

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
          <p className="mt-4 text-gray-600 text-lg">30 jours pour tester ShiftFlow sur de vraies missions, sans carte bancaire. Votre essai commence à la création de votre première mission.</p>
          {!planState.loading && isPro && (
            <div className="mt-6 inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-full px-4 py-2 text-sm font-medium" data-testid="pricing-current-plan">
              <Check className="w-4 h-4"/> Vous êtes déjà abonné Pro
            </div>
          )}
        </div>

        {error && <div className="mt-6 text-sm text-red-600 text-center" data-testid="pricing-error">{error}</div>}

        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-1 shadow-sm" data-testid="billing-toggle">
            <button
              type="button"
              onClick={() => selectBilling("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${billingCycle === "monthly" ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => selectBilling("yearly")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${billingCycle === "yearly" ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
            >
              Annuel
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${billingCycle === "yearly" ? "bg-emerald-400/20 text-emerald-300" : "bg-emerald-50 text-emerald-700"}`}>
                −15 %
              </span>
            </button>
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          <div className="rounded-2xl p-7 border bg-white border-gray-200 flex flex-col" data-testid="pricing-card-free">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold">{FREE_PLAN.name}</h3>
              <span className="text-[10px] uppercase tracking-widest bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md font-bold">Sans CB</span>
            </div>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-display font-bold">{FREE_PLAN.price}</span>
              <span className="text-gray-500">/{FREE_PLAN.period}</span>
            </div>
            <div className="mt-2 text-sm text-gray-500">L’essai démarre à la création de votre première mission.</div>
            <ul className="mt-6 space-y-2.5 flex-1">
              {FREE_PLAN.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600"/>
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
            <Link to={user ? "/app/dashboard" : "/register"} data-testid="pricing-free-cta"
              className="mt-6 block text-center w-full py-2.5 rounded-lg font-semibold bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 transition-colors">
              {user ? (planState.trialExpired ? "Essai terminé" : planState.trialStarted ? `${planState.trialDaysRemaining} j restants` : "30 jours d’essai disponibles") : FREE_PLAN.cta}
            </Link>
          </div>

          <div className="relative rounded-2xl p-7 border bg-gray-900 text-white border-gray-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden" data-testid="pricing-card-pro">
            {billingCycle === "yearly" && (
              <div className="absolute top-0 right-0 rounded-bl-xl bg-emerald-400 text-emerald-950 px-3 py-1.5 text-[11px] font-extrabold">
                ÉCONOMISEZ 15 %
              </div>
            )}

            <div className="flex items-center justify-between pr-24">
              <h3 className="text-lg font-display font-bold">Pro</h3>
              <span className="text-[10px] uppercase tracking-widest bg-blue-500 text-white px-2 py-1 rounded-md font-bold">Recommandé</span>
            </div>

            <div className="mt-4 flex items-end gap-1">
              <span className="text-4xl font-display font-bold">{selectedBilling.displayPrice}</span>
              <span className="text-gray-400 pb-1">{selectedBilling.period}</span>
            </div>

            <div className="mt-2 min-h-[44px]">
              <div className="text-sm text-gray-300">{selectedBilling.billedText}</div>
              {selectedBilling.savingsText && (
                <div className="mt-1 text-sm font-semibold text-emerald-300">{selectedBilling.savingsText}</div>
              )}
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-start gap-3">
              <CalendarDays className="w-4 h-4 text-blue-300 mt-0.5 shrink-0"/>
              <div className="text-xs text-gray-300 leading-relaxed">
                {billingCycle === "yearly"
                  ? "Un seul paiement de 499,80 € couvre 12 mois de Pro."
                  : "Facturation mensuelle flexible, renouvelée chaque mois."}
              </div>
            </div>

            <ul className="mt-6 space-y-2.5 flex-1">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 mt-0.5 shrink-0 text-blue-400"/>
                  <span className="text-gray-200">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={()=>startCheckout(selectedBilling.lookup)}
              disabled={loading === selectedBilling.lookup || planState.loading || isPro}
              data-testid={selectedBilling.testid}
              className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-lg font-semibold transition-colors bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {(loading === selectedBilling.lookup || planState.loading) && <Loader2 className="w-4 h-4 animate-spin"/>}
              {isPro
                ? "Déjà Pro"
                : loading === selectedBilling.lookup
                  ? "Redirection…"
                  : planState.loading
                    ? "Vérification…"
                    : billingCycle === "yearly"
                      ? "Choisir Pro annuel"
                      : "Choisir Pro mensuel"}
            </button>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5"/>
              Paiement sécurisé via Stripe
            </div>
          </div>
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
          Paiement sécurisé via Stripe · Renouvellement automatique selon la fréquence choisie · Résiliation à tout moment · Pas de remboursement au prorata d'une période commencée, sauf obligation légale ou erreur de facturation
        </p>
      </div>
    </div>
  );
}
