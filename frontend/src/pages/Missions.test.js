import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Missions from "./Missions";
import { api } from "../lib/api";

jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(),
}), { virtual: true });
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() }, Toaster: () => null }));
jest.mock("../components/UpgradeModal", () => () => null);
jest.mock("../components/JourneyEmpty", () => () => <p>Aucune mission</p>);
jest.mock("../components/ShiftFlowLoader", () => () => <p>Chargement</p>);

const fixtures = [
  { id: "old", name: "Montage ancien", first_date: "2020-01-01", status: "in_progress", total_confirmed: 1, total_needed: 4, shifts: [{}] },
  { id: "future", name: "Festival futur", first_date: "2999-02-11", status: "in_progress", total_confirmed: 1, total_needed: 5, shifts: [{}, {}] },
  { id: "draft", name: "Brouillon test", first_date: "", status: "draft", total_confirmed: 0, total_needed: 2, shifts: [] },
];
let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: fixtures });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

test("missions have separate date and team statuses", async () => {
  await act(async () => root.render(<Missions />));
  expect(host.textContent).toContain("Date passée");
  expect(host.textContent).toContain("4 postes à pourvoir");
  expect(host.textContent).toContain("Créneaux");
});

test("filters narrow the visible mission list", async () => {
  await act(async () => root.render(<Missions />));
  const filter = host.querySelector('[aria-label="Filtrer les missions"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(filter, "attention");
    filter.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(host.querySelectorAll('[data-testid^="mission-row-future"]')).toHaveLength(2); // desktop and mobile
  expect(host.querySelector('[data-testid="mission-row-old"]')).toBeNull();
});

test("returning to missions shows the last list while the new request is still pending", async () => {
  await act(async () => root.render(<Missions />));
  await act(async () => root.unmount());
  root = createRoot(host);
  let finish;
  api.get.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<Missions />));
  expect(host.textContent).toContain("Festival futur");
  expect(host.textContent).not.toContain("Chargement");
  await act(async () => finish({ data: [...fixtures, { id: "new", name: "Mission récente", shifts: [] }] }));
  expect(host.textContent).toContain("Mission récente");
});
