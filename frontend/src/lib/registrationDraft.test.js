import { DRAFT_KEY, draftSnapshot, readDraft } from "./registrationDraft";

afterEach(() => localStorage.clear());
test("drafts use an allowlist and never retain passwords or consent", () => {
  const draft = draftSnapshot("a".repeat(64), 1, { name: "Camille", email: "test@example.com", password: "Secret123", acceptedTerms: true }, { main_pain: ["Relances"] });
  expect(draft.form).toEqual({ name: "Camille", email: "test@example.com", agency_name: "", phone: "" });
  expect(JSON.stringify(draft)).not.toContain("Secret123");
});
test("restoration strips injected credentials and bounds the step", () => {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ token: "a".repeat(64), updatedAt: Date.now(), step: 100, form: { password: "Secret123", name: "Camille" }, answers: {} }));
  expect(readDraft().step).toBe(2);
  expect(readDraft().form.password).toBe("");
  expect(readDraft().form.name).toBe("Camille");
});
test("expired and corrupt drafts do not break registration", () => {
  localStorage.setItem(DRAFT_KEY, "invalid-json");
  expect(readDraft()).toBeNull();
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ token: "a".repeat(64), updatedAt: Date.now() - 8 * 86400000 }));
  expect(readDraft()).toBeNull();
});
