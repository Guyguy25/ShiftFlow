import React, { act } from "react";
import { createRoot } from "react-dom/client";
import ActivationHome from "./ActivationHome";
import { trackActivation } from "../lib/activationTracking";

jest.mock("react-router-dom", () => ({
  Link: ({ to, children, onClick, ...props }) => <a href={to} {...props} onClick={event => { event.preventDefault(); onClick?.(event); }}>{children}</a>,
}), { virtual: true });
jest.mock("../lib/activationTracking", () => ({ trackActivation: jest.fn() }));
jest.mock("./FirstMissionHelp", () => () => <p>WhatsApp et contacts</p>);
jest.mock("./ActivationReasonPrompt", () => () => null);

let host, root;
const empty = { missions_total: 0, activation: { first_invite_sent: false, active_workers: 0 }, upcoming: [], ongoing: [] };
const next = { href: "/app/missions/new", label: "Créer ma première mission", description: "Choisir un lieu et un horaire." };

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

test("new account sees a single clear action, progress and the no-account demo", async () => {
  await act(async () => root.render(<ActivationHome summary={empty} whatsapp={{ connected: false }} quota={{ plan: "free" }} next={next} />));
  expect(host.querySelector('[data-testid="activation-next"]').getAttribute("href")).toBe("/app/missions/new");
  expect(host.querySelector('[role="progressbar"]').getAttribute("aria-valuenow")).toBe("0");
  expect(host.querySelector('a[href="/demo"]').textContent).toContain("Tester");
  expect(host.textContent).toContain("n'envoie aucun message");
  expect(trackActivation).toHaveBeenCalledWith("activation_home_viewed");
  await act(async () => host.querySelector('[data-testid="activation-next"]').click());
  expect(trackActivation).toHaveBeenCalledWith("activation_cta_clicked");
});

test("returning account continues without repeating completed setup steps", async () => {
  const summary = { ...empty, missions_total: 1, activation: { first_invite_sent: false, active_workers: 3 } };
  await act(async () => root.render(<ActivationHome summary={summary} whatsapp={{ connected: true }} quota={{ plan: "free" }} next={{ href: "/app/missions/mission-1?step=select", label: "Envoyer les invitations", description: "Valider le premier envoi." }} />));
  expect(host.querySelector('[role="progressbar"]').getAttribute("aria-valuenow")).toBe("75");
  expect(host.querySelector('[data-testid="activation-next"]').getAttribute("href")).toContain("step=select");
  expect(host.textContent).toContain("3/4");
  expect(host.textContent).toContain("Un envoi n'est pas encore une confirmation.");
});
