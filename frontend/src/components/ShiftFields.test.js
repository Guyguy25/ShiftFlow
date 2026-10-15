import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import ShiftFields, { estimatedPay, MAX_CREW } from "./ShiftFields";

const initial = {
  date: "2027-01-01", start_time: "08:00", end_time: "12:00",
  people_needed: 4, rate_hourly: 15, pay_type: "hourly", fixed_amount: 150,
  pay_basis: "unspecified", mission_type: "montage", skill_required: "", description: ""
};

let host, root;
function Harness() {
  const [value, setValue] = useState(initial);
  return <ShiftFields value={value} idPrefix="test-shift" minDate="2026-10-15" onChange={(name, v) => setValue(prev => ({ ...prev, [name]: v }))} />;
}
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const el = id => host.querySelector('[data-testid="' + id + '"]');
const click = id => act(async () => { el(id).click(); });
const change = (id, value) => act(async () => {
  const input = el(id);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});

test("crew slider, numeric field and +/- stay synchronized", async () => {
  expect(el("test-shift-people").value).toBe("4");
  await change("test-shift-people-slider", "12");
  expect(el("test-shift-people").value).toBe("12");
  await act(async () => host.querySelector('[aria-label="Ajouter un intervenant"]').click());
  expect(el("test-shift-people").value).toBe("13");
  await change("test-shift-people", "60");
  expect(el("test-shift-people-slider").value).toBe("60");
  expect(Number(el("test-shift-people-slider").max)).toBeGreaterThanOrEqual(60);
  expect(Number(el("test-shift-people").max)).toBe(MAX_CREW);
});

test("pay type, brut/net and prestation can be chosen without dropdowns", async () => {
  await click("test-shift-pay-fixed");
  expect(el("test-shift-pay-fixed").getAttribute("aria-pressed")).toBe("true");
  expect(el("test-shift-rate").value).toBe("150");
  expect(host.textContent).toContain("Précisez brut ou net");
  await click("test-shift-basis-net");
  expect(el("test-shift-basis-net").getAttribute("aria-pressed")).toBe("true");
  expect(host.textContent).toContain("600");
  await click("test-shift-type-technique");
  expect(el("test-shift-type-technique").getAttribute("aria-pressed")).toBe("true");
  await click("test-shift-pay-hourly");
  expect(el("test-shift-rate").value).toBe("15");
  expect(el("test-shift-basis-net").getAttribute("aria-pressed")).toBe("true");
});

test("indicated totals distinguish hourly, fixed and overnight hours", () => {
  expect(estimatedPay(initial)).toBe(240);
  expect(estimatedPay({ ...initial, pay_type: "fixed" })).toBe(600);
  expect(estimatedPay({ ...initial, start_time: "22:00", end_time: "02:00" })).toBe(240);
  expect(estimatedPay({ ...initial, people_needed: MAX_CREW + 1 })).toBeNull();
  expect(estimatedPay({ ...initial, start_time: "" })).toBeNull();
});
