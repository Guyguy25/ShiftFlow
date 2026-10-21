import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Pricing from "./Pricing";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

jest.mock("../lib/billingConfig", () => ({ WHOP_ENABLED: true, YEARLY: { total: "521,40", monthly: "43,45", discount: "45", saving: "426,60" } }));
jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, formatApiError: value => value }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../components/WhopCheckoutModal", () => ({ __esModule: true, default: ({ checkout, onClose }) => checkout ? <div data-testid="checkout-modal">{checkout.plan_id}<button onClick={onClose}>Fermer</button></div> : null }));
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a> }), { virtual: true });
let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  useAuth.mockReturnValue({ user: { id: "u", plan: "free" } });
  api.get.mockResolvedValue({ data: { plan: "free", free_missions_remaining: 0 } });
  api.post.mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function ready() {
  await act(async () => root.render(<Pricing/>));
  await act(async () => host.querySelector('input[type="checkbox"]').click());
}
test("monthly Whop checkout opens a modal on the current page", async () => {
  api.post.mockResolvedValue({ data: { provider: "whop", session_id: "whop_test", plan_id: "plan_month" } });
  await ready();
  await act(async () => host.querySelector('[data-testid="pricing-monthly-cta"]').click());
  expect(api.post).toHaveBeenCalledWith("/payments/whop/checkout", expect.objectContaining({ lookup_key: "shiftflow_monthly" }));
  expect(host.querySelector('[data-testid="checkout-modal"]').textContent).toContain("plan_month");
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === "Fermer").click());
  expect(host.querySelector('[data-testid="checkout-modal"]')).toBeNull();
});
test("annual displays the full charge and sends the annual offer", async () => {
  api.post.mockResolvedValue({ data: { provider: "whop", session_id: "whop_test", plan_id: "plan_year" } });
  await ready();
  await act(async () => host.querySelector('button[aria-label="Annuel · −45 %"]').click());
  expect(host.textContent).toContain("521,40 € payés en une fois");
  expect(host.textContent).toContain("43,45 €");
  expect(host.textContent).toContain("426,60 € économisés");
  await act(async () => host.querySelector('[data-testid="pricing-monthly-cta"]').click());
  expect(api.post).toHaveBeenCalledWith("/payments/whop/checkout", expect.objectContaining({ lookup_key: "shiftflow_yearly" }));
});
test("rapid double click creates one transaction", async () => {
  let resolve;
  api.post.mockReturnValue(new Promise(r => { resolve = r; }));
  await ready();
  await act(async () => { const button = host.querySelector('[data-testid="pricing-monthly-cta"]'); button.click(); button.click(); });
  expect(api.post).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ data: { provider: "whop", plan_id: "plan_month", session_id: "whop_test" } }));
});
test("configuration errors leave checkout closed and display the server message", async () => {
  api.post.mockRejectedValue({ response: { data: { detail: "Tarif Whop incorrect" } } });
  await ready();
  await act(async () => host.querySelector('[data-testid="pricing-monthly-cta"]').click());
  expect(host.textContent).toContain("Tarif Whop incorrect");
  expect(host.querySelector('[data-testid="checkout-modal"]')).toBeNull();
});
