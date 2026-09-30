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
test("a remaining free or paid credit is used before another purchase", async () => {
  api.get.mockResolvedValue({ data: { plan: "free", free_missions_remaining: 0, mission_credits: 1, can_create_mission: true } });
  await act(async () => root.render(<Pricing/>));
  expect(host.querySelector('[data-testid="pricing-mission-cta"]')).toBeNull();
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
  expect(api.post).toHaveBeenCalledWith("/payments/checkout", expect.objectContaining({ lookup_key: "shiftflow_mission", legal_acceptance: expect.objectContaining({ version: "2026-09-30", scope: "mission_purchase" }) }));
  expect(host.textContent).toContain("Erreur de test");
});

