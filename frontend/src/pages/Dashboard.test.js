import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./Dashboard";
import { api } from "../lib/api";

jest.mock("../lib/api", () => ({ api: { get: jest.fn() } }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { name: "Camille Example", agency_name: "Agence démo", organization: { id: "org-demo" } } }) }));
jest.mock("../lib/activation", () => ({ activationNext: () => null }));
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}), {virtual: true});
jest.mock("../components/ActivationHome", () => () => null);
jest.mock("../components/ShiftFlowLoader", () => () => <p>Chargement</p>);

let root, host;
const mission = { id:"m", name:"Concert loin",first_date:"2999-02-11",status:"in_progress",location:"Lille",total_needed:5,total_confirmed:0,shifts:[{}] };
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  api.get.mockImplementation(url => Promise.resolve({ data:
    url === "/dashboard/summary" ? {upcoming:[mission],ongoing:[],pending_confirmations:25} :
    url === "/whatsapp/status" ? {connected:true} :
    url === "/whatsapp/stats" ? {response_rate:40.7} :
    url === "/notifications/recent" ? [{id:"a",kind:"invite",status:"sent",sent_at:"2026-10-20T10:00:00Z"}] : {}
  }));
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
test("dashboard shows useful sections and does not mark distant missions urgent", async () => {
  await act(async () => root.render(<Dashboard />));
  expect(host.querySelector('[data-testid="dashboard-actions"]').textContent).toContain("Aucune action urgente");
  expect(host.querySelector('[data-testid="dashboard-next-mission"]').textContent).toContain("Concert loin");
  expect(host.querySelector('[data-testid="dashboard-activity"]').textContent).toContain("Invitation");
  expect(host.querySelector('[data-testid="kpi-unfilled"]').textContent).toContain("5");
  expect(host.querySelector('[data-testid="kpi-pending"]')).toBeNull();
  expect(host.querySelector('a[href="/app/organisations/org-demo/missions/m"]')).toBeTruthy();
});

test("a mission happening today is shown first and flagged as urgent", async () => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayMission = { id: "t", name: "Montage salon", first_date: today, last_date: today, status: "in_progress", location: "Lille", total_needed: 4, total_confirmed: 1, shifts: [{ date: today, start_time: "07:30", end_time: "17:00", people_needed: 4, confirmed_count: 1 }] };
  api.get.mockImplementation(url => Promise.resolve({ data:
    url === "/dashboard/summary" ? { upcoming: [mission], ongoing: [todayMission], past: [] } :
    url === "/whatsapp/status" ? { connected: true } :
    url === "/notifications/recent" ? [{ id: "a", kind: "invite", status: "sent", mission_id: "t", sent_at: new Date().toISOString() }] : {}
  }));
  await act(async () => root.render(<Dashboard />));
  const focus = host.querySelector('[data-testid="dashboard-next-mission"]').textContent;
  expect(focus).toContain("Montage salon");
  expect(focus).toContain("07:30");
  expect(host.querySelector('[data-testid="dashboard-actions"]').textContent).toContain("Montage salon");
  expect(host.querySelector('[data-testid="dashboard-headline"]').textContent).toContain("1 mission à compléter en urgence");
  expect(host.querySelector('[data-testid="dashboard-activity"]').textContent).toContain("Invitation · Montage salon");
  expect(host.querySelector('[data-testid="dashboard-planning"]').textContent).toContain("Montage salon");
});
