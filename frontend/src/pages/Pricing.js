import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, ArrowLeft, Loader2 } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "0 €",
    period: "toujours",
    features: ["1 mission active", "Jusqu'à 10 intervenants", "Cascade automatique", "SMS Twilio", "Historique"],
    cta: "Commencer",
    href: "/register",
    highlighted: false,
    testid: "pricing-free-cta",
  },
  {
    key: "monthly",
    name: "Pro Mensuel",
    price: "49 €",
    period: "/mois",
    lookup: "shiftflow_pro_monthly",
    features: ["Missions illimitées", "Intervenants illimités", "Cascade & relances", "Rappels 24h SMS", "Historique complet", "Support prioritaire"],
    cta: "Passer au Pro",
    highlighted: true,
    testid: "pricing-monthly-cta",
  },
  {
    key: "yearly",
    name: "Pro Annuel",
    price: "488 €",
    period: "/an",
    subtitle: "≈ 40,66 €/mois · –17%",
    lookup: "shiftflow_pro_yearly",
    features: ["Tout Pro Mensuel", "2 mois offerts", "Économie 100 €/an"],
    cta: "Passer au Pro annuel",
    highlighted: false,
    testid: "pricing-yearly-cta",
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");

  const startCheckout = async (lookup) => {
    if (!user) { window.location.href = "/register"; return; }
    setLoading(lookup); setError("");
    try {
      const { data } = await api.post("/payments/checkout", {
        lookup_key: lookup,
        origin_url: window.location.origin,
      });
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
      setLoading(null);
    }
  };

  const isPro = user?.plan === "pro";

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
          <p className="mt-4 text-gray-600 text-lg">Testez gratuitement, passez au Pro quand vous en avez besoin.</p>
          {isPro && (
            <div className="mt-6 inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-full px-4 py-2 text-sm font-medium" data-testid="pricing-current-plan">
              <Check className="w-4 h-4"/> Vous êtes déjà abonné Pro
            </div>
          )}
        </div>

        {error && <div className="mt-6 text-sm text-red-600 text-center" data-testid="pricing-error">{error}</div>}

        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {PLANS.map((p) => (
            <div key={p.key}
              className={`rounded-2xl p-7 border transition-shadow flex flex-col ${
                p.highlighted ? "bg-gray-900 text-white border-gray-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]" : "bg-white border-gray-200"
              }`} data-testid={`pricing-card-${p.key}`}>
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-display font-bold">{p.name}</h3>
                {p.highlighted && <span className="text-[10px] uppercase tracking-widest bg-blue-500 text-white px-2 py-1 rounded-md font-bold">Populaire</span>}
                {p.key === "yearly" && <span className="text-[10px] uppercase tracking-widest bg-amber-100 text-amber-800 px-2 py-1 rounded-md font-bold">–17%</span>}
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
                  {user ? "Continuer" : p.cta}
                </Link>
              ) : (
                <button onClick={()=>startCheckout(p.lookup)} disabled={loading === p.lookup || isPro} data-testid={p.testid}
                  className={`mt-6 flex items-center justify-center gap-2 w-full py-2.5 rounded-md font-medium transition-colors ${
                    p.highlighted ? "bg-blue-500 hover:bg-blue-400 text-white" : "bg-gray-900 hover:bg-gray-800 text-white"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}>
                  {loading === p.lookup && <Loader2 className="w-4 h-4 animate-spin"/>}
                  {isPro ? "Déjà Pro" : loading === p.lookup ? "Redirection…" : p.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-gray-500">
          Paiement sécurisé via Stripe · Annulation à tout moment · TVA gérée automatiquement
        </p>
      </div>
    </div>
  );
}
