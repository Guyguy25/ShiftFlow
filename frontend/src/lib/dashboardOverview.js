import { missionTeamStatus, todayKey } from "./missionPresentation";

export const formatMissionDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "Date à définir";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return value;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

export const activeUpcoming = (missions = []) =>
  (Array.isArray(missions) ? missions : [])
    .filter(m => m.status !== "cancelled" && m.status !== "draft" && m.first_date)
    .sort((a, b) => a.first_date.localeCompare(b.first_date));

export function upcomingActions(missions = [], connected = true, today = todayKey(), horizonDays = 14) {
  const [y, m, d] = today.split("-").map(Number);
  const deadline = new Date(y, m - 1, d + horizonDays, 12);
  const horizon = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, "0")}-${String(deadline.getDate()).padStart(2, "0")}`;
  const actions = [];
  if (!connected) actions.push({ type: "whatsapp", label: "Connecter WhatsApp", description: "La connexion est nécessaire pour envoyer les invitations.", to: "/app/workers?add=1" });
  for (const mission of activeUpcoming(missions)) {
    if (mission.first_date > horizon || mission.first_date < today) continue;
    const team = missionTeamStatus(mission);
    if (team.missing <= 0) continue;
    actions.push({
      type: "mission", id: mission.id, label: mission.name,
      description: `${team.missing} poste${team.missing > 1 ? "s" : ""} à pourvoir · ${formatMissionDate(mission.first_date)}`,
      to: `/app/missions/${mission.id}`,
    });
  }
  return actions.slice(0, 4);
}

const NOTIFICATION_KINDS = {
  invite: "Invitation", followup: "Relance", reminder: "Rappel", cancellation: "Annulation",
  removal: "Retrait d'un intervenant", change: "Modification de créneau",
  hours_request: "Demande d'heures",
};
export const notificationLabel = notification => NOTIFICATION_KINDS[notification?.kind] || "Message WhatsApp";
export const notificationState = notification => notification?.status === "sent" ? "Envoyé" : notification?.status === "failed" ? "Échec" : "En traitement";

export function recentActivity(notifications = []) {
  return (Array.isArray(notifications) ? notifications : [])
    .filter(n => !n.channel || n.channel === "whatsapp")
    .sort((a, b) => (b.sent_at || "").localeCompare(a.sent_at || ""))
    .slice(0, 4);
}
