import React, { act } from "react";
import { createRoot } from "react-dom/client";
import WhopCheckoutModal from "./WhopCheckoutModal";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

jest.mock("../lib/api", () => ({ api: { get: jest.fn() } }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@radix-ui/react-dialog", () => {
  const React = require("react");
  const Wrap = ({ children }) => <div>{children}</div>;
  return { Root: Wrap, Portal: Wrap, Overlay: () => null, Content: Wrap, Title: Wrap, Description: Wrap, Close: React.forwardRef(({ children, ...rest }, ref) => <button ref={ref} {...rest}>{children}</button>) };
});
let host, root, create, destroy, mount, refresh, options;
const checkout = { session_id: "whop_test", plan_id: "plan_month", metadata: { shiftflow_session: "whop_test", shiftflow_token: "opaque" }, return_url: "https://www.shiftflow.io/payment/success?session_id=whop_test" };
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  mount = jest.fn(); destroy = jest.fn(); refresh = jest.fn();
  create = jest.fn(value => { options = value; return { create: () => ({ mount }), destroy }; });
  window.WhopElements = () => ({ checkout: { create } });
  useAuth.mockReturnValue({ refresh });
  api.get.mockReturnValue(new Promise(() => {}));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); delete window.WhopElements; });
test("mounts the selected plan with opaque binding and destroys it when closed", async () => {
  await act(async () => root.render(<WhopCheckoutModal checkout={checkout} onClose={() => {}}/>));
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ plan: "plan_month", metadata: checkout.metadata, returnUrl: checkout.return_url, locale: "fr" }));
  expect(mount).toHaveBeenCalledWith(host.querySelector('[data-testid="whop-checkout-mount"]'));
  expect(api.get).toHaveBeenCalledWith("/payments/status/whop_test");
  await act(async () => root.render(<WhopCheckoutModal checkout={null} onClose={() => {}}/>));
  expect(destroy).toHaveBeenCalledTimes(1);
});
test("browser completion never grants Pro or refreshes the account without server confirmation", async () => {
  await act(async () => root.render(<WhopCheckoutModal checkout={checkout} onClose={() => {}}/>));
  await act(async () => options.onComplete({ result: "payment", paymentId: "pay_forged" }));
  expect(refresh).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Confirmation du paiement en cours");
});
test("SDK failure displays a retry action", async () => {
  create.mockImplementation(() => { throw new Error("offline"); });
  await act(async () => root.render(<WhopCheckoutModal checkout={checkout} onClose={() => {}}/>));
  expect(host.textContent).toContain("Impossible d’ouvrir le formulaire Whop");
  expect(host.textContent).toContain("Recharger le formulaire");
});
