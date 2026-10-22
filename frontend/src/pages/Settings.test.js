import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Settings from "./Settings";
import { api } from "../lib/api";

jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, formatApiError: value => value }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "free-user", plan: "free", email: "compte@example.test" } }) }));
jest.mock("react-router-dom", () => ({ useLocation: () => ({ hash: "" }), Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
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
