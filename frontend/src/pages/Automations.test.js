import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Automations from "./Automations";
import { api } from "../lib/api";
jest.mock("../lib/api", () => ({ api: { get: jest.fn(), put: jest.fn() }, formatApiError: value => value }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "free-user", plan: "free" } }) }));
jest.mock("react-router-dom", () => ({ Link: ({ to, children }) => <a href={to}>{children}</a> }), { virtual: true });
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() }, Toaster: () => null }));
const legacy = "Bonjour {prenom}, invitation historique {mission} le {date} : {lien}";
const followup = "Bonjour {prenom}, relance pour {mission} le {date} : {lien}";
let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks();
  api.get.mockImplementation(url => Promise.resolve({ data: url.includes("automations") ? { template: legacy, templates: { invite: legacy, followup, cancellation: followup, removal: followup, change: followup }, defaults: { invite: "Bonjour {prenom} {mission} {date} {lien}" }, variables: [], required: ["{prenom}", "{mission}", "{date}", "{lien}"] } : url.includes("notifications") ? [] : {} }));
  api.put.mockImplementation((url, data) => Promise.resolve({ data }));
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const click = async text => act(async () => Array.from(host.querySelectorAll("button")).find(button => button.textContent.includes(text)).click());
const setValue = async (element, value) => act(async () => {
  const proto = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
  element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
});
test("a free account can edit legacy invitations and a separate followup model", async () => {
  await act(async () => root.render(<Automations />));
  const textarea = host.querySelector("textarea");
  expect(textarea.disabled).toBe(false); expect(textarea.value).toBe(legacy);
  expect(host.textContent).toContain("Messages & relances");
  expect(host.textContent).not.toContain("Personnalisation réservée");
  await setValue(host.querySelector('select[aria-label="Type de message"]'), "followup");
  expect(textarea.value).toBe(followup);
  const edited = followup.replace("relance", "relance personnalisée");
  await setValue(textarea, edited); await click("Enregistrer le message");
  expect(api.put).toHaveBeenCalledWith("/whatsapp/automations/followup", { template: edited });
  await setValue(host.querySelector("select"), "invite");
  expect(textarea.value).toBe(legacy);
});
test("invalid automation message disables saving", async () => {
  await act(async () => root.render(<Automations />));
  await setValue(host.querySelector("textarea"), "Message sans variables");
  expect(host.querySelector('[data-testid="automations-whatsapp-template-save"]').disabled).toBe(true);
  expect(api.put).not.toHaveBeenCalled();
});


test("WhatsApp preview replaces tokens without sending anything", async () => {
  await act(async () => root.render(<Automations />));
  const preview = host.querySelector('[data-testid="automations-whatsapp-preview"]');
  expect(preview).toBeTruthy();
  expect(preview.textContent).toContain("Camille");
  expect(preview.textContent).toContain("[lien sécurisé ShiftFlow]");
  expect(preview.textContent).toContain("Aucun message");
  expect(api.put).not.toHaveBeenCalled();
});

test("communications are separated into clear tabs with messages preview, reminders, and send history", async () => {
  await act(async () => root.render(<Automations />));
  expect(host.querySelectorAll('[role="tab"]')).toHaveLength(3);
  expect(host.querySelector('[data-testid="automations-whatsapp-template-input"]')).toBeTruthy();
  expect(host.querySelector('[data-testid="automations-whatsapp-preview"]')).toBeTruthy();
  expect(host.querySelector('[data-testid="automations-advanced-options"]').open).toBe(false);
  await click("Relances & rappels");
  expect(host.textContent).toContain("Rappel avant mission");
  expect(host.textContent).toContain("24 h");
  await click("Historique des envois");
  expect(host.textContent).toContain("Aucun envoi enregistré");
  expect(api.put).not.toHaveBeenCalled();
});

test("the relance shortcut opens the relevant message model without sending messages", async () => {
  await act(async () => root.render(<Automations />));
  await click("Relances & rappels");
  await click("Modifier le message de relance");
  expect(host.querySelector('select[aria-label="Type de message"]').value).toBe("followup");
  expect(host.querySelector("textarea").value).toBe(followup);
  expect(api.put).not.toHaveBeenCalled();
});
