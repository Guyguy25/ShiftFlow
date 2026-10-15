import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { ShiftSelector } from "../pages/MissionDetail";
import Demo from "../pages/Demo";
import { renderInvitationPreview, validateMessage } from "./InvitationReview";
import { api } from "../lib/api";

jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, formatApiError: value => value }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { agency_name: "Équipe test" } }) }));
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn(), Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock("./ContextGuide", () => () => null);
jest.mock("./WhatsAppQrGuide", () => () => <p>QR de test</p>);
jest.mock("sonner", () => ({ toast: { success: jest.fn() }, Toaster: () => null }));

const workers = [{ id: "w1", first_name: "Camille", last_name: "Test", phone: "numéro fictif" }];
const mission = { id: "m1", name: "Montage", location: "Lille" };
const shift = { id: "s1", people_needed: 1, confirmed_count: 0, date: "2026-10-01", start_time: "08:00", end_time: "12:00", rate_hourly: 25 };
let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = () => ({ matches: false });
  jest.clearAllMocks();
  api.get.mockImplementation(url => Promise.resolve({ data: url.includes("message-template") ? { template: "Bonjour {prenom}, {agence} propose {mission} le {date} : {lien}" } : { connected: true } }));
  api.post.mockResolvedValue({ data: {} });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const click = async text => { const button = Array.from(host.querySelectorAll("button")).find(node => node.textContent.includes(text)); expect(button).toBeTruthy(); await act(async () => button.click()); };
const mount = async () => act(async () => root.render(<ShiftSelector mission={mission} shift={shift} workers={workers} onSelected={jest.fn()} />));
const review = async () => { await mount(); await click("Camille"); await click("Vérifier le message"); };

test("selecting contacts and reading the real template does not send; confirmation sends once", async () => {
  await review();
  expect(host.textContent).toContain("Bonjour Camille, Équipe test propose Montage");
  expect(api.post).not.toHaveBeenCalled();
  await click("Confirmer et envoyer");
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith("/shifts/s1/select-workers", { worker_ids: ["w1"], invitation_template: "Bonjour {prenom}, {agence} propose {mission} le {date} : {lien}" });
});

test("a template loading failure blocks sending and supports retry", async () => {
  api.get.mockRejectedValueOnce(new Error("offline"));
  await review();
  expect(host.textContent).toContain("Impossible de charger le message");
  await click("Confirmer et envoyer");
  expect(api.post).not.toHaveBeenCalled();
  await click("Réessayer");
  expect(host.textContent).toContain("Bonjour Camille");
});

test("changing recipients invalidates review", async () => {
  await review();
  await act(async () => host.querySelector('button[title="Retirer"]').click());
  expect(host.textContent).not.toContain("Vérifiez avant de lancer les demandes");
  expect(api.post).not.toHaveBeenCalled();
});

test("connecting WhatsApp returns to review without automatically sending", async () => {
  let statusCalls = 0;
  api.get.mockImplementation(url => Promise.resolve({ data: url.includes("message-template") ? { template: "Bonjour {prenom} {mission} {date} {lien}" } : { connected: ++statusCalls > 1 } }));
  await review();
  await click("Confirmer et envoyer");
  expect(host.textContent).toContain("Vérifiez avant de lancer les demandes");
  expect(api.post).not.toHaveBeenCalled();
  await click("Confirmer et envoyer");
  expect(api.post).toHaveBeenCalledTimes(1);
});

test("mission connection on desktop starts with phone pairing before showing the guide", async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url.includes("message-template") ? { template: "Bonjour {prenom} {mission} {date} {lien}" } : { connected: false, hasQR: true, qr: "data:image/png;base64,test" } }));
  await review();
  await click("Confirmer et envoyer");
  expect(host.querySelector("#whatsapp-pair-phone")).toBeTruthy();
  expect(host.textContent).toContain("Obtenir mon code");
  expect(host.querySelector('img[src="/phone-link-guide.png"]')).toBeNull();
  expect(host.querySelector('[aria-current="step"]').textContent).toContain("Votre numéro");
  expect(host.textContent).not.toContain("QR de test");
  expect(api.post).not.toHaveBeenCalled();
});

test("rapid repeated confirmation cannot duplicate a pending request", async () => {
  await review();
  let resolveStatus;
  api.get.mockImplementationOnce(() => new Promise(resolve => { resolveStatus = resolve; }));
  const button = Array.from(host.querySelectorAll("button")).find(node => node.textContent.includes("Confirmer et envoyer"));
  await act(async () => { button.click(); button.click(); });
  await act(async () => resolveStatus({ data: { connected: true } }));
  expect(api.post).toHaveBeenCalledTimes(1);
});

test("demo completes and resets without API calls or real mission creation", async () => {
  await act(async () => root.render(<Demo />));
  await click("Simuler la première demande"); await click("Simuler le refus"); await click("Simuler la confirmation");
  expect(host.textContent).toContain("L’équipe de l’exemple est complète");
  await click("Recommencer");
  expect(host.textContent).toContain("Étape 1 sur 4");
  expect(api.get).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
});

test("preview safely preserves currency, newlines and zero values", () => {
  expect(renderInvitationPreview("{prenom}\n{tarif}€/h {lieu} {lien}", workers[0], { ...shift, rate_hourly: 0 }, { ...mission, location: "$&" }, {})).toBe("Camille\n0 €/h $& [Lien personnel généré lors de l’envoi]");
});

test("editing updates the preview and sends the exact reviewed template", async () => {
  await review();
  const textarea = host.querySelector('textarea[aria-label="Message WhatsApp avant envoi"]');
  const template = "Bonjour {prenom}, mon nouveau message pour {mission} le {date} : {lien}";
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, template);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.textContent).toContain("mon nouveau message pour Montage");
  expect(api.post).not.toHaveBeenCalled();
  await click("Confirmer et envoyer");
  expect(api.post).toHaveBeenCalledWith("/shifts/s1/select-workers", { worker_ids: ["w1"], invitation_template: template });
});

test("invalid edited text blocks sending", async () => {
  await review();
  const textarea = host.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(textarea, "Bonjour");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Confirmer et envoyer");
  expect(api.post).not.toHaveBeenCalled();
  expect(validateMessage("{prenom} {mission} {date} {lien} https://evil.invalid").length).toBeGreaterThan(0);
});

test("legacy hourly placeholder shows a fixed net cachet truthfully", () => {
  expect(renderInvitationPreview("{tarif}€/h", workers[0], { ...shift, pay_type: "fixed", fixed_amount: 180, pay_basis: "net" }, mission, {})).toBe("180 € net / cachet");
});
