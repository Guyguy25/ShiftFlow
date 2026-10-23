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
