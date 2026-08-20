import React from "react";
import { Link } from "react-router-dom";
import { XCircle } from "lucide-react";

export default function PaymentCancel() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-10 text-center" data-testid="payment-cancel-page">
        <XCircle className="w-16 h-16 text-gray-400 mx-auto"/>
        <h1 className="mt-6 text-2xl font-display font-bold">Paiement annulé</h1>
        <p className="mt-2 text-gray-600 text-sm">Aucune somme n'a été prélevée. Vous pouvez continuer sur le plan gratuit ou réessayer.</p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link to="/pricing" data-testid="payment-cancel-retry" className="inline-flex items-center h-11 px-5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium">
            Réessayer
          </Link>
          <Link to="/app/dashboard" className="inline-flex items-center h-11 px-5 rounded-md border border-gray-300 text-gray-700 font-medium">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
