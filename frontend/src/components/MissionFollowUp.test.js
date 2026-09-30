import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MissionFollowUp, { invitationCounts } from "./MissionFollowUp";
import { ShiftCard } from "../pages/MissionDetail";

jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, formatApiError: value => value }));
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn(), Link: ({ to, children }) => <a href={to}>{children}</a> }), { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "test" } }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn() }, Toaster: () => null }));
const slot = { id: "s1", status: "contacted", priority: 0, worker: { first_name: "Camille", last_name: "Test" } };
const shift = { id: "shift1", mission_type: "montage", date: "2026-10-01", start_time: "08:00", end_time: "12:00", confirmed_count: 0, people_needed: 4, slots: [slot] };
const mission = { id: "m1", status: "in_progress", total_needed: 4, total_confirmed: 0, shifts: [shift] };
let host, root;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
test("pending recipients never count as sent invitations", () => {
  expect(invitationCounts({ shifts: [{ slots: [slot, { status: "pending" }, { status: "confirmed" }, { status: "refused" }, { status: "cancelled" }] }] })).toEqual({ sent: 3, waiting: 1, pending: 1 });
});
test("follow-up foregrounds sent requests and responses, not cost", async () => {
  await act(async () => root.render(<MissionFollowUp mission={mission} />));
  expect(host.textContent).toContain("1 demande envoyée");
  expect(host.textContent).toContain("en attente de réponse");
  expect(host.textContent).not.toContain("Coût");
});
test("a cancelled mission does not invite the user to await new responses", async () => {
  await act(async () => root.render(<MissionFollowUp mission={{ ...mission, status: "cancelled" }} />));
  expect(host.textContent).toContain("Mission annulée");
  expect(host.textContent).not.toContain("en attente de réponse");
});
test("existing invitations collapse selection even with an old auto-expand URL, and remove Open", async () => {
  await act(async () => root.render(<ShiftCard mission={mission} shift={shift} workers={[]} autoExpand onReload={jest.fn()} />));
  expect(host.textContent).toContain("Demande envoyée");
  expect(host.textContent).not.toContain("Composez votre équipe");
  expect(host.querySelector('[data-testid="open-link-s1"]')).toBeNull();
  expect(host.querySelector('[data-testid="copy-link-s1"]').closest("details").open).toBe(false);
  expect(host.querySelector('[data-testid="shift-estimate-shift1"]').closest("details").open).toBe(false);
});
test("selection closes when polling replaces an empty shift with invitations", async () => {
  await act(async () => root.render(<ShiftCard mission={mission} shift={{ ...shift, slots: [] }} workers={[]} autoExpand onReload={jest.fn()} />));
  expect(host.querySelector('[data-testid="shift-empty-workers-shift1"]')).toBeTruthy();
  await act(async () => root.render(<ShiftCard mission={mission} shift={shift} workers={[]} autoExpand onReload={jest.fn()} />));
  expect(host.querySelector('[data-testid="shift-empty-workers-shift1"]')).toBeNull();
  expect(host.querySelector('[data-testid="add-more-candidates-shift1"]')).toBeTruthy();
});
