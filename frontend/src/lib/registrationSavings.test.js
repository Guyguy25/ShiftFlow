import { registrationSavings } from "./registrationSavings";

test("40 events with 15 people free 30 hours valued at 900 euros", () => {
  expect(registrationSavings(40, 15)).toEqual({ annualEvents: 40, peoplePerMission: 15, hours: 30, value: 900 });
});
test("estimates scale with workload and remain bounded", () => {
  expect(registrationSavings(80, 15).hours).toBe(60);
  expect(registrationSavings(1, 1).hours).toBe(0.05);
  expect(registrationSavings(10000, -10)).toEqual({ annualEvents: 300, peoplePerMission: 1, hours: 15, value: 450 });
});
