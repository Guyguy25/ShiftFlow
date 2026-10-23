import React, { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import { X, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function WhopCheckoutModal({ checkout, onClose }) {
  const { refresh } = useAuth();
  const [status, setStatus] = useState("checkout");
  const [error, setError] = useState("");
  const [frameReady, setFrameReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const receipt = useRef("");
  useEffect(() => { setStatus(checkout?.returning ? "confirming" : "checkout"); setError(""); setFrameReady(false); receipt.current = ""; }, [checkout]);
  useEffect(() => {
    if (!checkout || status !== "confirming") return undefined;
    let live = true, timer, count = 0;
    async function poll() {
      try {
        const { data } = await api.post("/whop/status", { reference: checkout.reference, payment_id: receipt.current }, { headers: { "X-Organization-ID": checkout.organization_id } });
        if (!live) return;
        if (data.status === "inactive") { setError("Cet abonnement n’est plus actif. Consultez vos paramètres de facturation."); return; }
        if (data.status === "paid") { setStatus("paid"); await refresh(); return; }
      } catch (err) {
        if (!live) return;
        if ([403, 404, 409].includes(err.response?.status)) { setError("Ouvrez l’organisation concernée pour vérifier ce paiement. Son accès n’a pas été modifié ici."); return; }
      }
      if (live && ++count < 30) timer = window.setTimeout(poll, 2000);
      else if (live) setError("La confirmation prend plus de temps que prévu. Si vous avez payé, ne recommencez pas : vérifiez à nouveau ou contactez le support.");
    }
    poll();
    return () => { live = false; window.clearTimeout(timer); };
  }, [checkout, status, refresh, attempt]);
  useEffect(() => {
    if (!checkout || status !== "checkout" || frameReady) return undefined;
    const timer = window.setTimeout(() => setError("Le formulaire ne s’est pas chargé. Vérifiez votre connexion puis fermez et rouvrez le paiement."), 20000);
    return () => window.clearTimeout(timer);
  }, [checkout, status, frameReady]);
  if (!checkout) return null;
  const returning = `${window.location.origin}/pricing?whop_reference=${encodeURIComponent(checkout.reference)}&organization_id=${encodeURIComponent(checkout.organization_id)}`;
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"/>
    <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[94dvh] w-[calc(100%_-_1rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6">
      <Dialog.Title className="pr-10 text-xl font-bold">{status === "paid" ? "Abonnement activé" : `Abonnement de ${checkout.organization_name || "votre organisation"}`}</Dialog.Title>
      <Dialog.Description className="mt-2 text-sm text-gray-600">Paiement sécurisé par Whop. Le tarif final et les éventuelles taxes sont présentés avant confirmation.</Dialog.Description>
      <Dialog.Close aria-label="Fermer le paiement" className="absolute right-3 top-3 rounded-lg p-2 hover:bg-gray-100"><X size={20}/></Dialog.Close>
      {status === "checkout" && <div className="mt-5 min-h-64"><WhopCheckoutEmbed sessionId={checkout.session_id} environment={checkout.environment} theme="light" locale="fr" adaptivePricing={false} returnUrl={returning} skipRedirect onStateChange={state => { if (state === "ready") { setFrameReady(true); setError(""); } }} onPaymentError={() => setError("Le paiement n’a pas abouti. Vérifiez les indications de Whop avant de réessayer.")} onComplete={(_, id) => { receipt.current = /^pay_[A-Za-z0-9]+$/.test(id || "") ? id : ""; setStatus("confirming"); }}/></div>}
      {status === "confirming" && <p role="status" className="py-8 text-sm text-gray-600">Vérification du paiement auprès de Whop…</p>}
      {error && <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><p>{error}</p><button onClick={() => { if (status === "checkout") onClose(); else { setError(""); setAttempt(v => v + 1); } }} className="mt-3 font-semibold underline">{status === "checkout" ? "Fermer le formulaire" : "Vérifier à nouveau"}</button></div>}
      {status === "paid" && <div className="py-8 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600"/><p className="mt-4">Les fonctionnalités de votre offre sont disponibles pour cette organisation.</p><button onClick={onClose} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">Continuer</button></div>}
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
