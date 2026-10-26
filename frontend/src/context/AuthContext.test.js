import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider, useAuth } from "./AuthContext";
import { api } from "../lib/api";
import { hasSessionHint } from "../lib/sessionHint";
jest.mock("../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() }, markLoggedOut: jest.fn() }));
let host, root, auth;
function Probe() { auth = useAuth(); return null; }
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); jest.clearAllMocks();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
test("confirmed sessions are remembered and explicit logout clears the hint immediately", async () => {
  api.get.mockResolvedValue({ data: { id: "u1" } });
  await act(async () => root.render(<AuthProvider><Probe /></AuthProvider>));
  expect(hasSessionHint()).toBe(true);
  let finishLogout;
  api.post.mockReturnValue(new Promise(resolve => { finishLogout = resolve; }));
  let pending;
  await act(async () => { pending = auth.logout(); });
  expect(hasSessionHint()).toBe(false);
  expect(auth.user).toBe(false);
  await act(async () => { finishLogout({}); await pending; });
});
test("a rejected server session clears a stale display hint", async () => {
  localStorage.setItem("shiftflow-session-known", "1");
  api.get.mockRejectedValue(new Error("unauthorized"));
  await act(async () => root.render(<AuthProvider><Probe /></AuthProvider>));
  expect(hasSessionHint()).toBe(false);
  expect(auth.user).toBe(false);
});
