import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Demo from "./Demo";
import Landing from "./Landing";

jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = jest.fn(() => ({ matches: false }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const click = async element => act(async () => element.click());

test("demo preserves the 14 confirmed roadies, replaces only the last place, and resets", async () => {
  await act(async () => root.render(<Demo />));
  const progress = () => host.querySelector('[role="progressbar"]');
  const next = () => host.querySelector('[data-testid="demo-next"]');
  expect(progress().getAttribute("aria-valuenow")).toBe("14");
  await click(next());
  await click(host.querySelector('[aria-label="Contacter Alex en premier"]'));
  await click(next());
  await click(next());
  expect(host.textContent).toContain("Alex a refusé.");
  expect(progress().getAttribute("aria-valuenow")).toBe("14");
  await click(next());
  expect(progress().getAttribute("aria-valuenow")).toBe("15");
  expect(host.querySelector('[data-testid="demo-success"]').textContent).toContain("Camille");
  expect(host.querySelector('[data-testid="demo-success-cta"]').getAttribute("href")).toBe("/register");
  await click(Array.from(host.querySelectorAll("button")).find(button => button.textContent.includes("Recommencer")));
  expect(progress().getAttribute("aria-valuenow")).toBe("14");
  expect(host.querySelector("input").value).toContain("Montage de scène");
});

test("landing presents Claude-style animated cascade in both existing locations", async () => {
  await act(async () => root.render(<Landing />));
  const cards = Array.from(host.querySelectorAll('[data-testid="landing-mission-card"]'));
  expect(cards).toHaveLength(2);
  cards.forEach((card) => {
    expect(card.textContent).toContain("Montage stand · 15 roads");
    expect(card.textContent).toContain("Salut Camille");
    expect(card.textContent).toContain("14/15 confirmés");
    expect(card.querySelector('[role="progressbar"]').getAttribute("aria-valuenow")).toBe("14");
    expect(card.querySelector('[data-testid="landing-mission-playback"]')).not.toBeNull();
  });
});
