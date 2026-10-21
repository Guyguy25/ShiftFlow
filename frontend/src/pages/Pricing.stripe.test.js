import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Pricing from "./Pricing";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, formatApiError: value => value }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../components/StripeCheckoutModal", () => ({ __esModule: true, default: ({ checkout, onClose }) => checkout ? <div data-testid="checkout-modal">{checkout.lookup_key}<button onClick={onClose}>Fermer</button></div> : null }));
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a> }), { virtual: true });
let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  useAuth.mockReturnValue({ user: { id: "u", plan: "free" } });
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/payments/config" ? { publishable_key: "pk_test_public" } : { plan: "free", free_missions_remaining: 0 } }));
  api.post.mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function ready() {
  await act(async () => root.render(<Pricing/>));
  await act(async () => host.querySelector('input[type="checkbox"]').click());
}
test("Stripe public key selects embedded checkout and opens a modal", async () => {
  api.post.mockResolvedValue({ data: { provider: "stripe", ui_mode: "embedded", session_id: "cs_test", client_secret: "session_secret" } });
  await ready();
  await act(async () => host.querySelector('[data-testid="pricing-monthly-cta"]').click());
  expect(api.post).toHaveBeenCalledWith("/payments/checkout", expect.objectContaining({ ui_mode: "embedded", lookup_key: "shiftflow_monthly" }));
  expect(host.querySelector('[data-testid="checkout-modal"]').textContent).toContain("shiftflow_monthly");
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === "Fermer").click());
  expect(host.querySelector('[data-testid="checkout-modal"]')).toBeNull();
});
test("annual selection keeps the existing Stripe price", async () => {
  api.post.mockResolvedValue({ data: { provider: "stripe", ui_mode: "embedded", session_id: "cs_test", client_secret: "session_secret" } });
  await ready();
  await act(async () => host.querySelector('button[aria-label="Annuel · −25 %"]').click());
  expect(host.textContent).toContain("711 € payés en une fois");
  await act(async () => host.querySelector('[data-testid="pricing-monthly-cta"]').click());
  expect(api.post).toHaveBeenCalledWith("/payments/checkout", expect.objectContaining({ ui_mode: "embedded", lookup_key: "shiftflow_yearly" }));
});
test("rapid double click only creates one checkout", async () => {
  let resolve;
  api.post.mockReturnValue(new Promise(r => { resolve = r; }));
  await ready();
  await act(async () => { const b = host.querySelector('[data-testid="pricing-monthly-cta"]'); b.click(); b.click(); });
  expect(api.post).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ data: { ui_mode: "embedded", session_id: "cs_test", client_secret: "session_secret" } }));
});
test("missing public key preserves hosted checkout without breaking payment", async () => {
  api.get.mockResolvedValue({ data: { plan: "free", free_missions_remaining: 0 } });
  api.post.mockRejectedValue({ response: { data: { detail: "Test" } } });
  await ready();
  await act(async () => host.querySelector('[data-testid="pricing-monthly-cta"]').click());
  expect(api.post).toHaveBeenCalledWith("/payments/checkout", expect.objectContaining({ ui_mode: "hosted" }));
});
test("feedback reward is preserved in the embedded monthly request", async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/payments/config" ? { publishable_key: "pk_test_public" } : url === "/feedback/status" ? { promo_code: "AVIS-U" } : { plan: "free" } }));
  api.post.mockRejectedValue({ response: { data: { detail: "Test" } } });
  await ready();
  await act(async () => host.querySelector('[data-testid="pricing-monthly-cta"]').click());
  expect(api.post).toHaveBeenCalledWith("/payments/checkout", expect.objectContaining({ ui_mode: "embedded", promo_code: "AVIS-U" }));
});
