import React, { act } from "react";
import { createRoot } from "react-dom/client";
import PublicTimesheet from "./PublicTimesheet";
import { api } from "../lib/api";

jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn() },
  formatApiError: value => value || "Lien invalide",
}));
jest.mock("react-router-dom", () => ({ useParams: () => ({ token: "example-token" }) }));

let host, root;
const fixture = status => ({
  mission: { name: "Concert", location: "Lille" },
  worker: { first_name: "Paul" },
  shift: { date: "2026-10-19", start_time: "20:00", end_time: "02:00", pay_type: "hourly" },
  timesheet: {
    status, started_at: "2026-10-19T20:00:00+02:00", ended_at: "2026-10-20T02:00:00+02:00",
    break_minutes: 0, worked_minutes: status === "approved" ? 360 : null,
    review_note: "Ajoutez votre pause.",
  },
});
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  api.post.mockResolvedValue({ data: { status: "submitted", worked_minutes: 330 } });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

test("shows a public no-account form and sends start, end and break to the API", async () => {
  api.get.mockResolvedValue({ data: fixture("sent") });
  await act(async () => root.render(<PublicTimesheet />));
  expect(host.textContent).toContain("Aucun compte à créer");
  expect(host.querySelector('input[id="timesheet-start"]')).not.toBeNull();
  await act(async () => {
    const pause = host.querySelector('#timesheet-break');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(pause, "30");
    pause.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => host.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0][0]).toBe("/public/timesheets/example-token");
  expect(api.post.mock.calls[0][1]).toEqual(expect.objectContaining({ break_minutes: 30 }));
});

test("validated timesheets are read-only", async () => {
  api.get.mockResolvedValue({ data: fixture("approved") });
  await act(async () => root.render(<PublicTimesheet />));
  expect(host.textContent).toContain("Vos heures ont été validées");
  expect(host.querySelector("form")).toBeNull();
});

test("correction note appears in the public view", async () => {
  api.get.mockResolvedValue({ data: fixture("needs_correction") });
  await act(async () => root.render(<PublicTimesheet />));
  expect(host.textContent).toContain("Ajoutez votre pause.");
});
