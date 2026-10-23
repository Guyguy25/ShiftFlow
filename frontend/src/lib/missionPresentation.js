// Presentation-only helpers: never modify the backend mission lifecycle.
export const todayKey = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

export const missionEndDate = mission => mission.last_date || mission.first_date || "";

export function isMissionPast(mission, today = todayKey()) {
  return !!missionEndDate(mission) && missionEndDate(mission) < today;
}

export function missionTimeStatus(mission, today = todayKey()) {
  if (mission.status === "cancelled") return { label: "Annulée", style: "status-cancelled" };
  if (mission.status === "draft") return { label: "Brouillon", style: "status-contacted" };
  if (isMissionPast(mission, today)) return { label: "Date passée", style: "bg-gray-100 text-gray-700 border-gray-200" };
  return { label: "À venir", style: "status-contacted" };
}

export function missionTeamStatus(mission) {
  const needed = Math.max(0, Number(mission.total_needed) || 0);
  const confirmed = Math.max(0, Number(mission.total_confirmed) || 0);
  const missing = Math.max(0, needed - confirmed);
  return {
    needed, confirmed, missing,
    label: needed === 0 ? "Équipe à définir" : missing === 0 ? "Équipe complète" : `${missing} poste${missing > 1 ? "s" : ""} à pourvoir`,
    style: needed > 0 && missing === 0 ? "status-confirmed" : "status-waiting",
  };
}

export const missionSortDate = mission => mission.first_date || missionEndDate(mission) || "9999-12-31";
