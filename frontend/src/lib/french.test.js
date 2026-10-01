import { counted } from "./french";
test("French counters agree without optional plural suffixes", () => {
  expect(counted(0, "mission disponible", "missions disponibles")).toBe("0 mission disponible");
  expect(counted(1, "mission disponible", "missions disponibles")).toBe("1 mission disponible");
  expect(counted(2, "mission disponible", "missions disponibles")).toBe("2 missions disponibles");
  expect(counted(1, "achetée")).toBe("1 achetée");
  expect(counted(5, "achetée")).toBe("5 achetées");
});
