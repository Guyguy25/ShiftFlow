export const SLOT_STATUS_LABEL = {
  pending: "En attente",
  contacted: "Contacté",
  confirmed: "Confirmé",
  refused: "Refusé",
  no_answer: "Sans réponse",
  cancelled: "Annulé",
};

export const MISSION_STATUS_LABEL = {
  draft: "Brouillon",
  in_progress: "En cours",
  filled: "Équipe complète",
  cancelled: "Annulée",
};

export function slotClass(status) {
  return `status-${status}`;
}
