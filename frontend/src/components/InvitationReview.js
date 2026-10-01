import { counted } from "../lib/french";
import React, { useEffect, useRef, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function renderInvitationPreview(template, worker, shift, mission, agency) {
  const values = { prenom: worker.first_name, nom: worker.last_name, mission: mission.name,
    date: shift.date, heure_debut: shift.start_time, heure_fin: shift.end_time, lieu: mission.location,
    tarif: shift.rate_hourly, agence: agency.agency_name || "Votre agence", lien: "[Lien personnel généré lors de l’envoi]" };
  return template.replace(/\{([^{}]+)\}/g, (token, key) => Object.prototype.hasOwnProperty.call(values, key) ? String(values[key] ?? "") : token);
}

export default function InvitationReview({ workers, mission, shift, saving, onConfirm, onCancel }) {
  const { user } = useAuth();
  const reviewSection = useRef(null);
  useEffect(() => {
    reviewSection.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
    reviewSection.current?.focus({ preventScroll: true });
  }, []);
  const [template, setTemplate] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setTemplate(null); setError("");
    api.get("/whatsapp/message-template").then(({ data }) => {
      if (typeof data.template !== "string" || !data.template.trim()) throw new Error("Modèle de message indisponible.");
      if (!cancelled) setTemplate(data.template);
    }).catch(err => { if (!cancelled) setError(formatApiError(err.response?.data?.detail) || "Impossible de charger le message. Aucun envoi n’a été lancé."); });
    return () => { cancelled = true; };
  }, [attempt]);
  const worker = workers[index] || workers[0];
  return <section ref={reviewSection} tabIndex={-1} className="scroll-mt-20 outline-none mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="Vérification avant envoi">
    <h3 className="font-semibold">Vérifiez avant de lancer les demandes</h3>
    <p className="mt-2 text-sm leading-relaxed text-gray-700">{counted(workers.length, "intervenant")} dans votre sélection, dans l’ordre ci-dessous. L’envoi réel commence après votre confirmation, selon les places restantes et les personnes déjà dans la cascade.</p>
    <ol className="mt-3 list-inside list-decimal text-sm">{workers.map(w => <li key={w.id}>{w.first_name} {w.last_name} · {w.phone}</li>)}</ol>
    <p className="mt-3 text-sm text-gray-700">Après lancement, les demandes suivantes et rappels sont automatiques. Le lien de réponse sera généré lors du lancement ; vos intervenants n’ont pas besoin de compte.</p>
    {error ? <div role="alert" className="mt-3 text-sm text-red-700"><p>{error}</p><button type="button" onClick={() => setAttempt(n => n + 1)} className="min-h-11 underline">Réessayer</button></div> : !template ? <p role="status" className="mt-3 text-sm">Chargement de l’aperçu…</p> : <>
      <label className="mt-4 block text-sm font-medium">Message pour<select value={index} onChange={e => setIndex(Number(e.target.value))} className="mt-2 block min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3">{workers.map((w, i) => <option key={w.id} value={i}>{w.first_name} {w.last_name}</option>)}</select></label>
      <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-white p-4 text-sm leading-relaxed">{worker && renderInvitationPreview(template, worker, shift, mission, user || {})}</p>
    </>}
    <button type="button" disabled={saving || !template || !worker} data-onboarding="send" onClick={onConfirm} className="mt-4 min-h-12 w-full rounded-lg bg-blue-600 px-3 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Vérification / envoi…" : "Confirmer et envoyer les demandes WhatsApp"}</button>
    <div data-onboarding-inline="send" />
    <button type="button" disabled={saving} onClick={onCancel} className="mt-2 min-h-11 text-sm font-semibold text-blue-700">Revenir à la sélection</button>
  </section>;
}
