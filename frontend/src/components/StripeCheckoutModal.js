import React, { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

let scriptPromise;
export function loadStripeScript() {
  if (window.Stripe) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    const fail = () => {
      window.clearTimeout(timer); script.remove(); scriptPromise = undefined;
      reject(new Error("Le formulaire Stripe n’a pas pu être chargé."));
    };
    const timer = window.setTimeout(fail, 20000);
    script.onload = () => { window.clearTimeout(timer); if (window.Stripe) resolve(); else fail(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function StripeCheckoutModal({ checkout, onClose }) {
  const mountRef = useRef(null);
  const closeRef = useRef(null);
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("checkout");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!checkout) return undefined;
    let cancelled = false, embedded, timer;
    let attempts = 0, polling = false;
    setLoading(true); setStatus("checkout"); setError("");
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${checkout.session_id}`);
        if (cancelled) return;
        if (data.fulfilled && data.payment_status === "paid") {
          setStatus("paid");
          await refresh();
          return;
        }
        if (data.status === "expired" || data.payment_status === "failed") {
          setError("Ce paiement n’a pas été confirmé. Fermez cette fenêtre puis réessayez.");
          return;
        }
      } catch (_) { /* Retry briefly; a browser callback alone never grants Pro. */ }
      if (!cancelled && ++attempts < 60) timer = window.setTimeout(poll, 2000);
      else if (!cancelled) setError("La confirmation prend plus de temps que prévu. Si vous avez été débité, contactez le support avant de recommencer.");
    };
    loadStripeScript().then(async () => {
      if (cancelled) return;
      const stripe = window.Stripe(checkout.publishable_key, { locale: "fr" });
      const instance = await stripe.initEmbeddedCheckout({
        clientSecret: checkout.client_secret,
        onComplete: () => {
          if (cancelled || polling) return;
          polling = true; setStatus("confirming"); setLoading(false); poll();
        },
      });
      if (cancelled) { instance.destroy(); return; }
      embedded = instance;
      embedded.mount(mountRef.current);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) { setLoading(false); setError("Impossible de charger le paiement sécurisé. Vérifiez votre connexion puis rechargez le formulaire."); }
    });
    return () => { cancelled = true; window.clearTimeout(timer); embedded?.destroy(); };
  }, [checkout, refresh, retry]);
  if (!checkout) return null;
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[94dvh] w-[calc(100%_-_1.5rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl sm:p-6" onOpenAutoFocus={event => { event.preventDefault(); closeRef.current?.focus(); }}>
        <Dialog.Title className="pr-8 text-xl font-bold text-gray-900">{status === "paid" ? "Votre abonnement est activé" : "Passer à ShiftFlow Pro"}</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-gray-600">Paiement sécurisé par Stripe. Gérez votre abonnement depuis vos paramètres.</Dialog.Description>
        <Dialog.Close ref={closeRef} aria-label="Fermer le paiement" className="absolute right-3 top-3 rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={20}/></Dialog.Close>
        {(loading || status === "confirming") && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-gray-600"><Loader2 size={18} className="animate-spin"/>{status === "confirming" ? "Confirmation du paiement en cours…" : "Chargement du formulaire sécurisé…"}</p>}
        {error && <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"><p>{error}</p>{status === "checkout" && <button className="mt-2 font-semibold underline" onClick={() => setRetry(value => value + 1)}>Recharger le formulaire</button>}</div>}
        <div ref={mountRef} className={"mt-5 min-h-64 " + (status === "checkout" ? "" : "hidden")} data-testid="stripe-checkout-mount" />
        {status === "paid" && <div className="py-8 text-center" data-testid="stripe-checkout-success"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600"/><p className="mt-4 text-gray-700">Vos missions et vos intervenants sont maintenant illimités.</p><Link to="/app/dashboard" className="mt-5 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white" onClick={onClose}>Retour à mon espace</Link></div>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
