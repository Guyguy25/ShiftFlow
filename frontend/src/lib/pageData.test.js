import { api as realApi } from "./api";
import { readPageData, peekPageData, clearPageData, setPageDataIdentity } from "./pageData";
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-26T12:00:00Z")); setPageDataIdentity(false); });
afterEach(() => jest.useRealTimers());
test("simultaneous consumers share one read; later visits revalidate with an immediate snapshot", async () => {
  let resolve;
  const api = { get: jest.fn(() => new Promise(done => { resolve = done; })) };
  const first = readPageData(api, "/missions");
  const second = readPageData(api, "/missions", { params: { archived: false, _ts: 10 } });
  await Promise.resolve();
  expect(first).toBe(second); expect(api.get).toHaveBeenCalledTimes(1);
  resolve({ data: [{ id: "one" }] }); await first;
  expect(peekPageData("/missions")).toEqual([{ id: "one" }]);
  const next = readPageData(api, "/missions"); await Promise.resolve();
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(peekPageData("/missions")).toEqual([{ id: "one" }]);
  resolve({ data: [{ id: "two" }] }); await next;
  expect(peekPageData("/missions")).toEqual([{ id: "two" }]);
});
test("mutations cannot let an older in-flight read repopulate invalidated data", async () => {
  let resolve;
  const api = { get: () => new Promise(done => { resolve = done; }) };
  const pending = readPageData(api, "/missions"); await Promise.resolve();
  clearPageData(); resolve({ data: ["old"] }); await pending;
  expect(peekPageData("/missions")).toBeUndefined();
});
test("accounts, organizations, filters and archived missions cannot share snapshots", async () => {
  const api = { get: jest.fn().mockResolvedValue({ data: ["private"] }) };
  setPageDataIdentity({ id: "a", organization: { id: "one" } });
  await readPageData(api, "/missions");
  expect(peekPageData("/missions", { params: { archived: true } })).toBeUndefined();
  expect(peekPageData("/missions", { params: { q: "other" } })).toBeUndefined();
  setPageDataIdentity({ id: "a", organization: { id: "two" } });
  expect(peekPageData("/missions")).toBeUndefined();
  await readPageData(api, "/missions");
  setPageDataIdentity({ id: "b", organization: { id: "two" } });
  expect(peekPageData("/missions")).toBeUndefined();
  await readPageData(api, "/missions"); setPageDataIdentity(false);
  expect(peekPageData("/missions")).toBeUndefined();
});
test("snapshots expire, failed reads are retryable, and unmount signals do not cancel other readers", async () => {
  const api = { get: jest.fn().mockResolvedValue({ data: [] }) };
  const controller = new AbortController();
  await readPageData(api, "/missions", { signal: controller.signal });
  expect(api.get.mock.calls[0][1].signal).toBeUndefined();
  jest.advanceTimersByTime(60001);
  expect(peekPageData("/missions")).toBeUndefined();
  api.get.mockRejectedValueOnce(new Error("offline"));
  await expect(readPageData(api, "/workers")).rejects.toThrow("offline");
  expect(peekPageData("/workers")).toBeUndefined();
  await readPageData(api, "/workers"); expect(peekPageData("/workers")).toEqual([]);
});

test("real API writes invalidate snapshots both before and after the mutation", async () => {
  const reader = { get: jest.fn().mockResolvedValue({ data: ["before"] }) };
  await readPageData(reader, "/missions");
  let finish;
  const write = realApi.post("/missions", {}, { adapter: config => new Promise(resolve => {
    finish = () => resolve({ data: {}, status: 200, statusText: "OK", headers: {}, config });
  }) });
  while (!finish) await Promise.resolve();
  expect(peekPageData("/missions")).toBeUndefined();
  await readPageData(reader, "/missions");
  finish(); await write;
  expect(peekPageData("/missions")).toBeUndefined();
});
