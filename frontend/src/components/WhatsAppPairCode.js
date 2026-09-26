import React, { useRef, useState } from "react";
import { api, formatApiError } from "../lib/api";

export default function WhatsAppPairCode() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  const requestCode = async () => {
    if (lock.current || !phone.trim()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setCode("");
    try {
      const { data } = await api.post("/whatsapp/session/pair-code", { phone: phone.trim() });
      if (!data.connected && !data.code) throw new Error("Aucun code reçu. Réessayez.");
      setCode(data.code ? String(data.code) : "");
    } catch (err) {
      setError(err.response ? formatApiError(err.response.data?.detail) : err.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return <section className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4" aria-label="Connexion WhatsApp par code">
    <h4 className="font-semibold">Sur ce téléphone : utilisez un code</h4>
    <p className="mt-1 text-sm text-gray-700">Vous pourrez passer dans WhatsApp puis revenir ici, sans scanner votre écran.</p>
    <label className="block mt-3 text-sm font-medium">Votre numéro WhatsApp
      <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+33 6 12 34 56 78" className="mt-1 w-full h-12 border border-gray-300 rounded-lg px-3 text-base" />
    </label>
    <button type="button" onClick={requestCode} disabled={busy || !phone.trim()} className="mt-3 w-full min-h-11 px-3 py-2 rounded-lg bg-green-700 text-white font-semibold disabled:opacity-50">{busy ? "Génération…" : code ? "Obtenir un nouveau code" : "Obtenir mon code"}</button>
    {code && <div className="mt-3 text-center font-mono text-2xl tracking-widest break-all" aria-live="polite">{code}</div>}
    <p className="mt-3 text-sm text-gray-700">Dans WhatsApp : Appareils connectés → Connecter un appareil → Connecter plutôt avec un numéro de téléphone. Saisissez le code, puis revenez sur ShiftFlow.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <p className="mt-2 text-xs text-gray-600">Si cette option n’est pas disponible, ouvrez ShiftFlow sur un ordinateur et scannez son QR avec WhatsApp sur votre téléphone.</p>
  </section>;
}
