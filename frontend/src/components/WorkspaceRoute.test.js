import React, { act } from "react";
import { createRoot } from "react-dom/client";
import WorkspaceRoute from "./WorkspaceRoute";
let mockOrg = "agency", mockParams = {}, mockLocation;
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { organization: { id: mockOrg } } }) }));
jest.mock("react-router-dom", () => ({
  useLocation: () => mockLocation, useParams: () => mockParams,
  Navigate: ({ to }) => <a data-testid="redirect" href={to}>redirect</a>,
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
let host, root;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; mockOrg = "agency"; mockParams = {}; mockLocation = { pathname: "/app/settings", search: "?from=menu", hash: "#collaborateurs" }; host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = () => act(async () => root.render(<WorkspaceRoute><div data-testid="private-page">private</div></WorkspaceRoute>));
test("old links redirect before rendering workspace data", async () => { await render(); expect(host.querySelector('[data-testid="private-page"]')).toBeNull(); expect(host.querySelector("a").getAttribute("href")).toBe("/app/organisations/agency/settings?from=menu#collaborateurs"); });
test("a different organization ID never renders active workspace data", async () => { mockParams = { organizationId: "someone-else" }; await render(); expect(host.querySelector('[data-testid="private-page"]')).toBeNull(); expect(host.textContent).toContain("n’est pas votre organisation active"); });
test("the active organization renders its page", async () => { mockParams = { organizationId: "agency" }; await render(); expect(host.querySelector('[data-testid="private-page"]')).not.toBeNull(); });
