import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Hours from "./Hours";
import PublicHours from "./PublicHours";
import { api } from "../lib/api";

jest.mock("react-router-dom", () => ({ useSearchParams: () => [new URLSearchParams("mission=m")], Link: ({ to, children }) => <a href={to}>{children}</a> }), { virtual: true });
jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn() }, formatApiError: value => typeof value === "string" ? value : "Erreur de connexion" }));
const period = { start: "2026-10-18T22:00:00+02:00", end: "2026-10-19T06:00:00+02:00", break_minutes: 30, minutes: 450 };
const row = { id: "slot", mission_id: "m", worker_name: "Paul Test", mission_name: "Concert", timezone: "Europe/Paris", status: "pending", version: 1, entries: [period], planned_entries: [period], compensation: { pay_type: "hourly", rate_hourly: 20 }, history: [] };
const dashboard = items => ({ items, summary: { approved_minutes: 0, counts: { submitted: 1 }, approved_amount_cents: { gross: 0, net: 0, unspecified: 0 } } });
let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks(); api.post.mockReset(); api.get.mockReset(); api.put.mockReset();
  window.history.replaceState(null, "", "/hours#personal-token");
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const mount = component => act(async () => root.render(component));
const findButton = label => Array.from(host.querySelectorAll("button")).find(button => button.textContent.includes(label));
const click = label => act(async () => findButton(label).click());
const change = (element, value) => act(async () => {
  const proto = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
});
const mockOwner = items => api.get.mockImplementation(url => Promise.resolve({ data: url === "/hours" ? dashboard(items) : url === "/missions" ? [{ id: "m", name: "Concert" }] : { enabled: false, delay_hours: 1, reminder_hours: 48, max_reminders: 2, link_days: 30 } }));

test("individual form loads identity and planned overnight times without an account", async () => {
  api.post.mockResolvedValue({ data: row });
  await mount(<PublicHours />);
  expect(api.post).toHaveBeenCalledWith("/public/hours/access", { token: "personal-token" });
  expect(host.textContent).toContain("Paul Test");
  const dates = host.querySelectorAll('input[type="datetime-local"]');
  expect(dates[0].value).toBe("2026-10-18T22:00"); expect(dates[1].value).toBe("2026-10-19T06:00");
  expect(host.querySelector('input[type="number"]').value).toBe("30");
  expect(host.textContent).not.toContain("Créer un compte");
});

test("modified hours submit token and version once and then become read-only", async () => {
  api.post.mockResolvedValueOnce({ data: row }).mockResolvedValueOnce({ data: { ...row, status: "submitted", minutes: 510, amount_cents: 17000, version: 2 } });
  await mount(<PublicHours />);
  await change(host.querySelectorAll('input[type="datetime-local"]')[1], "2026-10-19T07:00");
  await act(async () => {
    host.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    host.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post.mock.calls[1][1]).toMatchObject({ token: "personal-token", version: 1, entries: [{ end: "2026-10-19T07:00", break_minutes: 30 }] });
  expect(host.textContent).toContain("En attente de validation");
  expect(host.querySelector("form")).toBeNull();
});

test("expired link shows actionable error and no form", async () => {
  api.post.mockRejectedValue({ response: { data: { detail: "Lien expiré. Demandez un nouveau lien à l'organisateur." } } });
  await mount(<PublicHours />);
  expect(host.querySelector('[role="alert"]').textContent).toContain("Lien expiré");
  expect(host.querySelector("form")).toBeNull();
});

test("correction reopens submitted periods and preserves organizer reason", async () => {
  api.post.mockResolvedValue({ data: { ...row, status: "correction_requested", version: 4, reason: "Corrigez la pause" } });
  await mount(<PublicHours />);
  expect(host.textContent).toContain("Corrigez la pause");
  expect(findButton("Soumettre mes heures")).toBeTruthy();
  await click("Ajouter une période");
  expect(host.querySelectorAll('input[type="datetime-local"]')).toHaveLength(4);
});

test("organizer requests confirmed workers for selected mission and reports delivery failures", async () => {
  mockOwner([]); api.post.mockResolvedValue({ data: { sent: 2, failed: 1, skipped: 1 } });
  await mount(<Hours />); await click("Demander / relancer");
  expect(api.post).toHaveBeenCalledWith("/missions/m/hours/request");
  expect(host.querySelector('[role="status"]').textContent).toContain("1 échec");
});

test("organizer correction requires a reason and sends current version", async () => {
  mockOwner([{ ...row, status: "submitted", version: 3 }]); api.post.mockResolvedValue({ data: { ok: true, delivery: "failed" } });
  await mount(<Hours />);
  expect(findButton("Demander une correction").disabled).toBe(true);
  await change(host.querySelector("textarea"), "Vérifier la fin de mission");
  await click("Demander une correction");
  expect(api.post).toHaveBeenCalledWith("/hours/slot/review", { version: 3, action: "correction_requested", reason: "Vérifier la fin de mission" });
  expect(host.textContent).toContain("Décision enregistrée. Le message a échoué");
});

test("conflicting approval displays server error and keeps declaration available", async () => {
  mockOwner([{ ...row, status: "submitted" }]);
  api.post.mockRejectedValue({ response: { data: { detail: "Cette déclaration a changé. Rechargez la page." } } });
  await mount(<Hours />); await click("Valider");
  expect(host.querySelector('[role="alert"]').textContent).toContain("Rechargez");
  expect(findButton("Valider").disabled).toBe(false);
});

test("reminder settings are saved as agency configuration", async () => {
  mockOwner([]); api.put.mockResolvedValue({ data: {} });
  await mount(<Hours />);
  await change(host.querySelector('input[type="number"]'), "4");
  await act(async () => host.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(api.put).toHaveBeenCalledWith("/hours/settings", expect.objectContaining({ delay_hours: 4, reminder_hours: 48, max_reminders: 2, enabled: false }));
});
