import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Settings from "./Settings";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, formatApiError: value => value }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("react-router-dom", () => ({ useLocation: () => ({ hash: "" }), Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  useAuth.mockReturnValue({ user: { id: "free-user", plan: "free", email: "compte@example.test" } });
  api.get.mockResolvedValue({ data: { free_missions_remaining: 3, mission_credits: 0 } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

test("settings focuses on subscription and profile, without automations editing", async () => {
  await act(async () => root.render(<Settings />));
  expect(host.querySelector('[data-testid="settings-subscription-block"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="settings-profile-block"]')).not.toBeNull();
  expect(host.querySelector('a[href="/app/profile"]')).not.toBeNull();
  expect(host.textContent).toContain("compte@example.test");
  expect(host.textContent).not.toContain("Automatisations");
  expect(host.querySelector('textarea')).toBeNull();
  expect(api.get).toHaveBeenCalledWith("/plan/quota");
  expect(api.get).not.toHaveBeenCalledWith("/whatsapp/automations");
});

test("paid Whop account displays verified renewal date and cancel action", async () => {
  useAuth.mockReturnValue({ user: { id: "owner", plan: "pro", subscription_tier: "start", can_manage_billing: true, organization: { id: "org" } } });
  api.get.mockImplementation(path => path === "/payments/subscription"
    ? Promise.resolve({ data: { provider: "whop", tier: "start", status: "active", period_end: "2026-11-24T10:00:00Z", cancel_at_period_end: false, can_cancel: true, can_resume: false } })
    : Promise.resolve({ data: { mission_limit: 3, missions_this_month: 1 } }));
  await act(async () => root.render(<Settings />));
  expect(host.textContent).toContain("24 novembre 2026");
  expect(host.textContent).toContain("Renouvellement automatique actif");
  expect(host.querySelector('[data-testid="settings-cancel-subscription"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="settings-resume-subscription"]')).toBeNull();
  expect(host.textContent).toContain("Gérer / changer d’offre");
});

test("scheduled cancellation shows end of access and resume action", async () => {
  useAuth.mockReturnValue({ user: { id: "owner", plan: "pro", subscription_tier: "start", can_manage_billing: true, organization: { id: "org" } } });
  api.get.mockImplementation(path => path === "/payments/subscription"
    ? Promise.resolve({ data: { provider: "whop", tier: "start", status: "active", period_end: "2026-11-24T10:00:00Z", cancel_at_period_end: true, can_cancel: false, can_resume: true } })
    : Promise.resolve({ data: { mission_limit: 3, missions_this_month: 1 } }));
  await act(async () => root.render(<Settings />));
  expect(host.textContent).toContain("Résiliation programmée");
  expect(host.textContent).toContain("Accès jusqu’au 24 novembre 2026");
  expect(host.querySelector('[data-testid="settings-cancel-subscription"]')).toBeNull();
  expect(host.querySelector('[data-testid="settings-resume-subscription"]')).not.toBeNull();
});

test("collaborator never sees payment cancellation controls or billing data", async () => {
  useAuth.mockReturnValue({ user: { id: "member", plan: "pro", subscription_tier: "pro", can_manage_billing: false } });
  await act(async () => root.render(<Settings />));
  expect(api.get).not.toHaveBeenCalledWith("/payments/subscription", expect.anything());
  expect(host.querySelector('[data-testid="settings-cancel-subscription"]')).toBeNull();
  expect(host.querySelector('[data-testid="settings-portal-btn"]').disabled).toBe(true);
});
