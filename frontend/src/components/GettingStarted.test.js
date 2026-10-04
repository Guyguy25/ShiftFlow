import React, { act } from "react";
import { createRoot } from "react-dom/client";
import GettingStarted from "./GettingStarted";
import { api } from "../lib/api";
import { AuthProvider } from "../context/AuthContext";
import { useActivation } from "../context/ActivationContext";

let mockAuth;
const mockCoach = jest.fn();
jest.mock("../context/AuthContext", () => ({
  ...jest.requireActual("../context/AuthContext"),
  useAuth: () => mockAuth === undefined ? jest.requireActual("../context/AuthContext").useAuth() : mockAuth,
}));
jest.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/app/dashboard", search: "" }),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}), { virtual: true });
jest.mock("../lib/api", () => ({ api: { get: jest.fn() } }));
jest.mock("./OnboardingCoach", () => () => { mockCoach(); return <div data-testid="coach" />; });

const summary = { activation: { first_invite_sent: false, active_workers: 0 }, ongoing: [], upcoming: [], missions_total: 0 };
let host, root, context;
function Child() { context = useActivation(); return <p>Application disponible</p>; }
const render = async (withAuth = false) => act(async () => {
  const content = <GettingStarted><Child /></GettingStarted>;
  root.render(withAuth ? <AuthProvider>{content}</AuthProvider> : content);
});
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockAuth = { user: { id: "a" }, loading: false };
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/dashboard/summary" ? summary : {} }));
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

test.each([false, null, undefined])("initial state=null + user=%s renders children without onboarding or API calls", async user => {
  mockAuth = { user, loading: user == null };
  await render();
  expect(host.textContent).toBe("Application disponible");
  expect(context.next).toBeNull(); expect(context.steps).toEqual([]);
  expect(context.summary).toBeUndefined();
  expect(api.get).not.toHaveBeenCalled(); expect(mockCoach).not.toHaveBeenCalled();
});
test("a cached user while auth is loading still waits without polling", async () => {
  mockAuth.loading = true; await render();
  expect(api.get).not.toHaveBeenCalled(); expect(mockCoach).not.toHaveBeenCalled();
  expect(host.querySelector('[data-testid="getting-started"]')).toBeNull();
});
test("real AuthProvider handles /auth/me failure without an onboarding crash", async () => {
  mockAuth = undefined;
  api.get.mockRejectedValue(new Error("Unauthorized"));
  await render(true);
  expect(api.get).toHaveBeenCalledTimes(1); expect(api.get).toHaveBeenCalledWith("/auth/me");
  expect(host.textContent).toBe("Application disponible");
  expect(mockCoach).not.toHaveBeenCalled();
});
test.each([null, {}])("an unusable summary response %s does not reach activation helpers", async data => {
  api.get.mockResolvedValue({ data }); await render();
  expect(context.error).toBe("unavailable"); expect(context.next).toBeNull();
  expect(context.summary).toBeUndefined(); expect(host.textContent).toContain("Application disponible");
});
test("summary rejection leaves the application usable and retry can recover", async () => {
  api.get.mockRejectedValue(new Error("Service unavailable")); await render();
  expect(context.error).toBe("unavailable"); expect(context.next).toBeNull();
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/dashboard/summary" ? summary : {} }));
  await act(async () => context.retry());
  expect(context.error).toBeNull(); expect(context.next.href).toBe("/app/missions/new");
});
test("auth loss hides loaded state immediately and ignores a late request", async () => {
  let resolveSummary;
  api.get.mockImplementation(url => url === "/dashboard/summary" ? new Promise(resolve => { resolveSummary = resolve; }) : Promise.resolve({ data: {} }));
  await render(); mockAuth = { user: false, loading: false }; await render();
  await act(async () => resolveSummary({ data: summary }));
  expect(context.summary).toBeUndefined(); expect(context.steps).toEqual([]);
  expect(host.textContent).toBe("Application disponible");
});
test("loaded data for another account is ignored until that account's request completes", async () => {
  await render(); expect(context.owner).toBe("a");
  api.get.mockImplementation(() => new Promise(() => {}));
  mockAuth = { user: { id: "b" }, loading: false }; await render();
  expect(context.summary).toBeUndefined(); expect(context.next).toBeNull();
});
test("activated accounts have no checklist and losing auth removes the coach", async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/dashboard/summary" ? { ...summary, activation: { first_invite_sent: true } } : {} }));
  await render(); expect(host.querySelector('[data-testid="getting-started"]')).toBeNull();
  mockAuth = { user: null, loading: true }; await render();
  expect(host.querySelector('[data-testid="coach"]')).toBeNull();
});
