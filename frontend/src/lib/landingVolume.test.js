import { estimateLandingVolume, formatLandingTime } from "./landingVolume";

test("makes each workload assumption explicit without counting replies as outbound work", () => {
  expect(estimateLandingVolume({ missions: 10, people: 15, refusals: 3 })).toEqual({
    initialRequests: 150,
    replacementRequests: 30,
    reminders: 150,
    actions: 330,
    estimatedMinutes: 330,
  });
});

test("zero refusals do not introduce fictional replacements", () => {
  expect(estimateLandingVolume({ missions: 1, people: 5, refusals: 0 })).toEqual({
    initialRequests: 5,
    replacementRequests: 0,
    reminders: 5,
    actions: 10,
    estimatedMinutes: 10,
  });
});

test("simulates seasonal volume changes", () => {
  expect(estimateLandingVolume({ missions: 30, people: 40, refusals: 10 }).actions).toBe(2700);
});

test("formats time in French with consistent minutes", () => {
  expect(formatLandingTime(30)).toBe("30 min");
  expect(formatLandingTime(60)).toBe("1 h");
  expect(formatLandingTime(90)).toBe("1 h 30");
  expect(formatLandingTime(330)).toBe("5 h 30");
  expect(formatLandingTime(361)).toBe("6 h 01");
});
