import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Register, { AUTO_ADVANCE_MS } from "./Register";
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

const $ = selector => host.querySelector(selector);
const heading = () => $("h1").textContent;
async function input(selector, value, event = "input") {
  const element = $(selector);
  const proto = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
    element.dispatchEvent(new Event(event, { bubbles: true }));
  });
}
async function next() {
  await act(async () => $("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}
async function click(element) { await act(async () => element.click()); }
// Répond « première option » à chaque écran de question jusqu'à l'écran de volume.
async function answerQuestions() {
  let guard = 0;
  while ($('[data-testid="register-option"]') && guard++ < 20) {
    await click($('[data-testid="register-option"]'));
    await next();
  }
}

test("email flow: one screen per question, live estimate, account created only at the end", async () => {
  await act(async () => root.render(<Register />));
  expect([...host.querySelectorAll("input")].map(x => x.name)).toEqual(["email", "password"]);
  await input('[name="email"]', "camille@example.com");
  await input('[name="password"]', "Secret123");
  await next();
  expect(heading()).toContain("organisation");
  await input('[name="agency_name"]', "Camille Events");
  await next();
  expect(host.querySelectorAll("fieldset")).toHaveLength(1);
  await answerQuestions();
  expect(host.querySelectorAll('input[type="range"]')).toHaveLength(2);
  await input("#annual_events", "40", "change");
  await input("#people_per_mission", "15", "change");
  await next();
  await answerQuestions();
  expect($("textarea[name=context]")).not.toBeNull();
  expect(host.textContent).toContain("Passer et voir mon bilan");
  await next();
  expect(register).not.toHaveBeenCalled();
  expect(host.querySelectorAll("input")).toHaveLength(0);
  expect($('[data-testid="register-recap-agency"]').textContent).toBe("Camille Events");
  expect(host.textContent).toContain("80 h");
  expect(host.textContent).toMatch(/2[\s ]*800\s*€/);
  expect(host.textContent).toContain("Estimation indicative");
  await next();
  expect(register).toHaveBeenCalledWith(expect.objectContaining({ email: "camille@example.com", password: "Secret123", agency_name: "Camille Events", onboarding_answers: expect.objectContaining({ annual_events: 40, people_per_mission: 15, channels: ["WhatsApp"], role: "Dirigeant / fondateur", timeline: "Pour ma prochaine mission" }), legal_acceptance: expect.objectContaining({ scope: "account" }) }));
  expect(mockNavigate).toHaveBeenCalledWith("/app/dashboard");
});

test("invalid credentials cannot advance", async () => {
  await act(async () => root.render(<Register />));
  await next();
  expect($('[role="alert"]').textContent).toContain("email valide");
  await input('[name="email"]', "camille@example.com");
  await input('[name="password"]', "short");
  await next();
  expect($('[role="alert"]').textContent).toContain("8 caractères");
  expect($('[name="agency_name"]')).toBeNull();
  expect(register).not.toHaveBeenCalled();
});

test("a question cannot be skipped without an answer", async () => {
  await act(async () => root.render(<Register />));
  await input('[name="email"]', "camille@example.com");
  await input('[name="password"]', "Secret123");
  await next();
  await next();
  expect($('[role="alert"]').textContent).toContain("organisation");
  await input('[name="agency_name"]', "Camille Events");
  await next();
  const title = heading();
  await next();
  expect($('[role="alert"]').textContent).toContain("Choisissez");
  expect(heading()).toBe(title);
});

test("single-choice answers auto-advance and keyboard shortcuts select options", async () => {
  await act(async () => root.render(<Register />));
  await input('[name="email"]', "camille@example.com");
  await input('[name="password"]', "Secret123");
  await next();
  await input('[name="agency_name"]', "Camille Events");
  await next();
  expect(heading()).toBe("Quel est votre rôle ?");
  await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", bubbles: true })));
  expect([...host.querySelectorAll('[aria-pressed="true"]')].map(x => x.textContent)).toEqual([expect.stringContaining("Responsable des opérations")]);
  await act(async () => new Promise(resolve => setTimeout(resolve, AUTO_ADVANCE_MS + 50)));
  expect(heading()).toContain("plus gros problème");
});

test("suggests a fix for a mistyped email domain", async () => {
  await act(async () => root.render(<Register />));
  await input('[name="email"]', "camille@gmial.com");
  const suggestion = $('[data-testid="register-email-suggestion"]');
  expect(suggestion.textContent).toContain("camille@gmail.com");
  await click(suggestion);
  expect($('[name="email"]').value).toBe("camille@gmail.com");
  expect($('[data-testid="register-email-suggestion"]')).toBeNull();
});

test("Google follows the activity and savings steps without requesting a password", async () => {
  await act(async () => root.render(<Register />));
  await click([...host.querySelectorAll("button")].find(x => x.textContent === "Continuer avec Google"));
  expect(host.textContent).toContain("Compte Google sélectionné");
  expect(api.post).not.toHaveBeenCalled();
  await input('[name="agency_name"]', "Google Events");
  await next();
  await answerQuestions();
  await next();
  await answerQuestions();
  await next();
  expect(heading()).toContain("bilan");
  await next();
  expect(register).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledWith("/auth/google", expect.objectContaining({ credential: "google-test-credential", registration: expect.objectContaining({ agency_name: "Google Events", onboarding_answers: expect.objectContaining({ annual_events: 30, people_per_mission: 15, channels: ["WhatsApp"] }) }) }));
  expect(refresh).toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith("/app/dashboard");
});
