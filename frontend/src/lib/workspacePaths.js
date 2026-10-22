// Keep existing bookmarks and internal links compatible with workspace URLs.
export function unscopedPath(pathname) {
  return pathname.replace(/^\/app\/organisations\/[^/]+(?=\/|$)/, "/app");
}
export function workspacePath(organizationId, path = "/app/dashboard") {
  if (!organizationId || !/^\/app(?:\/|$)/.test(path)) return path;
  return unscopedPath(path).replace(/^\/app(?=\/|$)/, `/app/organisations/${encodeURIComponent(organizationId)}`);
}
