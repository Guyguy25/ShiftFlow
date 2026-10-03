import { counted } from "../lib/french";
import React, { useEffect, useRef, useState } from "react";
import { CheckCheck, MessageCircle } from "lucide-react";
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
      <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 bg-[#075E54] px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 font-bold">
              {(worker?.first_name || "?").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{worker?.first_name} {worker?.last_name}</p>
              <p className="text-[11px] text-emerald-100">Aperçu du message WhatsApp</p>
            </div>
          </div>
          <MessageCircle className="h-5 w-5 shrink-0 text-emerald-100" aria-hidden="true" />
        </div>

        <div className="bg-[#efeae2] p-4 sm:p-5" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,.28) 0 1px, transparent 1px), radial-gradient(circle at 80% 50%, rgba(0,0,0,.035) 0 1px, transparent 1px)", backgroundSize: "18px 18px, 22px 22px" }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Message envoyé à</span>
            <select value={index} onChange={e => setIndex(Number(e.target.value))} aria-label="Choisir le destinataire de l’aperçu" className="max-w-[65%] rounded-lg border border-white/70 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-gray-800 shadow-sm">
              {workers.map((w, i) => <option key={w.id} value={i}>{w.first_name} {w.last_name}</option>)}
            </select>
          </div>

          <div className="flex justify-end">
            <div className="relative max-w-[92%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3.5 py-3 shadow-sm sm:max-w-[82%]">
              <p className="whitespace-pre-wrap break-words pr-12 text-[14px] leading-relaxed text-gray-900">{worker && renderInvitationPreview(template, worker, shift, mission, user || {})}</p>
              <span className="absolute bottom-2 right-2.5 flex items-center gap-1 text-[10px] text-gray-500">
                maintenant <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" aria-hidden="true" />
              </span>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] font-medium text-gray-500">Aperçu uniquement · rien n’est envoyé avant votre confirmation.</p>
        </div>
      </div>
    </>}
    <button type="button" disabled={saving || !template || !worker} data-onboarding="send" onClick={onConfirm} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"><MessageCircle className="h-5 w-5" />{saving ? "Vérification / envoi…" : "Confirmer et envoyer les demandes WhatsApp"}</button>
    <div data-onboarding-inline="send" />
    <button type="button" disabled={saving} onClick={onCancel} className="mt-2 min-h-11 text-sm font-semibold text-blue-700">Revenir à la sélection</button>
  </section>;
}
