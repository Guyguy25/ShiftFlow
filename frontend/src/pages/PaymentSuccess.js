import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function PaymentSuccess() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id");
  const [status, setStatus] = useState("polling");
  const [attempts, setAttempts] = useState(0);
  const { refresh } = useAuth();

  useEffect(() => {
    if (!sessionId) { setStatus("error"); return; }
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (cancelled) return;
        if (data.payment_status === "paid") {
          setStatus("paid");
          refresh();
        } else if (data.payment_status === "expired" || data.status === "expired") {
          setStatus("expired");
        } else if (attempts >= 20) {
          setStatus("timeout");
        } else {
          setAttempts(a => a + 1);
          setTimeout(poll, 2000);
        }
      } catch (e) {
        if (!cancelled) setStatus("error");
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-10 text-center" data-testid="payment-success-page">
        {status === "polling" && (
          <>
            <Loader2 className="w-16 h-16 text-blue-600 mx-auto animate-spin"/>
            <h1 className="mt-6 text-2xl font-display font-bold">Confirmation en cours…</h1>
            <p className="mt-2 text-gray-600 text-sm">Nous vérifions votre paiement auprès de Stripe.</p>
          </>
        )}
        {status === "paid" && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto" data-testid="payment-success-icon"/>
            <h1 className="mt-6 text-3xl font-display font-bold">Bienvenue en Pro !</h1>
            <p className="mt-2 text-gray-600">Toutes les limites sont retirées. Créez autant de missions et d'intervenants que nécessaire.</p>
            <Link to="/app/dashboard" data-testid="payment-goto-dashboard" className="mt-6 inline-flex items-center justify-center h-11 px-5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium">
              Aller au dashboard
            </Link>
          </>
        )}
        {(status === "expired" || status === "timeout" || status === "error") && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto"/>
            <h1 className="mt-6 text-2xl font-display font-bold">Paiement non confirmé</h1>
            <p className="mt-2 text-gray-600 text-sm">Le paiement n'a pas été confirmé à temps. Réessayez ou contactez le support si le débit a eu lieu.</p>
            <Link to="/pricing" className="mt-6 inline-flex items-center justify-center h-11 px-5 rounded-md bg-gray-900 text-white font-medium">
              Retour au pricing
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
