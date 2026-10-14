import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ReturnFeedbackDialog from "./ReturnFeedbackDialog";
import { api } from "../lib/api";
jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, formatApiError: value => value }));
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a> }), { virtual: true });
let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  localStorage.clear(); api.get.mockReset(); api.post.mockReset();
  api.get.mockResolvedValue({ data: { show: true } });
  api.post.mockResolvedValue({ data: { promo_code: "AVIS-PERSONNEL" } });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = () => act(async () => root.render(<ReturnFeedbackDialog user={{ id: "u", plan: "free" }}/>));
const button = text => [...document.querySelectorAll("button")].find(b => b.textContent.includes(text));
test("only invites eligible returning users and avoids the welcome dialog", async () => {
  api.get.mockResolvedValue({ data: { show: false } });
  await render(); expect(document.querySelector('[role="dialog"]')).toBeNull();
  api.get.mockResolvedValue({ data: { show: true } });
  localStorage.setItem("shiftflow-welcome-u", "pending");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  localStorage.clear();
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(document.body.textContent).toContain("Votre avis nous intéresse");
  expect(document.body.textContent).toContain("puis 49 €/mois automatiquement");
});
test("later persists a snooze", async () => {
  await render(); await act(async () => button("Plus tard").click());
  expect(api.post).toHaveBeenCalledWith("/feedback/snooze");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
test("failed submission preserves the questionnaire and never grants a code", async () => {
  api.post.mockRejectedValue({ response: { data: { detail: "Enregistrement indisponible" } } });
  await render(); await act(async () => button("Donner mon avis").click());
  await act(async () => document.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(document.body.textContent).toContain("Enregistrement indisponible");
  expect(document.querySelector("form")).not.toBeNull();
  expect(document.body.textContent).not.toContain("AVIS-PERSONNEL");
});
test("successful submission exposes the personal code and activation link", async () => {
  await render(); await act(async () => button("Donner mon avis").click());
  await act(async () => document.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(api.post).toHaveBeenCalledWith("/feedback", expect.objectContaining({ follow_up: false }));
  expect(document.body.textContent).toContain("AVIS-PERSONNEL");
  expect(document.querySelector('a[href="/pricing?feedback=AVIS-PERSONNEL"]')).not.toBeNull();
});
