import React, { act } from "react";
import { createRoot } from "react-dom/client";
import WorkspaceSearch from "./WorkspaceSearch";
import { api } from "../lib/api";
jest.mock("../lib/api", () => ({ api: { get: jest.fn() } }));
jest.mock("react-router-dom", () => ({ useLocation: () => ({ pathname: "/app/organisations/org/dashboard", search: "" }), Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
let host, root;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; jest.useFakeTimers(); jest.clearAllMocks(); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); api.get.mockResolvedValue({ data: { missions: [], workers: [] } }); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); jest.useRealTimers(); });
async function open() { await act(async () => root.render(<WorkspaceSearch organizationId="org"/>)); await act(async () => host.querySelector("button").click()); }
async function type(value) { await act(async () => { const input = document.querySelector('[aria-label="Rechercher dans l’organisation"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,value); input.dispatchEvent(new Event("input",{bubbles:true})); }); }
async function flush() { await act(async () => jest.advanceTimersByTime(300)); }
test("search opens accessibly and avoids requests for short queries", async () => { await open(); expect(document.querySelector('[role="dialog"]')).not.toBeNull(); await type("p"); await flush(); expect(api.get).not.toHaveBeenCalled(); });
test("results lead to missions and filtered workers in this organization", async () => { api.get.mockResolvedValue({ data: { missions: [{ id: "m1", name: "Festival", location: "Lille" }], workers: [{ id: "w1", first_name: "Paul", last_name: "Martin" }] } }); await open(); await type("paul"); await flush(); expect(api.get.mock.calls[0][1].params).toEqual({ q: "paul" }); expect(document.querySelector('a[href="/app/organisations/org/missions/m1"]')).not.toBeNull(); expect(document.querySelector('a[href="/app/organisations/org/workers?q=Paul%20Martin"]')).not.toBeNull(); });
test("an older response cannot replace results for the newer query", async () => { let first; api.get.mockImplementationOnce(() => new Promise(resolve => { first = resolve; })).mockResolvedValueOnce({ data: { missions: [{ id: "new", name: "New festival" }], workers: [] } }); await open(); await type("old"); await flush(); await type("new"); await flush(); await act(async () => first({ data: { missions: [{ id: "old", name: "Old festival" }], workers: [] } })); expect(document.body.textContent).toContain("New festival"); expect(document.body.textContent).not.toContain("Old festival"); });
test("API errors have an explicit message", async () => { api.get.mockRejectedValue(new Error("offline")); await open(); await type("festival"); await flush(); expect(document.querySelector('[role="alert"]').textContent).toContain("indisponible"); });
