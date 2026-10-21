import React, { act } from "react";
import { createRoot } from "react-dom/client";
import SignupCelebration from "./SignupCelebration";

let host, root, frames, id;
const original = { matchMedia: window.matchMedia, requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame };
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  frames = new Map(); id = 0;
  window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  window.requestAnimationFrame = jest.fn(callback => { frames.set(++id, callback); return id; });
  window.cancelAnimationFrame = jest.fn(key => frames.delete(key));
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  Object.assign(window, original);
});
async function tick(time) {
  const callbacks = [...frames.values()]; frames.clear();
  await act(async () => callbacks.forEach(callback => callback(time)));
}
const values = () => [...host.querySelectorAll(".sf-signup-stat")].map(element => element.textContent);

test("counters rise from zero to the calculated values and stop", async () => {
  await act(async () => root.render(<SignupCelebration savings={{ hours: 90, value: 3150, annualEvents: 60, peoplePerMission: 10 }} />));
  expect(values()).toEqual(["0 h", "0 €"]);
  await tick(0); await tick(800);
  expect(values()[0]).toBe("78,8 h");
  await tick(1600);
  expect(values()[0]).toBe("90 h");
  expect(values()[1]).toMatch(/3\s*150 €/);
  expect(frames.size).toBe(0);
  expect(host.querySelector("details").open).toBe(false);
});

test("reduced motion shows final values immediately without scheduling animation", async () => {
  window.matchMedia.mockReturnValue({ matches: true });
  await act(async () => root.render(<SignupCelebration savings={{ hours: 90, value: 3150, annualEvents: 60, peoplePerMission: 10 }} />));
  expect(values()[0]).toBe("90 h");
  expect(window.requestAnimationFrame).not.toHaveBeenCalled();
});
