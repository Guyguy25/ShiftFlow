import { API } from "./api";
import { trackActivation } from "./activationTracking";

const fetchBefore = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ok:true}));
});
afterAll(() => { global.fetch = fetchBefore; });

test("only allows named product events", () => {
  trackActivation("invalid_event", "some email");
  expect(global.fetch).not.toHaveBeenCalled();
  trackActivation("mission_form_opened");
  expect(global.fetch).toHaveBeenCalledWith(`${API}/activation/interaction`, expect.objectContaining({
    method: "POST", credentials: "include",
    body: JSON.stringify({event:"mission_form_opened", detail:null}),
  }));
});

test("removes phone data and free-text from event payload", () => {
  trackActivation("whatsapp_pair_error", "+33601020304");
  expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    body: JSON.stringify({event:"whatsapp_pair_error", detail:null}),
  }));
});

test("keeps safe predefined categories", () => {
  trackActivation("mission_form_error", "validation");
  expect(global.fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    body: JSON.stringify({event:"mission_form_error", detail:"validation"}),
  }));
});
