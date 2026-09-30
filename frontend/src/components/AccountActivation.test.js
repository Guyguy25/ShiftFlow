/** @jest-environment node */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AccountActivation from "./AccountActivation";
import { ActivationContext } from "../context/ActivationContext";
import { activationNext, activationSteps } from "../lib/activation";

jest.mock("react-router-dom", () => ({ Link: require("react").forwardRef(({ to, children, ...props }, ref) => <a ref={ref} href={to} {...props}>{children}</a>) }), { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "new-user", name: "Camille", agency_name: "Agence", phone: "0612345678" } }) }));
const fresh = { missions_total: 0, ongoing: [], upcoming: [], activation: { active_workers: 0, first_invite_sent: false } };
const render = value => renderToStaticMarkup(<ActivationContext.Provider value={value}><AccountActivation /></ActivationContext.Provider>);
const state = summary => ({ summary, steps: activationSteps(summary, { connected: false }), next: activationNext(summary, { connected: false }) });

test("new account shows a real empty state and zero actions despite complete personal details", () => {
  const html = render(state(fresh));
  expect(html).toContain("Aucune mission pour le moment");
  expect(html).toContain("0/4 réalisés");
  expect(html).toContain('aria-valuenow="0"');
  expect(html).toContain('href="/app/missions/new"');
  expect(html).toContain("Commencez ici");
  expect(html).not.toContain("3/3");
});
test("next action and coach move to workers after mission creation", () => {
  const summary = { ...fresh, missions_total: 1, upcoming: [{ id: "m1", name: "Salon", shifts: [{ people_needed: 2, confirmed_count: 0 }] }] };
  const html = render(state(summary));
  expect(html).toContain("1/4 réalisés");
  expect(html).toContain("Ajouter mes intervenants");
  expect(html).toContain("Étape 2 sur 4");
  expect(html).toContain("/app/missions/m1?step=select");
});
test("completed activation does not display a first-mission empty state", () => {
  expect(render(state({ ...fresh, activation: { active_workers: 1, first_invite_sent: true } }))).toBe("");
});
test("loading and error states never pretend to know the user's progress", () => {
  expect(render({})).toContain("Chargement");
  const html = render({ error: "unavailable", retry: () => {} });
  expect(html).toContain("Réessayer");
  expect(html).not.toContain("0/4");
});
