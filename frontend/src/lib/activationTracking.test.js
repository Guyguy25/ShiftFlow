import { api } from "./api";
import { trackActivation } from "./activationTracking";

jest.mock("./api", () => ({
  api: { post: jest.fn(() => Promise.resolve({})) },
}));

beforeEach(() => api.post.mockClear());

test("only allows named product events", () => {
  trackActivation("invalid_event", "some email");
  expect(api.post).not.toHaveBeenCalled();
  trackActivation("mission_form_opened");
  expect(api.post).toHaveBeenCalledWith("/activation/interaction", { event: "mission_form_opened", detail: null });
});

test("removes free-text and phone data from diagnostic events", () => {
  trackActivation("whatsapp_pair_error", "+33601020304");
  expect(api.post).toHaveBeenCalledWith("/activation/interaction", { event: "whatsapp_pair_error", detail: null });
});

test("keeps safe enumerated error categories", () => {
  trackActivation("mission_form_error", "validation");
  expect(api.post).toHaveBeenCalledWith("/activation/interaction", { event: "mission_form_error", detail: "validation" });
});
