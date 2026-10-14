import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Seo from "./Seo";
import { getPageSeo } from "../lib/seo";

let mockPathname = "/";
jest.mock("react-router-dom", () => ({ useLocation: () => ({ pathname: mockPathname }) }), { virtual: true });

let host, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockPathname = "/";
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.head.querySelectorAll("meta, link[rel='canonical'], #seo-structured-data").forEach(node => node.remove());
});
const visit = async path => {
  mockPathname = path;
  await act(async () => root.render(<Seo />));
};

test("public navigation updates each canonical, title, and schema without duplicates", async () => {
  await visit("/");
  expect(document.title).toContain("équipes événementielles");
  const schema = JSON.parse(document.getElementById("seo-structured-data").textContent);
  expect(schema["@graph"].find(node => node["@type"] === "WebSite")).toMatchObject({ name: "ShiftFlow.io", url: "https://www.shiftflow.io/" });
  await visit("/pricing");
  expect(document.title).toContain("Tarifs");
  expect(document.querySelector('link[rel="canonical"]').href).toBe("https://www.shiftflow.io/pricing");
  expect(JSON.parse(document.getElementById("seo-structured-data").textContent)["@graph"].some(node => node["@type"] === "WebSite")).toBe(false);
  await visit("/demo");
  await visit("/");
  expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  expect(document.querySelectorAll('#seo-structured-data')).toHaveLength(1);
  expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
});

test("private and token routes lose public canonical and schema and become noindex", async () => {
  for (const route of ["/app/missions", "/m/private-token", "/payment/success", "/login", "/register", "/does-not-exist"]) {
    await visit("/");
    await visit(route);
    expect(document.querySelector('meta[name="robots"]').content).toBe("noindex, follow");
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[property="og:url"]')).toBeNull();
    expect(document.getElementById("seo-structured-data")).toBeNull();
  }
});

test("trailing slashes resolve to the same public canonical", () => {
  expect(getPageSeo("/pricing/").canonical).toBe("https://www.shiftflow.io/pricing");
});
