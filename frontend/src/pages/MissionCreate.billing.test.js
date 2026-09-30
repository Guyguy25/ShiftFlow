import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MissionCreate from "./MissionCreate";
jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, formatApiError: value => value }));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "u" } }) }));
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn(), Link: ({ to, children }) => <a href={to}>{children}</a> }), { virtual: true });
test("restores a mission draft after checkout even in StrictMode", async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.setItem("shiftflow_mission_draft_u", JSON.stringify({ mission: { name: "Salon conservé", location: "Paris", followup_hours: 2 }, shifts: [{ date: "2027-01-01", start_time: "08:00", end_time: "12:00", people_needed: 2, rate_hourly: 15 }], step: 0 }));
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<React.StrictMode><MissionCreate/></React.StrictMode>));
  expect(Array.from(host.querySelectorAll("input")).some(input => input.value === "Salon conservé")).toBe(true);
  expect(JSON.parse(sessionStorage.getItem("shiftflow_mission_draft_u")).mission.name).toBe("Salon conservé");
  await act(async () => root.unmount()); host.remove(); sessionStorage.clear();
});

