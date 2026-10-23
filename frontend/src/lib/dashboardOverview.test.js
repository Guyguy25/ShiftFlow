import { activeUpcoming, formatMissionDate, recentActivity, upcomingActions, notificationState } from "./dashboardOverview";

const far = {id:"far",name:"Concert distant",first_date:"2027-02-11",status:"in_progress",total_needed:5,total_confirmed:0};
const near = {id:"near",name:"Événement proche",first_date:"2026-10-27",status:"in_progress",total_needed:4,total_confirmed:1};

test("distant vacancies are not shown as urgent actions", () => {
  expect(upcomingActions([far], true, "2026-10-23")).toEqual([]);
});
test("only soon-to-start missions with missing people generate action items", () => {
  const filled = {...near, id:"filled",total_confirmed:4};
  const old = {...near,id:"old",first_date:"2026-10-12"};
  const cancelled = {...near,id:"cancelled",status:"cancelled"};
  const actions = upcomingActions([far,filled,old,cancelled,near], true, "2026-10-23");
  expect(actions).toHaveLength(1);
  expect(actions[0]).toMatchObject({ id:"near", to:"/app/missions/near" });
  expect(actions[0].description).toContain("3 postes à pourvoir");
});
test("WhatsApp interruption creates actionable priority without inventing missions", () => {
  expect(upcomingActions([], false, "2026-10-23")[0].to).toBe("/app/workers?add=1");
});
test("upcoming list excludes drafts/cancelled and sorts dates", () => {
  const next = {...near,first_date:"2026-10-25"};
  expect(activeUpcoming([far,{...near,status:"draft"},next]).map(m=>m.id)).toEqual(["near","far"]);
});
test("activity sorts recent entries and handles missing data", () => {
  expect(recentActivity([{id:1,sent_at:"2026-10-21T08:00:00"},{id:2,sent_at:"2026-10-22T09:00:00"}])[0].id).toBe(2);
  expect(recentActivity(null)).toEqual([]);
  expect(notificationState({status:"failed"})).toBe("Échec");
});
test("French mission date is generated from local date parts", () => {
  expect(formatMissionDate("2026-10-23")).toContain("23 octobre 2026");
});
