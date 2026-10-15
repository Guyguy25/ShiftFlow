import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ShiftEditor from "./ShiftEditor";
import { api } from "../lib/api";
jest.mock("../lib/api", () => ({ api: { put: jest.fn(), post: jest.fn() }, formatApiError: value => value }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const shift = { id: "s", date: "2027-01-01", start_time: "09:00", end_time: "18:00", people_needed: 2, rate_hourly: 20, pay_type: "fixed", fixed_amount: 150, pay_basis: "net" };
let host, root;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks(); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
test("saving an existing fixed net cachet preserves compensation fields", async () => {
  api.put.mockResolvedValue({ data: {} }); const saved = jest.fn();
  await act(async () => root.render(<ShiftEditor missionId="m" shift={shift} onSaved={saved} onCancel={jest.fn()} />));
  await act(async () => host.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(api.put).toHaveBeenCalledWith("/shifts/s", expect.objectContaining({ pay_type: "fixed", fixed_amount: 150, pay_basis: "net", people_needed: 2 }));
  expect(saved).toHaveBeenCalledTimes(1);
});
test("an API rejection preserves the editor and explains the capacity conflict", async () => {
  api.put.mockRejectedValue({ response: { data: { detail: "Retirez d’abord les intervenants en surnombre" } } }); const saved = jest.fn();
  await act(async () => root.render(<ShiftEditor missionId="m" shift={shift} onSaved={saved} onCancel={jest.fn()} />));
  await act(async () => host.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(host.querySelector('[role="alert"]').textContent).toContain("surnombre"); expect(saved).not.toHaveBeenCalled();
});
