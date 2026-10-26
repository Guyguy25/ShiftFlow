// Short-lived, memory-only navigation data. Never persists private responses.
const entries = new Map();
let identity = "";
let generation = 0;
const SNAPSHOT_MS = 60000;
function key(url, config = {}) {
  const org = typeof window !== "undefined" ? window.location.pathname.match(/^\/app\/organisations\/([^/]+)/)?.[1] || "" : "";
  const params = Object.entries(config.params || {}).filter(([name, value]) => name !== "_ts" && value !== undefined && !(name === "archived" && value === false)).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([identity, org, url, params]);
}
export function clearPageData() { generation += 1; entries.clear(); }
export function setPageDataIdentity(user) {
  const next = user ? `${user.id}:${user.organization?.id || ""}` : "";
  if (next !== identity) { clearPageData(); identity = next; }
}
export function peekPageData(url, config) {
  const entry = entries.get(key(url, config));
  return entry && Date.now() - entry.at < SNAPSHOT_MS ? entry.data : undefined;
}
export function readPageData(api, url, config = {}) {
  const cacheKey = key(url, config);
  const previous = entries.get(cacheKey);
  if (previous?.promise) return previous.promise;
  // Always revalidate on a new visit; only simultaneous requests share a promise.
  const version = generation;
  const requestConfig = { ...config };
  // A departing page must not cancel a request still used by another consumer.
  delete requestConfig.signal;
  const entry = { ...previous, at: previous?.at || 0 };
  const promise = Promise.resolve().then(() => api.get(url, requestConfig)).then(response => {
    if (generation === version && entries.get(cacheKey) === entry) {
      entry.data = response.data; entry.at = Date.now();
    }
    return response;
  }).finally(() => {
    if (entries.get(cacheKey) === entry) {
      delete entry.promise;
      if (entry.data === undefined) entries.delete(cacheKey);
    }
  });
  entry.promise = promise;
  if (entries.size >= 256) entries.delete(entries.keys().next().value);
  entries.set(cacheKey, entry);
  return promise;
}
