import { isMissionPast, missionTeamStatus, missionTimeStatus, todayKey } from "./missionPresentation";

test("past recruitment-in-progress mission is displayed as a past date, not in progress", () => {
  const mission = { status: "in_progress", first_date: "2026-09-18", total_confirmed: 1, total_needed: 4 };
  expect(isMissionPast(mission, "2026-10-23")).toBe(true);
  expect(missionTimeStatus(mission, "2026-10-23").label).toBe("Date passée");
  expect(missionTeamStatus(mission)).toMatchObject({ confirmed: 1, needed: 4, missing: 3 });
});
test("a future filled mission does not belong to the history just because it is filled", () => {
  const mission = { status: "filled", first_date: "2027-02-11" };
  expect(isMissionPast(mission, "2026-10-23")).toBe(false);
  expect(missionTimeStatus(mission, "2026-10-23").label).toBe("À venir");
});
test("multiday mission ends after its last date", () => {
  expect(isMissionPast({ first_date: "2026-10-22", last_date: "2026-10-25" }, "2026-10-23")).toBe(false);
});
test("no team requirement is not automatically a complete team", () => {
  expect(missionTeamStatus({ total_needed: 0, total_confirmed: 0 }).label).toBe("Équipe à définir");
});
test("todayKey uses local calendar dates, not UTC slicing", () => {
  expect(todayKey(new Date(2026, 9, 23, 12))).toBe("2026-10-23");
});
