import React from "react";

export function invitationStatusLabel(status) {
  return { contacted: "Demande envoyée", pending: "Pas encore contacté", confirmed: "Confirmé", refused: "A décliné", no_answer: "Sans réponse", cancelled: "Annulé" }[status] || status;
}

export function invitationCounts(mission) {
  const slots = (mission.shifts || []).flatMap(shift => shift.slots || []);
  return {
    sent: slots.filter(s => s.contacted_at || ["contacted", "confirmed", "refused", "no_answer"].includes(s.status)).length,
    waiting: slots.filter(s => s.status === "contacted").length,
    pending: slots.filter(s => s.status === "pending").length,
  };
}

export default function MissionFollowUp({ mission }) {
  const { sent, waiting, pending } = invitationCounts(mission);
  const cancelled = mission.status === "cancelled";
  const filled = mission.total_needed > 0 && mission.total_confirmed >= mission.total_needed;
  const title = cancelled ? "Mission annulée" : filled ? "Votre équipe est complète" : sent ? `${sent} demande${sent > 1 ? "s" : ""} envoyée${sent > 1 ? "s" : ""}` : "Aucune demande envoyée pour le moment";
  return <section className={`mt-5 rounded-2xl border p-4 sm:p-5 ${cancelled ? "bg-gray-50 border-gray-200" : "bg-blue-50 border-blue-100"}`} aria-label="Suivi des demandes" data-testid="mission-total-progress">
    <h2 className="text-xl font-semibold text-gray-900" role="status">{title}</h2>
    <p className="mt-2 text-sm leading-relaxed text-gray-600">{cancelled ? "Consultez ci-dessous les réponses déjà reçues." : waiting ? "Les intervenants contactés peuvent répondre depuis leur lien. Leurs réponses apparaîtront ici." : filled ? "Les confirmations sont visibles ci-dessous." : sent ? "Consultez les réponses ci-dessous pour compléter votre équipe." : "Choisissez les destinataires et confirmez l’envoi. Les contacts en attente ne sont pas comptés comme envoyés."}</p>
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm">
      <div><strong className="text-lg text-gray-900">{mission.total_confirmed || 0}/{mission.total_needed || 0}</strong><span className="block text-gray-600">confirmés</span></div>
      {!cancelled && <div><strong className="text-lg text-gray-900">{waiting}</strong><span className="block text-gray-600">en attente de réponse</span></div>}
      {pending > 0 && !cancelled && <div><strong className="text-lg text-gray-900">{pending}</strong><span className="block text-gray-600">pas encore contactés</span></div>}
    </div>
  </section>;
}
