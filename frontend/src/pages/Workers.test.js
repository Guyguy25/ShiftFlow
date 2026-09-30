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
  mockParams = new URLSearchParams({ add: "1", returnTo: destination });
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/whatsapp/status" ? { connected: false, hasQR: true } : [] }));
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
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
