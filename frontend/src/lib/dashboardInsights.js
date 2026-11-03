// Calculs du tableau de bord : missions actives (en cours + à venir), urgence,
// planning sur 14 jours et activité enrichie du nom de mission.
import { missionTeamStatus, todayKey } from "./missionPresentation";
import { notificationLabel, notificationState } from "./dashboardOverview";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const toDate = key => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d, 12); };
export const toKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const addDays = (key, days) => { const date = toDate(key); date.setDate(date.getDate() + days); return toKey(date); };
export const daysBetween = (from, to) => Math.round((toDate(to) - toDate(from)) / 86400000);

const activeShifts = mission => (Array.isArray(mission?.shifts) ? mission.shifts : [])
  .filter(s => s && s.status !== "cancelled" && !s.deleted_at && DAY.test(s.date || ""));
const lastDay = mission => mission.last_date || mission.first_date;

/** Missions en cours ou à venir (le backend place celles du jour dans « ongoing »). */
export function liveMissions(summary, today = todayKey()) {
  const all = [...(summary?.ongoing || []), ...(summary?.upcoming || [])];
  const seen = new Set();
  return all
    .filter(m => m && m.first_date && m.status !== "cancelled" && m.status !== "draft" && lastDay(m) >= today)
    .filter(m => (seen.has(m.id) ? false : seen.add(m.id)))
    .sort((a, b) => a.first_date.localeCompare(b.first_date));
}

/** Prochaine date utile d'une mission : aujourd'hui si elle a déjà commencé. */
export const focusDay = (mission, today = todayKey()) => (mission.first_date < today ? today : mission.first_date);

export function relativeDay(key, today = todayKey()) {
  const diff = daysBetween(today, key);
  if (diff === 0) return "Aujourd’hui";
  if (diff === 1) return "Demain";
  if (diff > 1 && diff < 7) return toDate(key).toLocaleDateString("fr-FR", { weekday: "long" }).replace(/^./, c => c.toUpperCase());
  return toDate(key).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Horaires du premier créneau à partir d'aujourd'hui. */
export function nextShift(mission, today = todayKey()) {
  return activeShifts(mission)
    .filter(s => (s.end_date || s.date) >= today)
    .sort((a, b) => (a.date + (a.start_time || "")).localeCompare(b.date + (b.start_time || "")))[0] || null;
}

/** Urgence d'une mission incomplète : « critical » sous 2 jours, « soon » sous 7, sinon « later ». */
export function urgency(mission, today = todayKey()) {
  const team = missionTeamStatus(mission);
  if (team.needed === 0) return "undefined";
  if (team.missing === 0) return "complete";
  const diff = daysBetween(today, focusDay(mission, today));
  return diff <= 2 ? "critical" : diff <= 7 ? "soon" : "later";
}

export function dashboardActions(missions, connected = true, today = todayKey(), horizonDays = 14) {
  const actions = [];
  if (!connected) actions.push({ type: "whatsapp", id: "whatsapp", level: "critical", label: "Connecter WhatsApp", description: "Nécessaire pour envoyer les invitations à vos équipes.", to: "/app/workers?add=1" });
  for (const mission of missions) {
    const day = focusDay(mission, today);
    if (daysBetween(today, day) > horizonDays) continue;
    const team = missionTeamStatus(mission);
    if (team.needed > 0 && team.missing === 0) continue;
    actions.push({
      type: "mission", id: mission.id, mission, level: urgency(mission, today), day, team,
      label: mission.name,
      description: team.needed === 0 ? "Équipe à définir" : `${team.missing} poste${team.missing > 1 ? "s" : ""} à pourvoir`,
      to: `/app/missions/${mission.id}`,
    });
  }
  const order = { critical: 0, soon: 1, undefined: 2, later: 3 };
  return actions.sort((a, b) => (order[a.level] ?? 4) - (order[b.level] ?? 4) || (a.day || "").localeCompare(b.day || ""));
}

export function kpis(missions, today = todayKey()) {
  const week = addDays(today, 6);
  const inWeek = missions.filter(m => focusDay(m, today) <= week);
  const teams = missions.map(missionTeamStatus);
  const needed = teams.reduce((sum, t) => sum + t.needed, 0);
  const confirmed = teams.reduce((sum, t) => sum + Math.min(t.confirmed, t.needed), 0);
  return {
    upcoming: missions.length,
    thisWeek: inWeek.length,
    missing: teams.reduce((sum, t) => sum + t.missing, 0),
    missingThisWeek: inWeek.reduce((sum, m) => sum + missionTeamStatus(m).missing, 0),
    fillRate: needed ? Math.round((confirmed / needed) * 100) : null,
    confirmed, needed,
  };
}

/** Planning des `days` prochains jours : missions actives chaque jour. */
export function planningDays(missions, today = todayKey(), days = 14) {
  return Array.from({ length: days }, (_, i) => {
    const key = addDays(today, i);
    const date = toDate(key);
    const items = missions.filter(m => {
      const shifts = activeShifts(m);
      if (shifts.length) return shifts.some(s => s.date <= key && key <= (s.end_date || s.date));
      return m.first_date <= key && key <= lastDay(m);
    });
    return {
      key, isToday: i === 0, weekend: [0, 6].includes(date.getDay()),
      weekday: date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""),
      day: date.getDate(), items,
    };
  });
}

export function timeAgo(value, now = Date.now()) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const seconds = Math.round((time - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  const units = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  return "à l’instant";
}

export function enrichedActivity(notifications, summary, limit = 6) {
  const names = new Map([...(summary?.upcoming || []), ...(summary?.ongoing || []), ...(summary?.past || [])].map(m => [m.id, m.name]));
  return (Array.isArray(notifications) ? notifications : [])
    .filter(n => (!n.channel || n.channel === "whatsapp") && n.kind !== "test")
    .sort((a, b) => (b.sent_at || "").localeCompare(a.sent_at || ""))
    .slice(0, limit)
    .map(n => ({ ...n, label: notificationLabel(n), state: notificationState(n), missionName: names.get(n.mission_id) || "" }));
}

/** Lignes du diagramme de Gantt : une mission par ligne, un booléen par jour. */
export function planningRows(missions, today = todayKey(), days = 14, max = 7) {
  const header = planningDays(missions, today, days);
  const rows = missions
    .map(mission => ({ mission, active: header.map(day => day.items.includes(mission)) }))
    .filter(row => row.active.some(Boolean))
    .slice(0, max);
  const hidden = missions.filter(m => header.some(d => d.items.includes(m))).length - rows.length;
  return { header, rows, hidden };
}
