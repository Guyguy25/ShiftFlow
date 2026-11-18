import React, { act } from "react";
import { createRoot } from "react-dom/client";
import NotificationBell from "./NotificationBell";
import { api } from "../lib/api";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() } }));

let host, root;
const events = [
  { id: "accepted:slot1", kind: "accepted", title: "Invitation acceptée",
    message: "Paul a accepté.", created_at: "2026-11-18T12:00:00+00:00",
    unread: true, url: "/app/missions/m1" },
  { id: "followup:msg2", kind: "followup", title: "Relance envoyée",
    message: "Relance envoyée.", created_at: "2026-11-18T11:00:00+00:00",
    unread: true, url: "/app/missions/m1" },
];
const query = testId => host.querySelector('[data-testid="' + testId + '"]');

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  api.get.mockReset();
  api.post.mockReset();
  mockNavigate.mockReset();
  api.get.mockResolvedValue({ data: { items: events, unread: 2 } });
  api.post.mockResolvedValue({ data: { ok: true } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function mount(org = "org1") {
  await act(async () => root.render(<NotificationBell userId="user1" organizationId={org} />));
}

test("global bell shows unread events and marks them read", async () => {
  await mount();
  expect(query("notification-count").textContent).toBe("2");
  await act(async () => query("notification-bell").click());
  expect(query("notification-panel")).not.toBeNull();
  expect(query("notification-item-accepted")).not.toBeNull();
  expect(query("notification-item-followup")).not.toBeNull();
  await act(async () => query("mark-all-notifications-read").click());
  expect(api.post).toHaveBeenCalledWith("/activity-notifications/read", {}, {
    headers: { "X-Organization-ID": "org1" },
  });
  expect(query("notification-count")).toBeNull();
});

test("notification link stays scoped to the current organization", async () => {
  await mount();
  await act(async () => query("notification-bell").click());
  await act(async () => query("notification-item-accepted").click());
  expect(mockNavigate).toHaveBeenCalledWith("/app/organisations/org1/missions/m1");
  expect(query("notification-panel")).toBeNull();
});

test("switching workspaces fetches separate notifications", async () => {
  await mount("org1");
  api.get.mockResolvedValue({ data: { items: [], unread: 0 } });
  await mount("org2");
  expect(api.get).toHaveBeenLastCalledWith("/activity-notifications", {
    params: { limit: 40 }, headers: { "X-Organization-ID": "org2" },
  });
  expect(query("notification-count")).toBeNull();
  await act(async () => query("notification-bell").click());
  expect(host.textContent).toContain("Aucune notification");
});

test("Escape closes the notifications panel", async () => {
  await mount();
  await act(async () => query("notification-bell").click());
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(query("notification-panel")).toBeNull();
});
