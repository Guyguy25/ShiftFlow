import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MissionTeamSetup from "./MissionTeamSetup";
import { WhatsAppImportModal } from "../pages/Workers";
import { api } from "../lib/api";

jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, formatApiError: value => value }));
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn(), Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock("./UpgradeModal", () => () => null);
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() }, Toaster: () => null }));
const shift = { id: "s1", date: "2026-10-01", start_time: "08:00", end_time: "12:00", people_needed: 2 };
const mission = { id: "m1", name: "Mon montage", location: "Lille", shifts: [shift] };
let root, host;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = () => ({ matches: true });
  jest.clearAllMocks();
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/whatsapp/status" ? { connected: false, hasQR: true } : [{ id: "c1", name: "Camille Test", number: "33600000000" }] }));
  api.post.mockResolvedValue({ data: { created: 1 } });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const click = async text => act(async () => { const button = Array.from(host.querySelectorAll("button")).find(b => b.textContent.includes(text)); expect(button).toBeTruthy(); button.click(); });
test("mission setup has one primary action which opens mobile connection in place", async () => {
  await act(async () => root.render(<MissionTeamSetup mission={mission} shift={shift} workers={[]} />));
  expect(host.querySelectorAll("button")).toHaveLength(1);
  expect(api.post).not.toHaveBeenCalled();
  await click("Ajouter via WhatsApp");
  expect(host.querySelector('input[type="tel"]')).toBeTruthy();
  expect(host.textContent).toContain("Obtenir mon code");
  expect(host.textContent).not.toContain("Coût brut estimé");
  expect(api.post.mock.calls.every(([url]) => url === "/whatsapp/session/start")).toBe(true);
});
test("import only adds checked contacts once and returns to mission preparation without sending", async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/whatsapp/status" ? { connected: true } : [{ id: "c1", name: "Camille Test", number: "33600000000" }] }));
  const done = jest.fn(), close = jest.fn();
  await act(async () => root.render(<WhatsAppImportModal inline onDone={done} onClose={close} onQuota={jest.fn()} />));
  expect(host.querySelector('input[type="checkbox"]').checked).toBe(false);
  expect(api.post.mock.calls.some(([url]) => url === "/whatsapp/import")).toBe(false);
  await act(async () => host.querySelector('input[type="checkbox"]').click());
  const button = Array.from(host.querySelectorAll("button")).find(b => b.textContent.includes("Ajouter 1"));
  await act(async () => { button.click(); button.click(); });
  expect(api.post.mock.calls.filter(([url]) => url === "/whatsapp/import")).toEqual([["/whatsapp/import", { contacts: ["c1"] }]]);
  expect(done).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls.some(([url]) => url.includes("select-workers"))).toBe(false);
});
test("team loading failure does not masquerade as an empty address book", async () => {
  await act(async () => root.render(<MissionTeamSetup mission={mission} shift={shift} workers={[]} error="Impossible de charger" />));
  expect(host.querySelector('[role="alert"]')).toBeTruthy();
  expect(host.textContent).not.toContain("Ajouter via WhatsApp");
});
test("imported team proceeds to the recipient selection instead of offering another import", async () => {
  await act(async () => root.render(<MissionTeamSetup mission={mission} shift={shift} workers={[{ id: "w1" }]}><p>Choix des destinataires</p></MissionTeamSetup>));
  expect(host.textContent).toContain("Choix des destinataires");
  expect(host.textContent).not.toContain("Ajouter via WhatsApp");
});
