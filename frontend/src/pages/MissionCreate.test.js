import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MissionCreate from "./MissionCreate";
import { api } from "../lib/api";
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("../lib/api", () => ({ api: { post: jest.fn() }, formatApiError: value => value }));
jest.mock("../components/UpgradeModal", () => () => null);
let root, host;
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks(); api.post.mockResolvedValue({ data: { id: "test" } });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  await act(async () => root.render(<MissionCreate />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const fill = async (id, value) => act(async () => { const input = host.querySelector(`[data-testid="${id}"]`); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
const submit = async () => act(async () => { host.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
const start = async () => { await fill("mc-name", "Salon test"); await fill("mc-location", "Lille"); await submit(); };
test("progressive creation retains input, previews, and creates only on final confirmation", async () => {
  expect(host.querySelector('[data-testid="mc-shift-0-date"]')).toBeNull();
  await start();
  await fill("mc-shift-0-date", "2099-10-01"); await fill("mc-shift-0-start", "08:00"); await fill("mc-shift-0-end", "12:00");
  await act(async () => Array.from(host.querySelectorAll("button")).find(b => b.textContent === "Retour").click());
  expect(host.querySelector('[data-testid="mc-name"]').value).toBe("Salon test");
  await submit(); expect(host.querySelector('[data-testid="mc-shift-0-date"]').value).toBe("2099-10-01");
  await submit(); expect(host.textContent).toContain("Salon test");
  expect(api.post).not.toHaveBeenCalled();
  await submit();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith("/missions", expect.objectContaining({ name: "Salon test", shifts: [expect.objectContaining({ people_needed: 4, rate_hourly: 15 })] }));
  expect(mockNavigate).toHaveBeenCalledWith("/app/missions/test?step=select");
});
test("missing and past dates cannot advance to creation", async () => {
  await start(); await submit(); expect(api.post).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')).toBeTruthy();
  await fill("mc-shift-0-date", "2000-01-01"); await fill("mc-shift-0-start", "08:00"); await fill("mc-shift-0-end", "12:00");
  await submit(); expect(host.textContent).toContain("date déjà passée"); expect(api.post).not.toHaveBeenCalled();
});
