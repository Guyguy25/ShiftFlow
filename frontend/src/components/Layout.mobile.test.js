import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./Layout";
import { readPageData, peekPageData } from "../lib/pageData";
import { useAuth } from "../context/AuthContext";

jest.mock("../lib/pageData", () => ({
  readPageData: jest.fn(),
  peekPageData: jest.fn(),
}));
jest.mock("../lib/api", () => ({ api: {} }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("./WorkspaceSearch", () => () => null);
jest.mock("./WorkspaceSelector", () => () => <span>Équipe</span>);
jest.mock("./ProfileMenu", () => () => null);
jest.mock("./WelcomeDialog", () => () => null);
jest.mock("./ReturnFeedbackDialog", () => () => null);
jest.mock("./GettingStarted", () => ({ children }) => <>{children}</>);

let root, host;
let totalMissions;
const user = { id: "user-1", role: "user", plan: "pro", organization: { id: "org-1", name: "Equipe test", role: "owner" } };

function Position() {
  const { pathname, search } = useLocation();
  return <output data-testid="current-route">{pathname}{search}</output>;
}
function TestApp({ initial = "/app/dashboard" }) {
  return <MemoryRouter initialEntries={[initial]}>
    <Position />
    <Routes><Route path="*" element={<Layout><p>Contenu</p></Layout>} /></Routes>
  </MemoryRouter>;
}
async function mount(initial) {
  await act(async () => { root.render(<TestApp initial={initial} />); });
}
function click(testId) { host.querySelector('[data-testid="' + testId + '"]').click(); }

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  totalMissions = 0;
  window.scrollTo = jest.fn();
  peekPageData.mockReturnValue(undefined);
  readPageData.mockImplementation((_, url) => Promise.resolve({
    data: url === "/dashboard/summary" ? { missions_total: totalMissions } : {},
  }));
  useAuth.mockReturnValue({ user, logout: jest.fn() });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  jest.clearAllMocks();
});

test("first-time accounts go straight to their first mission, without a choice", async () => {
  totalMissions = 0;
  await mount();
  const create = host.querySelector('[data-testid="mobile-nav-create"]');
  expect(create.tagName).toBe("A");
  expect(create.getAttribute("aria-label")).toBe("Créer ma première mission");
  expect(host.querySelector('[data-testid="mobile-create-menu"]')).toBeNull();
  await act(async () => click("mobile-nav-create"));
  expect(host.querySelector('[data-testid="current-route"]').textContent).toBe("/app/organisations/org-1/missions/new");
});

test("existing accounts get two actions, a dismissible animated menu, and routed worker import", async () => {
  totalMissions = 3;
  await mount();
  const create = host.querySelector('[data-testid="mobile-nav-create"]');
  expect(create.tagName).toBe("BUTTON");
  expect(create.getAttribute("aria-expanded")).toBe("false");
  await act(async () => click("mobile-nav-create"));
  expect(create.getAttribute("aria-expanded")).toBe("true");
  const menu = host.querySelector('[data-testid="mobile-create-menu"]');
  expect(menu.classList.contains("mobile-create-menu")).toBe(true);
  expect(host.querySelector('[data-testid="mobile-create-mission-option"]').getAttribute("href")).toBe("/app/organisations/org-1/missions/new");
  expect(host.querySelector('[data-testid="mobile-create-worker-option"]').getAttribute("href")).toBe("/app/organisations/org-1/workers?add=1");
  await act(async () => click("mobile-create-worker-option"));
  expect(host.querySelector('[data-testid="current-route"]').textContent).toBe("/app/organisations/org-1/workers?add=1");
  expect(host.querySelector('[data-testid="mobile-create-menu"]')).toBeNull();
});

test("Escape and backdrop close the menu without navigating", async () => {
  totalMissions = 1;
  await mount();
  await act(async () => click("mobile-nav-create"));
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
  expect(host.querySelector('[data-testid="mobile-create-menu"]')).toBeNull();
  await act(async () => click("mobile-nav-create"));
  await act(async () => click("mobile-create-dismiss"));
  expect(host.querySelector('[data-testid="mobile-create-menu"]')).toBeNull();
  expect(host.querySelector('[data-testid="current-route"]').textContent).toBe("/app/dashboard");
});

test("navigation restores the top after browsing a long contacts screen", async () => {
  totalMissions = 1;
  await mount("/app/workers?add=1");
  window.scrollTo.mockClear();
  document.documentElement.scrollTop = 690;
  await act(async () => click("mobile-nav-missions"));
  expect(host.querySelector('[data-testid="current-route"]').textContent).toBe("/app/organisations/org-1/missions");
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  expect(document.documentElement.scrollTop).toBe(0);
});
