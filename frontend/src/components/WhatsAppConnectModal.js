import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import WhatsAppPairCode from "./WhatsAppPairCode";
import WhatsAppQrGuide from "./WhatsAppQrGuide";
export default function WhatsAppConnectModal({ onClose, onConnected, sending = false }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const completedRef = useRef(false);
  const startLock = useRef(false);

  const refreshStatus = useCallback(async () => {
    try {
      const { data } = await api.get("/whatsapp/status");
      setStatus(data);
      setError("");
      return data;
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Impossible de contacter WhatsApp.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const startSession = useCallback(async () => {
    if (startLock.current) return;
    startLock.current = true;
    setStarting(true);
    try {
      await api.post("/whatsapp/session/start");
      await refreshStatus();
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Impossible de démarrer WhatsApp.");
    } finally {
      setStarting(false);
      startLock.current = false;
    }
  }, [refreshStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await refreshStatus();
      if (!cancelled && current && !current.connected && !current.hasQR && !current.starting) {
        await startSession();
      }
    })();
    return () => { cancelled = true; };
  }, [refreshStatus, startSession]);

  useEffect(() => {
    if (!status?.connected || completedRef.current) return;
    completedRef.current = true;
    onConnected();
  }, [status?.connected, onConnected]);

  useEffect(() => {
    if (status?.connected) return undefined;
    const timer = setInterval(refreshStatus, 1500);
    return () => clearInterval(timer);
  }, [status?.connected, refreshStatus]);

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-green-700 font-bold">WhatsApp requis</div>
            <h3 className="mt-1 font-display font-bold text-xl">Connectez votre WhatsApp</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">×</button>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          ShiftFlow envoie les missions uniquement via votre compte WhatsApp. Connectez-le pour lancer la cascade.
        </p>

        {!status?.connected && <WhatsAppPairCode />}
        {status?.connected ? (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm text-green-800">
            {sending ? "WhatsApp est connecté. Lancement de la cascade…" : "WhatsApp est connecté."}
          </div>
        ) : status?.hasQR && status?.qr ? (
          <WhatsAppQrGuide qr={status.qr} />
        ) : (
          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
            <RefreshCw className="w-7 h-7 mx-auto text-gray-400 animate-spin" />
            <div className="mt-3 text-sm font-medium text-gray-800">Préparation de votre session WhatsApp…</div>
            <div className="mt-1 text-xs text-gray-500">Le QR code apparaîtra automatiquement.</div>
          </div>
        )}

        {error && <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>}
        {!loading && !status?.connected && !status?.hasQR && !status?.starting && (
          <button type="button" onClick={startSession} disabled={starting} className="mt-4 w-full py-2.5 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-60">
            {starting ? "Connexion…" : "Réessayer"}
          </button>
        )}
      </div>
    </div>
  );
}
