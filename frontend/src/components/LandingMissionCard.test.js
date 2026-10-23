import React, { act } from "react";
import { createRoot } from "react-dom/client";
import LandingMissionCard from "./LandingMissionCard";

let host, root;
let initialMatchMedia;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  initialMatchMedia = window.matchMedia;
  window.matchMedia = jest.fn(() => ({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  jest.useFakeTimers();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  window.matchMedia = initialMatchMedia;
  jest.useRealTimers();
});

async function advance() {
  await act(async () => { jest.advanceTimersByTime(2600); });
}

test("automatically demonstrates refusal, contacting the next road, and team completion", async () => {
  await act(async () => root.render(<LandingMissionCard />));
  expect(host.textContent).toContain("14/15 confirmés");
  expect(host.textContent).toContain("Salut Camille");
  expect(host.textContent).toContain("Sofiane");

  await advance();
  expect(host.textContent).toContain("A refusé");
  expect(host.textContent).toContain("Proposition envoyée");
  expect(host.textContent).toContain("Salut Alex");

  await advance();
  expect(host.textContent).toContain("15/15 · équipe complète");
  expect(host.textContent).toContain("A confirmé ✓");
  expect(host.querySelector('[role="progressbar"]').getAttribute("aria-valuenow")).toBe("15");

  await advance();
  expect(host.textContent).toContain("14/15 confirmés");
  expect(host.textContent).toContain("Salut Camille");
});

test("pause stops the animation, resume reactivates it", async () => {
  await act(async () => root.render(<LandingMissionCard />));
  const control = host.querySelector('[data-testid="landing-mission-playback"]');
  await act(async () => control.click());
  expect(control.getAttribute("aria-label")).toBe("Reprendre l’animation");
  await advance();
  expect(host.textContent).toContain("Salut Camille");
  await act(async () => control.click());
  await advance();
  expect(host.textContent).toContain("Salut Alex");
});

test("reduced motion preference disables automatic playback but allows manual progress", async () => {
  window.matchMedia = jest.fn(() => ({
    matches: true,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
  await act(async () => root.render(<LandingMissionCard expanded />));
  await advance();
  expect(host.textContent).toContain("Salut Camille");
  const control = host.querySelector('[data-testid="landing-mission-playback"]');
  expect(control.getAttribute("aria-label")).toBe("Voir l’étape suivante");
  await act(async () => control.click());
  expect(host.textContent).toContain("Salut Alex");
  expect(host.textContent).toContain("suivant dans votre ordre de priorité");
});
