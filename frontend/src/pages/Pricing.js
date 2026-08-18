import React from "react";
import { Link } from "react-router-dom";
import { Check, Zap, ArrowLeft } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "0 €",
    period: "toujours",
    features: ["1 mission active", "Jusqu'à 10 intervenants", "Confirmations manuelles", "Historique 30 jours"],
    cta: "Commencer",
    href: "/register",
    highlighted: false,
    testid: "pricing-free-cta",
  },
  {
    name: "Pro",
    price: "49 €",
    period: "/mois",
    features: [
      "Missions illimitées",
      "Intervenants illimités",
      "Cascade automatique",
      "Relances automatiques",
      "Rappels avant mission",
      "Historique complet",
    ],
    cta: "Bientôt disponible",
    href: "#",
    highlighted: true,
    testid: "pricing-pro-cta",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="pricing-logo">
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg">ShiftFlow</span>
          </Link>
          <Link to="/" data-testid="pricing-back" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold font-display tracking-tight">Un tarif simple, sans surprise.</h1>
          <p className="mt-4 text-gray-600 text-lg">Commencez gratuitement, passez au Pro quand vous en avez besoin.</p>
        </div>

        <div className="mt-14 grid md:grid-cols-2 gap-6">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl p-8 border transition-shadow ${
                p.highlighted
                  ? "bg-gray-900 text-white border-gray-900 shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
                  : "bg-white border-gray-200"
              }`}
              data-testid={`pricing-card-${p.name.toLowerCase()}`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-xl font-display font-bold">{p.name}</h3>
                {p.highlighted && (
                  <span className="text-xs uppercase tracking-widest bg-blue-500 text-white px-2 py-1 rounded-md font-bold">Recommandé</span>
                )}
              </div>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-display font-bold">{p.price}</span>
                <span className={p.highlighted ? "text-gray-400" : "text-gray-500"}>{p.period}</span>
              </div>
              <ul className="mt-8 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${p.highlighted ? "text-blue-400" : "text-green-600"}`} />
                    <span className={p.highlighted ? "text-gray-200" : "text-gray-700"}>{f}</span>
                  </li>
                ))}
              </ul>
              {p.highlighted ? (
                <button
                  disabled
                  data-testid={p.testid}
                  className="mt-8 w-full py-3 rounded-md font-medium bg-gray-700 text-gray-300 cursor-not-allowed"
                >
                  {p.cta}
                </button>
              ) : (
                <Link
                  to={p.href}
                  data-testid={p.testid}
                  className="mt-8 block text-center w-full py-3 rounded-md font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  {p.cta}
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
