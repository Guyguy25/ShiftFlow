import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import Layout from "./Layout";
import { readPageData, peekPageData } from "../lib/pageData";
import { useAuth } from "../context/AuthContext";

// The repository's Jest environment does not ship React Router itself; all
// router-consuming component tests use virtual navigation mocks.
jest.mock("react-router-dom", () => {
  const React = require("react");
  const Context = React.createContext(null);
  function parse(path) {
    const [pathname, search = ""] = String(path).split("?");
    return { pathname, search: search ? "?" + search : "" };
  }
  function MemoryRouter({ children, initialEntries }) {
    const [location, setLocation] = React.useState(() => parse(initialEntries[0]));
    const navigate = path => setLocation(parse(path));
    return React.createElement(Context.Provider, { value: { location, navigate } }, children);
  }
  function useLocation() { return React.useContext(Context).location; }
  function useNavigate() { return React.useContext(Context).navigate; }
  const Link = React.forwardRef(function Link({ to, children, onClick, className, ...props }, ref) {
    const navigate = useNavigate();
    return React.createElement("a", { ...props, href: to, ref, className, onClick: event => {
      event.preventDefault();
      onClick?.(event);
      navigate(to);
    } }, children);
  });
  function NavLink({ to, className, ...props }) {
    const { pathname } = useLocation();
    const target = parse(to).pathname;
    return React.createElement(Link, { ...props, to, className: typeof className === "function" ? className({ isActive: pathname === target }) : className });
  }
  return { MemoryRouter, useLocation, useNavigate, Link, NavLink };
}, { virtual: true });

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
    <Layout><p>Contenu</p></Layout>
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
