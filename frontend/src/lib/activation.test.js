import { activationNext } from "./activation";

const mission = { id: "m1", name: "Salon", status: "draft", shifts: [{ people_needed: 2, confirmed_count: 0 }] };
const base = { activation: { active_workers: 0, first_invite_sent: false }, missions_total: 0, ongoing: [], upcoming: [] };
test("guides a new account to mission creation", () => {
  expect(activationNext(base, null).href).toBe("/app/missions/new");
});
test("adding workers preserves the mission destination", () => {
  const next = activationNext({ ...base, missions_total: 1, upcoming: [mission] }, null);
  expect(new URLSearchParams(next.href.split("?")[1]).get("returnTo")).toBe("/app/missions/m1?step=select");
});
test("unknown WhatsApp status is not reported as disconnected", () => {
  const summary = { ...base, upcoming: [mission], activation: { active_workers: 1 } };
  expect(activationNext(summary, null).label).toBe("Vérifier WhatsApp");
  expect(activationNext(summary, { connected: false }).label).toBe("Connecter WhatsApp");
  expect(activationNext(summary, { connected: true }).href).toBe("/app/missions/m1?step=select");
});
test("successful first invitation removes onboarding even after disconnection", () => {
  expect(activationNext({ ...base, activation: { first_invite_sent: true } }, { connected: false })).toBeNull();
});
test("expired trial directs to the offer and filled/cancelled shifts are excluded", () => {
  expect(activationNext(base, null, { trial_expired: true }).href).toBe("/pricing");
  for (const shifts of [[{ people_needed: 2, confirmed_count: 2 }], [{ people_needed: 2, status: "cancelled" }]]) {
    expect(activationNext({ ...base, upcoming: [{ ...mission, shifts }] }, null).href).toBe("/app/missions/new");
  }
});
test("older API responses do not imply a new account", () => {
  expect(activationNext({ ...base, activation: undefined }, null)).toBeNull();
});
