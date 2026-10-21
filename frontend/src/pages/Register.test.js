import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Register from "./Register";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>, useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../lib/api", () => ({ API: "/api", api: { post: jest.fn() }, markLoggedOut: jest.fn(), formatApiError: value => value }));
jest.mock("../components/GoogleAuthButton", () => ({ __esModule: true, default: ({ onCredential }) => <button type="button" onClick={() => onCredential("google-test-credential")}>Continuer avec Google</button> }));
jest.mock("../lib/registrationDraft", () => ({
  DRAFT_KEY: "draft-test", readDraft: () => null, newDraftToken: () => "a".repeat(64),
  draftSnapshot: (token, step, form, answers) => ({ token, step, form, answers, updatedAt: Date.now() }),
  sendDraft: () => Promise.resolve(),
}));

let host, root, register, refresh;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); jest.clearAllMocks();
  register = jest.fn().mockResolvedValue({ user: { id: "u" } });
  refresh = jest.fn().mockResolvedValue();
  useAuth.mockReturnValue({ register, refresh });
  api.post.mockResolvedValue({ data: { user: { id: "g" } } });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function input(selector, value, event = "input") {
  const element = host.querySelector(selector);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event(event, { bubbles: true }));
  });
}
async function next() {
  await act(async () => host.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

test("email flow has exactly two credentials, two sliders, and creates the account only at the end", async () => {
  await act(async () => root.render(<Register />));
  expect([...host.querySelectorAll("input")].map(x => x.name)).toEqual(["email", "password"]);
  await input('[name="email"]', "camille@example.com");
  await input('[name="password"]', "Secret123");
  await next();
  expect(host.querySelectorAll('input[type="range"]')).toHaveLength(2);
  await input('#annual_events', "40", "change");
  await input('#people_per_mission', "15", "change");
  await next();
  expect(register).not.toHaveBeenCalled();
  expect(host.querySelectorAll("input")).toHaveLength(1);
  await input('[name="agency_name"]', "Camille Events");
  expect(host.textContent).toContain("80 h");
  expect(host.textContent).toMatch(/2[\s\u202f]*800\s*€/);
  expect(host.textContent).toContain("Estimation indicative");
  await next();
  expect(register).toHaveBeenCalledWith(expect.objectContaining({ email: "camille@example.com", password: "Secret123", agency_name: "Camille Events", onboarding_answers: { annual_events: 40, people_per_mission: 15 }, legal_acceptance: expect.objectContaining({ scope: "account" }) }));
  expect(mockNavigate).toHaveBeenCalledWith("/app/dashboard");
});

test("invalid credentials cannot advance", async () => {
  await act(async () => root.render(<Register />));
  await next();
  expect(host.querySelector('[role="alert"]').textContent).toContain("email valide");
  expect(host.querySelectorAll('input[type="range"]')).toHaveLength(0);
  expect(register).not.toHaveBeenCalled();
});

test("Google follows the activity and savings steps without requesting a password", async () => {
  await act(async () => root.render(<Register />));
  await act(async () => [...host.querySelectorAll("button")].find(x => x.textContent === "Continuer avec Google").click());
  expect(host.textContent).toContain("Compte Google sélectionné");
  expect(api.post).not.toHaveBeenCalled();
  await next();
  await input('[name="agency_name"]', "Google Events");
  await next();
  expect(register).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledWith("/auth/google", expect.objectContaining({ credential: "google-test-credential", registration: expect.objectContaining({ onboarding_answers: { annual_events: 30, people_per_mission: 15 } }) }));
  expect(refresh).toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith("/app/dashboard");
});
