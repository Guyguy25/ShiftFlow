import React, { act } from "react";
import { createRoot } from "react-dom/client";
import DemoQualification from "./DemoQualification";
import { api } from "../lib/api";
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock("../lib/api", () => ({ api: { post: jest.fn() } }));
jest.mock("./CalendlyInlineBooking", () => ({ __esModule: true, default: ({ name, email }) => <div data-testid="calendar">{name} {email}</div> }));
let host, root;
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true; api.post.mockReset();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  await act(async () => root.render(<DemoQualification />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const click = async el => act(async () => el.click());
const next = () => host.querySelector('button[type="submit"]');
const choose = async (key, value) => click(Array.from(host.querySelectorAll(`input[name="${key}"]`)).find(el => el.value === value));
async function toContacts() {
  await choose("monthly_missions", "1 à 3"); await choose("team_size", "Plus de 20"); await click(next());
  await choose("need", "Les remplacements après un désistement"); await choose("mission", "Dans les 7 prochains jours"); await click(next());
  for (const [key, value] of Object.entries({ name: "Alex", email: "alex@example.com", company: "Agence" })) {
    await act(async () => { const input = host.querySelector(`input[name="${key}"]`); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
  }
}
test("requires context, preserves answers on back, and keeps small teams eligible", async () => {
  expect(next().disabled).toBe(true); await choose("monthly_missions", "1 à 3"); expect(next().disabled).toBe(true);
  await choose("team_size", "1 à 5"); await click(next()); await click(Array.from(host.querySelectorAll("button")).find(el => el.textContent.includes("Retour")));
  expect(host.querySelector('input[name="monthly_missions"]:checked').value).toBe("1 à 3"); expect(host.querySelector('input[name="team_size"]:checked').value).toBe("1 à 5");
  expect(next().disabled).toBe(false); expect(api.post).not.toHaveBeenCalled();
});
test("stores qualification before opening prefilled calendar and preserves contacts", async () => {
  api.post.mockResolvedValue({ data: {} }); await toContacts(); await click(next());
  expect(api.post).toHaveBeenCalledWith("/public/accompanied-trial", { name: "Alex", email: "alex@example.com", company: "Agence", monthly_missions: "1 à 3", team_size: "Plus de 20", need: "Les remplacements après un désistement", mission: "Dans les 7 prochains jours" });
  expect(host.querySelector('[data-testid="calendar"]').textContent).toBe("Alex alex@example.com");
  await click(Array.from(host.querySelectorAll("button")).find(el => el.textContent.includes("Modifier"))); expect(host.querySelector('input[name="email"]').value).toBe("alex@example.com");
});
test("failed requests preserve answers and allow retry without opening calendar", async () => {
  api.post.mockRejectedValue(new Error("offline")); await toContacts(); await click(next());
  expect(host.querySelector('[role="alert"]')).toBeTruthy(); expect(host.querySelector('[data-testid="calendar"]')).toBeNull(); expect(host.querySelector('input[name="email"]').value).toBe("alex@example.com");
  api.post.mockResolvedValue({ data: {} }); await click(next()); expect(host.querySelector('[data-testid="calendar"]')).toBeTruthy();
});

test("supports multiple needs, deselection, back navigation and joined API payload", async () => {
  api.post.mockResolvedValue({ data: {} });
  await toContacts();
  await click(Array.from(host.querySelectorAll("button")).find(el => el.textContent.includes("Retour")));
  expect(host.querySelectorAll('input[name="need"][type="checkbox"]').length).toBe(5);
  await choose("need", "Les messages et les relances");
  expect(host.querySelectorAll('input[name="need"]:checked').length).toBe(2);
  await choose("need", "Les remplacements après un désistement");
  await choose("need", "Les messages et les relances");
  expect(next().disabled).toBe(true);
  await choose("need", "Les messages et les relances");
  await choose("need", "Le suivi des confirmations");
  await click(next());
  await click(Array.from(host.querySelectorAll("button")).find(el => el.textContent.includes("Retour")));
  expect(host.querySelectorAll('input[name="need"]:checked').length).toBe(2);
  await click(next()); await click(next());
  expect(api.post).toHaveBeenCalledWith("/public/accompanied-trial", expect.objectContaining({ need: "Les messages et les relances\nLe suivi des confirmations" }));
});
