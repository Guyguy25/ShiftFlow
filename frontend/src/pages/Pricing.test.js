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
test("displays the complete offer without a trial deadline or annual default", async () => {
  await act(async () => root.render(<Pricing/>));
  expect(host.textContent).toContain("4,90 €");
  expect(host.textContent).toContain("49 €");
  expect(host.textContent).toContain("sans date limite");
  expect(host.textContent).not.toContain("30 jours");
  expect(host.querySelectorAll("[data-testid^='pricing-card-']")).toHaveLength(3);
  expect(host.textContent).toContain("24,50");
});
test("a remaining credit is visible while a pack can be purchased", async () => {
  api.get.mockResolvedValue({ data: { plan: "free", free_missions_remaining: 0, mission_credits: 1, can_create_mission: true } });
  await act(async () => root.render(<Pricing/>));
  expect(host.querySelector('[data-testid="pricing-mission-cta"]')).not.toBeNull();
  expect(host.textContent).toContain("Utiliser ma mission disponible");
});
test("checkout requires explicit consent and uses the one-time offer", async () => {
  api.post.mockRejectedValue({ response: { data: { detail: "Erreur de test" } } });
  await act(async () => root.render(<Pricing/>));
  const button = host.querySelector('[data-testid="pricing-mission-cta"]');
  await act(async () => button.click());
  expect(api.post).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Acceptez les conditions");
  await act(async () => host.querySelector('input[type="checkbox"]').click());
  await act(async () => button.click());
  expect(api.post).toHaveBeenCalledWith("/payments/checkout", expect.objectContaining({ lookup_key: "shiftflow_mission", quantity: 5, legal_acceptance: expect.objectContaining({ version: "2026-10-01", scope: "mission_purchase" }) }));
  expect(host.textContent).toContain("Erreur de test");
});

test("annual choice displays the full annual payment and sends the annual lookup", async () => {
  api.post.mockRejectedValue({ response: { data: { detail: "Test" } } });
  await act(async () => root.render(<Pricing/>));
  const annual = [...host.querySelectorAll('button')].find(b => b.textContent === "Annuel · −15 %");
  await act(async () => annual.click());
  expect(host.textContent).toContain("499,80 € payés en une fois pour 12 mois");
  expect(host.textContent).toContain("41,65 €");
  await act(async () => host.querySelector('input[type="checkbox"]').click());
  await act(async () => host.querySelector('[data-testid="pricing-monthly-cta"]').click());
  expect(api.post).toHaveBeenCalledWith("/payments/checkout", expect.objectContaining({ lookup_key: "shiftflow_pro_yearly", quantity: 1 }));
});

test("ten purchased missions add two bonus credits in one checkout", async () => {
  api.post.mockRejectedValue({ response: { data: { detail: "Test" } } });
  await act(async () => root.render(<Pricing/>));
  await act(async () => {
    const select = host.querySelector('#mission-quantity');
    select.value = '10'; select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(host.textContent).toContain("12 missions pour");
  await act(async () => host.querySelector('input[type="checkbox"]').click());
  await act(async () => host.querySelector('[data-testid="pricing-mission-cta"]').click());
  expect(api.post).toHaveBeenCalledWith("/payments/checkout", expect.objectContaining({ lookup_key: "shiftflow_mission", quantity: 10 }));
});
