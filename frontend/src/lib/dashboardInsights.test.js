import { planningRows, liveMissions, dashboardActions, kpis, planningDays, relativeDay, nextShift, urgency, timeAgo, enrichedActivity } from "./dashboardInsights";

const today = "2026-11-03";
const shift = (date, people_needed, confirmed_count = 0, extra = {}) => ({ date, start_time: "08:00", end_time: "18:00", people_needed, confirmed_count, ...extra });
const mission = (id, date, needed, confirmed, extra = {}) => ({ id, name: id, first_date: date, last_date: date, total_needed: needed, total_confirmed: confirmed, status: "in_progress", shifts: [shift(date, needed, confirmed)], ...extra });

test("missions happening today (backend « ongoing ») are kept, finished ones are not", () => {
  const todayMission = mission("today", today, 4, 2);
  const multiDay = mission("salon", "2026-11-01", 6, 6, { last_date: "2026-11-05" });
  const ended = mission("ended", "2026-11-01", 2, 2, { last_date: "2026-11-02" });
  const later = mission("later", "2026-11-20", 3, 0);
  const live = liveMissions({ ongoing: [todayMission, multiDay, ended], upcoming: [later, { ...later }] }, today);
  expect(live.map(m => m.id)).toEqual(["salon", "today", "later"]);
});

test("actions are ordered by urgency and skip complete or distant missions", () => {
  const missions = [mission("far", "2026-12-20", 3, 0), mission("next-week", "2026-11-09", 3, 1), mission("tomorrow", "2026-11-04", 5, 2), mission("full", "2026-11-05", 2, 2)];
  const actions = dashboardActions(missions, false, today);
  expect(actions.map(a => [a.id, a.level])).toEqual([["whatsapp", "critical"], ["tomorrow", "critical"], ["next-week", "soon"]]);
  expect(actions[1].description).toBe("3 postes à pourvoir");
});

test("kpis count this week and the overall fill rate", () => {
  const result = kpis([mission("a", "2026-11-04", 4, 3), mission("b", "2026-11-25", 6, 0)], today);
  expect(result).toMatchObject({ upcoming: 2, thisWeek: 1, missing: 7, missingThisWeek: 1, fillRate: 30 });
});

test("planning spreads multi-day shifts across days", () => {
  const salon = mission("salon", "2026-11-04", 2, 0, { last_date: "2026-11-06", shifts: [shift("2026-11-04", 2, 0, { end_date: "2026-11-06" })] });
  const days = planningDays([salon], today, 5);
  expect(days.map(d => d.items.length)).toEqual([0, 1, 1, 1, 0]);
  expect(days[0].isToday).toBe(true);
});

test("relative labels, next shift, urgency and time ago", () => {
  expect(relativeDay(today, today)).toBe("Aujourd’hui");
  expect(relativeDay("2026-11-04", today)).toBe("Demain");
  const m = mission("m", "2026-11-01", 2, 0, { last_date: "2026-11-08", shifts: [shift("2026-11-01", 1), shift("2026-11-06", 1)] });
  expect(nextShift(m, today).date).toBe("2026-11-06");
  expect(urgency(m, today)).toBe("critical");
  expect(urgency(mission("x", "2026-11-04", 0, 0), today)).toBe("undefined");
  expect(timeAgo("2026-11-03T10:00:00Z", Date.parse("2026-11-03T12:00:00Z"))).toBe("il y a 2 heures");
});

test("activity carries the mission name and hides test messages", () => {
  const items = enrichedActivity([
    { id: "1", kind: "invite", status: "sent", mission_id: "m", sent_at: "2026-11-03T10:00:00Z" },
    { id: "2", kind: "test", status: "sent", sent_at: "2026-11-03T11:00:00Z" },
  ], { upcoming: [{ id: "m", name: "Salon Lille" }] });
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ label: "Invitation", state: "Envoyé", missionName: "Salon Lille" });
});

test("gantt rows only keep missions visible in the window", () => {
  const near = mission("near", "2026-11-05", 2, 0, { last_date: "2026-11-06", shifts: [shift("2026-11-05", 2, 0, { end_date: "2026-11-06" })] });
  const far = mission("far", "2026-12-20", 2, 0);
  const { rows, hidden } = planningRows([near, far], today, 5);
  expect(rows.map(r => r.mission.id)).toEqual(["near"]);
  expect(rows[0].active).toEqual([false, false, true, true, false]);
  expect(hidden).toBe(0);
});
