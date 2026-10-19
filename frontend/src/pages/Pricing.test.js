import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Pricing from "./Pricing";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, formatApiError: value => value }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a> }), { virtual: true });
let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  useAuth.mockReturnValue({ user: { id: "u", plan: "free" } });
  api.get.mockResolvedValue({ data: { plan: "free", free_missions_remaining: 0, mission_credits: 0, can_create_mission: false } });
  api.post.mockReset();
  HTMLElement.prototype.scrollIntoView = jest.fn();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
test("displays only the monthly subscription and preserves discovery", async () => {
  await act(async () => root.render(<Pricing/>));
  expect(host.textContent).toContain("79 €");
  expect(host.textContent).toContain("3 missions offertes");
  expect(host.querySelector('[data-testid="pricing-card-mission"]')).toBeNull();
  expect(host.querySelector('select')).toBeNull();
  expect(host.querySelector('input[type="range"]')).toBeNull();
  expect(host.textContent).not.toContain("4,90");
  expect(host.textContent).not.toContain("499,80");
  expect(host.querySelectorAll("[data-testid^='pricing-card-']")).toHaveLength(2);
});

test("monthly checkout requires explicit consent and current terms", async () => {
  api.post.mockRejectedValue({ response: { data: { detail: "Erreur de test" } } });
  await act(async () => root.render(<Pricing/>));
  const button = host.querySelector('[data-testid="pricing-monthly-cta"]');
  await act(async () => button.click());
  expect(api.post).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Acceptez les conditions");
  await act(async () => host.querySelector('input[type="checkbox"]').click());
  await act(async () => button.click());
  expect(api.post).toHaveBeenCalledWith("/payments/checkout", expect.objectContaining({
    lookup_key: "shiftflow_pro_monthly", quantity: 1,
    legal_acceptance: expect.objectContaining({ version: "2026-10-19", scope: "pro_subscription" }),
  }));
  expect(host.textContent).toContain("Erreur de test");
});

test("feedback reward applies to monthly subscription at the new price", async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/feedback/status" ? { promo_code: "AVIS-U" } : { plan: "free", can_create_mission: false } }));
  api.post.mockRejectedValue({ response: { data: { detail: "Test" } } });
  await act(async () => root.render(<Pricing/>));
  expect(host.textContent).toContain("puis 79 €/mois");
  await act(async () => host.querySelector('input[type="checkbox"]').click());
  await act(async () => host.querySelector('[data-testid="pricing-monthly-cta"]').click());
  expect(api.post).toHaveBeenLastCalledWith("/payments/checkout", expect.objectContaining({ lookup_key: "shiftflow_pro_monthly", promo_code: "AVIS-U" }));
});

test("active subscribers cannot buy another subscription", async () => {
  api.get.mockResolvedValue({ data: { plan: "pro", can_create_mission: true } });
  await act(async () => root.render(<Pricing/>));
  expect(host.querySelector('[data-testid="pricing-monthly-cta"]').disabled).toBe(true);
});

test("quota errors block checkout", async () => {
  api.get.mockRejectedValue(new Error("offline"));
  await act(async () => root.render(<Pricing/>));
  expect(host.textContent).toContain("Impossible de vérifier votre offre");
  expect(host.querySelector('[data-testid="pricing-monthly-cta"]').disabled).toBe(true);
});
