import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Workers from "./Workers";
import { api } from "../lib/api";

const mockNavigate = jest.fn();
let mockParams;
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate, useSearchParams: () => [mockParams], Link: ({ to, children }) => <a href={to}>{children}</a> }), { virtual: true });
jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, formatApiError: value => value }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() }, Toaster: () => null }));
jest.mock("../components/UpgradeModal", () => () => null);
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "test" } }) }));
const destination = "/app/missions/m1?step=select&shift=s1";
let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = () => ({ matches: true });
  jest.clearAllMocks();
  api.post.mockReset();
  mockParams = new URLSearchParams({ add: "1", returnTo: destination });
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/whatsapp/status" ? { connected: false, hasQR: true } : [] }));
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); jest.useRealTimers(); });
const mount = async () => act(async () => root.render(<Workers />));
const click = async text => act(async () => Array.from(host.querySelectorAll("button")).find(b => b.textContent.includes(text)).click());
const closeChoice = async () => act(async () => host.querySelector("h3").parentElement.parentElement.querySelector("button").click());

test("closing the method picker returns to the exact originating mission and shift", async () => {
  await mount(); await closeChoice();
  expect(mockNavigate).toHaveBeenCalledWith(destination, { replace: true });
  expect(api.post).not.toHaveBeenCalled();
});
test("choosing manual entry stays in the flow; cancel returns to the mission", async () => {
  await mount(); await click("Manuellement");
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(host.querySelector('[data-testid="worker-form-modal"]')).toBeTruthy();
  await click("Annuler");
  expect(mockNavigate).toHaveBeenCalledWith(destination, { replace: true });
  expect(api.post).not.toHaveBeenCalled();
});
test("closing WhatsApp also returns to the mission without sending anything", async () => {
  await mount(); await click("Depuis WhatsApp");
  expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => host.querySelector('button[aria-label="Fermer"]').click());
  expect(mockNavigate).toHaveBeenCalledWith(destination, { replace: true });
  expect(api.post).not.toHaveBeenCalled();
});
test("ordinary team management stays on the team page when closing", async () => {
  mockParams = new URLSearchParams({ add: "1" });
  await mount(); await closeChoice();
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(host.querySelector("h3")).toBeNull();
});

test("an expired mobile link stops waiting and does not restart from polling", async () => {
  mockParams = new URLSearchParams({ connect: "1", returnTo: destination });
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/whatsapp/status" ? { connected: false, pairingExpired: true, hasQR: false, starting: false } : [] }));
  await mount();
  expect(host.textContent).toContain("Le délai de connexion est écoulé");
  expect(host.textContent).toContain("Générer un nouveau code");
  expect(host.textContent).not.toContain("En attente de la connexion WhatsApp");
  expect(api.post).not.toHaveBeenCalled();
});

const pairCode = "ABCD1234";
const mountMobilePairing = async (remainingMs = 60000) => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-09T10:00:00Z"));
  mockParams = new URLSearchParams({ connect: "1", returnTo: destination });
  // The phone clock is three hours ahead of the server clock.
  const serverTime = Date.now() - 3 * 60 * 60 * 1000;
  api.post.mockResolvedValue({ data: { code: pairCode, connected: false, serverTime, pairingDeadline: serverTime + remainingMs } });
  await mount();
  await act(async () => {
    const input = host.querySelector("#whatsapp-pair-phone");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "+33612345678");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("Obtenir mon code");
};
const advance = async ms => act(async () => jest.advanceTimersByTime(ms));

test("the mobile countdown uses the existing server deadline, including preparation time and clock skew", async () => {
  await mountMobilePairing(23000);
  expect(host.textContent).toContain(pairCode);
  expect(host.querySelector('[role="timer"]').textContent).toContain("Expire dans 0:23");
  await advance(1000);
  expect(host.querySelector('[role="timer"]').textContent).toContain("Expire dans 0:22");
});

