import React, { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const SCRIPT_URL = "https://cdn.whop.com/elements/amber/elements.js";
let scriptPromise;
export function loadWhopElements() {
  if (window.WhopElements) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.setAttribute("data-whop-elements", "");
    const timer = window.setTimeout(() => fail(), 20000);
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      scriptPromise = undefined;
      reject(new Error("Impossible de charger le paiement. Vérifiez votre connexion puis réessayez."));
    };
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.WhopElements) resolve(); else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function WhopCheckoutModal({ checkout, onClose }) {
  const mountRef = useRef(null);
  const { refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const closeRef = useRef(null);
  useEffect(() => {
    if (!checkout) return undefined;
    let cancelled = false, handle, timer, loadingTimer;
    let attempts = 0;
    setLoading(true); setError(""); setConfirming(false);
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${checkout.session_id}`);
        if (cancelled) return;
        if (data.fulfilled && data.payment_status === "paid") {
          await refresh();
          if (!cancelled) window.location.assign(`/payment/success?session_id=${encodeURIComponent(checkout.session_id)}`);
          return;
        }
      } catch (_) { /* Webhook delivery may lag; a read failure cannot grant access. */ }
      if (!cancelled && ++attempts < 120) timer = window.setTimeout(poll, 2000);
      else if (!cancelled) setError("Paiement pas encore confirmé. Si vous avez payé, consultez votre compte ou contactez le support avant de réessayer.");
    };
    loadWhopElements().then(() => {
      if (cancelled) return;
      loadingTimer = window.setTimeout(() => {
        if (!cancelled) { setLoading(false); setError("Le formulaire met trop de temps à charger. Vous pouvez le recharger ci-dessous."); }
      }, 25000);
      handle = window.WhopElements().checkout.create({
        plan: checkout.plan_id,
        metadata: checkout.metadata,
        returnUrl: checkout.return_url,
        locale: "fr",
        onLoadingChange: (value) => {
          if (!cancelled) { setLoading(value); if (!value) window.clearTimeout(loadingTimer); }
        },
        onComplete: () => { if (!cancelled) setConfirming(true); },
      });
      handle.create("checkout").mount(mountRef.current);
      poll();
    }).catch(() => {
      if (!cancelled) { setLoading(false); setError("Impossible d’ouvrir le formulaire Whop. Vérifiez votre connexion puis réessayez."); }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer); window.clearTimeout(loadingTimer);
      handle?.destroy();
    };
  }, [checkout, refresh, retry]);
  if (!checkout) return null;
  const yearly = checkout.lookup_key === "shiftflow_yearly";
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[94dvh] w-[calc(100%_-_1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-7" onOpenAutoFocus={(event) => { event.preventDefault(); closeRef.current?.focus(); }}>
        <Dialog.Title className="pr-8 text-xl font-bold text-gray-900">ShiftFlow Pro</Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-gray-600">{yearly ? "521,40 € par an · −45 % · renouvellement annuel" : "79 € par mois · résiliable pour la prochaine échéance"}</Dialog.Description>
        <Dialog.Close ref={closeRef} aria-label="Fermer le paiement" className="absolute right-3 top-3 rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={20}/></Dialog.Close>
        {(loading || confirming) && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-gray-600"><Loader2 size={18} className="animate-spin"/>{confirming ? "Confirmation du paiement en cours…" : "Chargement du paiement sécurisé…"}</p>}
        {error && <div role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"><p>{error}</p>{!confirming && <button className="mt-2 font-semibold underline" onClick={() => setRetry(value => value + 1)}>Recharger le formulaire</button>}</div>}
        <div ref={mountRef} className="mt-5 min-h-64" data-testid="whop-checkout-mount" />
        <p className="mt-4 text-center text-xs text-gray-500">Paiement sécurisé par Whop. L’accès Pro est activé après confirmation du paiement.</p>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
