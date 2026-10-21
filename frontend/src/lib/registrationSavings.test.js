import { registrationSavings } from "./registrationSavings";

test("40 events with 15 people free 80 hours valued at 2800 euros", () => {
  expect(registrationSavings(40, 15)).toEqual({ annualEvents: 40, peoplePerMission: 15, hours: 80, value: 2800 });
});
test("estimates scale with workload and remain bounded", () => {
  expect(registrationSavings(80, 15).hours).toBe(160);
  expect(registrationSavings(1, 1).hours).toBe(0.6);
  expect(registrationSavings(10000, -10)).toEqual({ annualEvents: 300, peoplePerMission: 1, hours: 180, value: 6300 });
});

test("60 events and 10 people include event-level follow-up", () => {
  expect(registrationSavings(60, 10)).toEqual({ annualEvents: 60, peoplePerMission: 10, hours: 90, value: 3150 });
});
