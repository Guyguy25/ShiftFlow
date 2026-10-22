import { workspacePath, unscopedPath } from "./workspacePaths";

test("legacy routes gain the organization and retain query strings and anchors", () => {
  expect(workspacePath("agency", "/app/settings#collaborateurs")).toBe("/app/organisations/agency/settings#collaborateurs");
  expect(workspacePath("agency", "/app/workers?q=Paul")).toBe("/app/organisations/agency/workers?q=Paul");
});
test("already scoped links do not accumulate organization prefixes", () => {
  expect(workspacePath("new", "/app/organisations/old/missions/123")).toBe("/app/organisations/new/missions/123");
  expect(unscopedPath("/app/organisations/team/missions/new")).toBe("/app/missions/new");
});
test("public and administration links remain outside the workspace", () => {
  for (const path of ["/pricing#team", "/admin", "/application"]) expect(workspacePath("agency", path)).toBe(path);
});
