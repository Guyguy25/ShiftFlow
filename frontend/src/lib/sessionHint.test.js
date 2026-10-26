import { hasSessionHint, saveSessionHint } from "./sessionHint";
beforeEach(() => localStorage.clear());
test("only a confirmed session hint is retained, and logout removes it", () => {
  expect(hasSessionHint()).toBe(false);
  saveSessionHint(true);
  expect(hasSessionHint()).toBe(true);
  expect(localStorage.getItem("shiftflow-session-known")).toBe("1");
  saveSessionHint(false);
  expect(hasSessionHint()).toBe(false);
});
test("unavailable storage does not prevent rendering or logging out", () => {
  const read = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  const remove = jest.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(hasSessionHint()).toBe(false);
  expect(() => saveSessionHint(true)).not.toThrow();
  expect(() => saveSessionHint(false)).not.toThrow();
  read.mockRestore(); write.mockRestore(); remove.mockRestore();
});
