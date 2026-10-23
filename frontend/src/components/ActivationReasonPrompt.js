import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

// Optional, low-friction answer after 48h. The API decides eligibility;
// no personal or free-text information is transmitted in this survey.
const OPTIONS = [
  ["no_upcoming_mission", "Je n'ai pas de mission prévue pour le moment"],
  ["just_exploring", "Je découvre simplement l'outil"],
  ["setup_too_long", "La configuration me paraît trop longue"],
  ["whatsapp_concern", "Je préfère ne pas connecter WhatsApp"],
  ["not_relevant", "ShiftFlow ne correspond pas à mon activité"],
  ["other", "Une autre raison"],
];

export default function ActivationReasonPrompt() {
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get("/activation/reason/status").then(({ data }) => {
      if (alive) setShow(!!data.show);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const dismiss = async () => {
    setShow(false);
    api.post("/activation/reason/snooze").catch(() => {});
  };
  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await api.post("/activation/reason", { reason });
      setDone(true);
    } catch {
      // Keep the form visible to let the user retry.
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;
  return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Améliorer ShiftFlow" data-testid="activation-reason-prompt">
    {done ? <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium text-slate-700">Merci pour votre retour !</p>
      <button type="button" onClick={() => setShow(false)} className="min-h-10 text-sm text-blue-700">Fermer</button>
    </div> : <>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Votre avis</p>
          <h2 className="mt-2 text-base font-semibold text-slate-900">Qu'est-ce qui vous retient d'envoyer votre première invitation ?</h2>
          <p className="mt-2 text-sm text-slate-500">Une seule réponse, facultative, pour améliorer ShiftFlow.</p></div>
        <button type="button" onClick={dismiss} className="min-h-10 shrink-0 text-sm text-slate-500 hover:text-slate-900">Plus tard</button>
      </div>
      <div className="mt-4 space-y-2" role="radiogroup" aria-label="Raison principale">
        {OPTIONS.map(([value, label]) => <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm hover:border-blue-300">
          <input type="radio" name="activation-reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="mt-0.5 accent-blue-600" />
          <span>{label}</span>
        </label>)}
      </div>
      <button type="button" onClick={submit} disabled={!reason || busy} className="mt-4 min-h-11 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Envoyer ma réponse</button>
    </>}
  </section>;
}
