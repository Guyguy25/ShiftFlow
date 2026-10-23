import React, { act } from "react";
import { createRoot } from "react-dom/client";
import CalendlyInlineBooking, { BOOKING_URL } from "./CalendlyInlineBooking";

let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.Calendly = { initInlineWidget: jest.fn() };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => { root.unmount(); });
  host.remove();
  delete window.Calendly;
});

test("mounts an inline Calendly widget with prefilled contact details", async () => {
  await act(async () => {
    root.render(<CalendlyInlineBooking name="Alex Martin" email="alex@example.com" />);
  });
  expect(host.querySelector('[data-testid="calendly-inline-booking"]')).toBeTruthy();
  expect(window.Calendly.initInlineWidget).toHaveBeenCalledWith({
    url: BOOKING_URL,
    parentElement: host.querySelector('[data-testid="calendly-inline-booking"]'),
    prefill: { name: "Alex Martin", email: "alex@example.com" },
    resize: true,
  });
  expect(host.textContent).not.toContain("Ouvrir l’agenda de Tanguy");
});

test("reinitializes the widget if the form contact changes", async () => {
  await act(async () => {
    root.render(<CalendlyInlineBooking name="Alex Martin" email="alex@example.com" />);
  });
  await act(async () => {
    root.render(<CalendlyInlineBooking name="Camille Dubois" email="camille@example.com" />);
  });
  expect(window.Calendly.initInlineWidget).toHaveBeenLastCalledWith(expect.objectContaining({
    prefill: { name: "Camille Dubois", email: "camille@example.com" },
  }));
});
