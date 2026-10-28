import React, { act } from "react";
import { createRoot } from "react-dom/client";
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
import Landing from "./Landing";
import { useAuth } from "../context/AuthContext";
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../components/LandingMissionCard", () => () => <div>Simulation</div>);
jest.mock("../components/LandingVolumeCalculator", () => () => <div>Calculateur</div>);
let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  localStorage.clear();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function renderUser(user, loading = false) {
  useAuth.mockReturnValue({ user, loading });
  await act(async () => root.render(<Landing />));
}
test("visitors can view the landing and start registration", async () => {
  await renderUser(false);
  expect(host.querySelector('[data-testid="landing-cta-nav"]').getAttribute("href")).toBe("/register");
  expect(host.querySelector('[data-testid="hero-cta-primary"]').textContent).toContain("Essayer sur 3 missions offertes");
  expect(host.querySelector('[data-testid="landing-login-link"]')).not.toBeNull();
});
test("signed-in visitors can view the landing and reopen their workspace", async () => {
  await renderUser({ id: "u1", organization: { id: "team-1" } });
  for (const id of ["landing-cta-nav", "hero-cta-primary"]) {
    const link = host.querySelector(`[data-testid="${id}"]`);
    expect(link.getAttribute("href")).toBe("/app/organisations/team-1/dashboard");
    expect(link.textContent).toContain("Ouvrir mon espace");
  }
  expect(host.querySelector('[data-testid="landing-login-link"]')).toBeNull();
  expect(host.querySelector('a[href="/register"]')).toBeNull();
  expect(host.querySelector('a[href="#tarifs"]')).not.toBeNull();
});
test("users needing an organization return to setup", async () => {
  await renderUser({ id: "u1", needs_organization: true });
  expect(host.querySelector('[data-testid="landing-cta-nav"]').getAttribute("href")).toBe("/organizations/new");
});
test("pending invitations remain accessible", async () => {
  sessionStorage.setItem("shiftflow_pending_invitation", "token");
  await renderUser({ id: "u1" });
  expect(host.querySelector('[data-testid="landing-cta-nav"]').getAttribute("href")).toBe("/invite");
});
test("landing remains visible while the session loads", async () => {
  await renderUser(null, true);
  expect(host.querySelector("h1").textContent).toContain("désistement");
});

test("known sessions show the workspace action before the slow server response", async () => {
  localStorage.setItem("shiftflow-session-known", "1");
  await renderUser(null, true);
  const link = host.querySelector('[data-testid="landing-cta-nav"]');
  expect(link.textContent).toBe("Ouvrir mon espace");
  expect(link.getAttribute("href")).toBe("/app");
  expect(host.querySelector('[data-testid="landing-login-link"]')).toBeNull();
  await renderUser(false, false);
  expect(host.querySelector('[data-testid="landing-cta-nav"]').textContent).toBe("Essayer gratuitement");
});

test("Claude's workflow example consistently fills one outstanding place", async () => {
  await renderUser(false);
  expect(host.querySelector("#count").textContent).toContain("14/15 confirmés");
  expect(host.querySelector('[data-testid="landing-hero-self-demo"]').getAttribute("href")).toBe("/demo");
  expect(host.querySelector('[data-testid="hero-cta-secondary"]').getAttribute("href")).toBe("/test-accompagne#reserver");
});
test("public landing has no paid prices, but still links to pricing", async () => {
  await renderUser(false);
  expect(host.textContent).not.toMatch(/29\s*€|79\s*€|149\s*€/);
  expect(host.querySelector('a[href="/pricing"]')).not.toBeNull();
});

test("logged-out visitors can use tabs and the calculator while auth is loading", async () => {
  await renderUser(null, true);
  const tabs = host.querySelectorAll('.tab');
  const panels = host.querySelectorAll('.panel');
  expect(tabs).toHaveLength(3);
  expect(panels[0].classList.contains('show')).toBe(true);

  await act(async () => {
    tabs[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  expect(tabs[0].getAttribute("aria-selected")).toBe("false");
  expect(panels[1].classList.contains("show")).toBe(true);
  expect(panels[0].classList.contains("show")).toBe(false);

  const slider = host.querySelector("#m");
  await act(async () => {
    slider.value = "12";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(host.querySelector("#mo").textContent).toBe("12");
  expect(host.querySelector("#tot").textContent).toBe("396");
});

test("public content remains usable when the reveal observer cannot initialize", async () => {
  const previous = global.IntersectionObserver;
  global.IntersectionObserver = jest.fn(() => { throw new Error("observer unavailable"); });
  try {
    await renderUser(false);
    expect(host.querySelector("h1").textContent).toContain("désistement");
    expect(host.querySelectorAll(".reveal").length).toBeGreaterThan(5);
    expect(host.querySelectorAll(".reveal:not(.in)")).toHaveLength(0);
    expect(host.querySelector("#calculateur")).not.toBeNull();
  } finally {
    global.IntersectionObserver = previous;
  }
});
