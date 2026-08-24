import React from "react";
import { Link } from "react-router-dom";
import { X, Crown, Sparkles } from "lucide-react";

export default function UpgradeModal({ open, onClose, title, message }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      data-testid="upgrade-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-8 text-white relative">
          <button
            onClick={onClose}
            data-testid="upgrade-modal-close"
            className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <Crown className="w-6 h-6" />
          </div>
          <h2 className="mt-4 text-2xl font-display font-bold tracking-tight">
            {title || "Limite du plan gratuit atteinte"}
          </h2>
          <p className="mt-2 text-blue-100 text-sm">
            {message || "Passez au Pro pour un accès illimité aux missions et intervenants."}
          </p>
        </div>
        <div className="p-6">
          <ul className="space-y-2.5 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              Missions et intervenants illimités
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              Cascade et relances automatiques
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              Rappels 24h par SMS
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              Historique complet & support prioritaire
            </li>
          </ul>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/pricing"
              onClick={onClose}
              data-testid="upgrade-modal-cta"
              className="w-full h-11 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Crown className="w-4 h-4" /> Passer au Pro — 49 €/mois
            </Link>
            <button
              onClick={onClose}
              data-testid="upgrade-modal-later"
              className="w-full h-11 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
