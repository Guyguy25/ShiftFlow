import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Login from "./Login";
import { api } from "../lib/api";

const mockNavigate = jest.fn();
const mockRefresh = jest.fn(() => Promise.resolve());
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a>, useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ login: jest.fn(), refresh: mockRefresh }) }));
jest.mock("../lib/api", () => ({ API: "/api", api: { post: jest.fn(), get: jest.fn(() => Promise.resolve({ data: { enabled: true } })) }, markLoggedOut: jest.fn(), formatApiError: value => value }));
jest.mock("../components/GoogleAuthButton", () => () => null);

let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks(); sessionStorage.clear();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); window.history.replaceState(null, "", "/"); });

test("shows the Microsoft button when it is configured", async () => {
  api.get.mockResolvedValue({ data: { enabled: true } });
  await act(async () => root.render(<Login />));
  expect(host.querySelector('[data-testid="microsoft-auth-button"]').textContent).toContain("Continuer avec Microsoft");
});

test("signs in an existing account on return from Microsoft", async () => {
  mockRefresh.mockResolvedValue();
  api.post.mockResolvedValue({ data: { user: { id: "u" } } });
  window.history.replaceState(null, "", "/login#microsoft=tok");
  await act(async () => root.render(<Login />));
  expect(api.post).toHaveBeenCalledWith("/auth/microsoft", { credential: "tok" });
  expect(mockRefresh).toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith("/app/dashboard");
  expect(window.location.hash).toBe("");
});

test("sends a new Microsoft user to registration", async () => {
  api.post.mockRejectedValue({ response: { status: 404, data: { detail: "Aucun compte" } } });
  window.history.replaceState(null, "", "/login#microsoft=tok");
  await act(async () => root.render(<Login />));
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: "/register", hash: "microsoft=tok" }, { replace: true });
});