test("at 60 seconds the code and waiting message disappear and a blue explicit retry preserves the phone number", async () => {
  await mountMobilePairing();
  expect(host.querySelector('[role="timer"]').textContent).toContain("Expire dans 1:00");
  await advance(59000);
  expect(host.textContent).toContain(pairCode);
  await advance(1000);
  expect(host.textContent).not.toContain(pairCode);
  expect(host.textContent).not.toContain("En attente de la connexion WhatsApp");
  expect(host.querySelector('[role="timer"]')).toBeNull();
  expect(host.querySelector('[role="alert"]').textContent).toContain("Ce code a expiré");
  const retry = Array.from(host.querySelectorAll("button")).find(b => b.textContent === "Générer un nouveau code");
  expect(retry.classList.contains("bg-blue-600")).toBe(true);
  expect(host.querySelector("#whatsapp-pair-phone").value).toBe("+33612345678");
  expect(api.post).toHaveBeenCalledTimes(1);

  api.post.mockResolvedValueOnce({ data: { code: "WXYZ5678", serverTime: Date.now(), pairingDeadline: Date.now() + 60000 } });
  await click("Générer un nouveau code");
  expect(api.post).toHaveBeenLastCalledWith("/whatsapp/session/pair-code", { phone: "+33612345678" });
  expect(host.textContent).toContain("WXYZ5678");
  expect(host.querySelector('[role="timer"]').textContent).toContain("Expire dans 1:00");
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

test("returning from WhatsApp recomputes expiration even when browser timers were suspended", async () => {
  await mountMobilePairing();
  await act(async () => {
    jest.setSystemTime(Date.now() + 61000);
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(host.textContent).not.toContain(pairCode);
  expect(host.textContent).toContain("Générer un nouveau code");
  expect(host.textContent).not.toContain("En attente de la connexion WhatsApp");
  expect(api.post).toHaveBeenCalledTimes(1);
});

test("a server pairing failure immediately invalidates the code while a 515 restart preserves it", async () => {
  await mountMobilePairing();
  api.get.mockResolvedValue({ data: { connected: false, hasQR: true, pairingExpired: false, lastConnectionError: 515 } });
  await advance(2000);
  expect(host.textContent).toContain(pairCode);
  expect(host.querySelector('[role="alert"]')).toBeNull();

  api.get.mockResolvedValue({ data: { connected: false, hasQR: false, pairingExpired: true, lastConnectionError: "pairing_failed" } });
  await advance(2000);
  expect(host.textContent).not.toContain(pairCode);
  expect(host.querySelector('[role="alert"]').textContent).toContain("La connexion WhatsApp a échoué");
  expect(host.textContent).toContain("Générer un nouveau code");
  expect(api.post).toHaveBeenCalledTimes(1);
});

test("an old expired status response cannot invalidate a regenerated code", async () => {
  await mountMobilePairing(1000);
  let resolveOldStatus;
  api.get.mockImplementationOnce(() => new Promise(resolve => { resolveOldStatus = resolve; }));
  await advance(2000);
  api.post.mockResolvedValueOnce({ data: { code: "WXYZ5678", serverTime: Date.now(), pairingDeadline: Date.now() + 60000 } });
  await click("Générer un nouveau code");
  await act(async () => resolveOldStatus({ data: { connected: false, pairingExpired: true, lastConnectionError: "pairing_timeout" } }));
  expect(host.textContent).toContain("WXYZ5678");
  expect(host.querySelector('[role="timer"]')).toBeTruthy();
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

test("status network failures do not prevent local expiration or leave a stale code visible", async () => {
  await mountMobilePairing(3000);
  api.get.mockRejectedValue({ response: { status: 503 } });
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await advance(3000);
    expect(host.textContent).not.toContain(pairCode);
    expect(host.textContent).toContain("Ce code a expiré");
    expect(host.textContent).toContain("Générer un nouveau code");
    expect(api.post).toHaveBeenCalledTimes(1);
  } finally { log.mockRestore(); }
});

test("a successful connection replaces the code flow without showing an expiration error later", async () => {
  await mountMobilePairing();
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/whatsapp/status" ? { connected: true } : [] }));
  await advance(2000);
  await advance(60000);
  expect(host.textContent).toContain("Choix des contacts");
  expect(host.textContent).not.toContain(pairCode);
  expect(host.textContent).not.toContain("Ce code a expiré");
  expect(host.querySelector('[role="timer"]')).toBeNull();
});

test("a backend without deadline metadata never gets an invented 60-second countdown", async () => {
  await mountMobilePairing();
  await click("Utiliser un autre numéro");
  api.post.mockResolvedValueOnce({ data: { code: "WXYZ5678" } });
  await click("Obtenir mon code");
  expect(host.textContent).toContain("WXYZ5678");
  expect(host.querySelector('[role="timer"]')).toBeNull();
});
test("failed contact synchronization never shows a successful empty address book", async () => {
  mockParams = new URLSearchParams({ connect: "1", returnTo: destination });
  api.get.mockImplementation(url => url === "/whatsapp/contacts" ? Promise.reject({ response: { status: 503 } }) : Promise.resolve({ data: url === "/whatsapp/status" ? { connected: true } : [] }));
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await mount();
    expect(host.textContent).toContain("Impossible de charger vos contacts");
    expect(host.textContent).not.toContain("0 contacts disponibles");
  } finally { log.mockRestore(); }
});
