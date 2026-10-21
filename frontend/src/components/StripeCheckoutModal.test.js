import React, { act } from "react";
import { createRoot } from "react-dom/client";
import StripeCheckoutModal from "./StripeCheckoutModal";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

jest.mock("../lib/api", () => ({ api: { get: jest.fn() } }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("react-router-dom", () => ({ Link: ({ to, children, ...rest }) => <a href={to} {...rest}>{children}</a> }), { virtual: true });
jest.mock("@radix-ui/react-dialog", () => {
  const React = require("react"); const Wrap = ({ children }) => <div>{children}</div>;
  return { Root: Wrap, Portal: Wrap, Overlay: () => null, Content: Wrap, Title: Wrap, Description: Wrap, Close: React.forwardRef(({ children, ...rest }, ref) => <button ref={ref} {...rest}>{children}</button>) };
});
let host, root, init, destroy, mount, refresh, options;
const checkout = { session_id: "cs_test", publishable_key: "pk_test_public", client_secret: "session_secret" };
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  mount = jest.fn(); destroy = jest.fn(); refresh = jest.fn();
  init = jest.fn(value => { options = value; return Promise.resolve({ mount, destroy }); });
  window.Stripe = jest.fn(() => ({ initEmbeddedCheckout: init }));
  useAuth.mockReturnValue({ refresh }); api.get.mockReturnValue(new Promise(() => {}));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); delete window.Stripe; });
test("mounts the Stripe session and destroys it when closed", async () => {
  await act(async () => root.render(<StripeCheckoutModal checkout={checkout} onClose={() => {}}/>));
  expect(window.Stripe).toHaveBeenCalledWith("pk_test_public", { locale: "fr" });
  expect(init).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: "session_secret" }));
  expect(mount).toHaveBeenCalledWith(host.querySelector('[data-testid="stripe-checkout-mount"]'));
  await act(async () => root.render(<StripeCheckoutModal checkout={null} onClose={() => {}}/>));
  expect(destroy).toHaveBeenCalledTimes(1);
});
test("browser completion waits for server confirmation before showing success", async () => {
  await act(async () => root.render(<StripeCheckoutModal checkout={checkout} onClose={() => {}}/>));
  await act(async () => options.onComplete());
  expect(api.get).toHaveBeenCalledWith("/payments/status/cs_test");
  expect(refresh).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Confirmation du paiement en cours");
});
test("server-confirmed payment displays Pro success inside the modal", async () => {
  api.get.mockResolvedValue({ data: { payment_status: "paid", fulfilled: true } });
  await act(async () => root.render(<StripeCheckoutModal checkout={checkout} onClose={() => {}}/>));
  await act(async () => options.onComplete());
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[data-testid="stripe-checkout-success"]')).not.toBeNull();
  expect(host.textContent).toContain("Votre abonnement est activé");
});
test("SDK failure displays retry without changing account access", async () => {
  init.mockRejectedValue(new Error("offline"));
  await act(async () => root.render(<StripeCheckoutModal checkout={checkout} onClose={() => {}}/>));
  expect(host.textContent).toContain("Impossible de charger le paiement sécurisé");
  expect(refresh).not.toHaveBeenCalled();
});
test("initialization resolving after close is destroyed without mounting", async () => {
  let resolve; init.mockReturnValue(new Promise(r => { resolve = r; }));
  await act(async () => root.render(<StripeCheckoutModal checkout={checkout} onClose={() => {}}/>));
  await act(async () => root.render(<StripeCheckoutModal checkout={null} onClose={() => {}}/>));
  await act(async () => resolve({ mount, destroy }));
  expect(destroy).toHaveBeenCalledTimes(1); expect(mount).not.toHaveBeenCalled();
});
