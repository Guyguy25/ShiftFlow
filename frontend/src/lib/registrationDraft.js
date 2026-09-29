import axios from "axios";
import { API } from "./api";

export const DRAFT_KEY = "shiftflow_registration_v2";
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export const emptyForm = { name: "", agency_name: "", email: "", phone: "", password: "" };
export const emptyAnswers = { team_size: "", monthly_missions: "", current_tool: "", main_pain: [] };
export function readDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (!d || Date.now() - d.updatedAt > MAX_AGE || !Number.isFinite(d.updatedAt)) { localStorage.removeItem(DRAFT_KEY); return null; }
    if (!/^[a-f0-9]{64}$/.test(d.token)) return null;
    return { ...d, step: Number.isInteger(d.step) ? Math.max(0, Math.min(2, d.step)) : 0,
      form: { ...emptyForm, ...safeFields(d.form), password: "" },
      answers: safeAnswers(d.answers) };
  } catch { return null; }
}
export function safeFields(form = {}) {
  return Object.fromEntries(["name", "agency_name", "email", "phone"].map(key => [key, typeof form[key] === "string" ? form[key].slice(0, 254) : ""]));
}
export function safeAnswers(answers = {}) {
  return { team_size: String(answers.team_size || "").slice(0, 80), monthly_missions: String(answers.monthly_missions || "").slice(0, 80), current_tool: String(answers.current_tool || "").slice(0, 80), main_pain: Array.isArray(answers.main_pain) ? answers.main_pain.filter(x => typeof x === "string").slice(0, 7).map(x => x.slice(0, 120)) : [] };
}
export function newDraftToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join("");
}
export function draftSnapshot(token, step, form, answers) {
  return { token, step, form: safeFields(form), answers: safeAnswers(answers), updatedAt: Date.now() };
}
// No auth refresh or advertising calls for anonymous draft storage.
export function sendDraft(snapshot) {
  return axios.put(`${API}/registration/draft`, { token: snapshot.token, step: snapshot.step, revision: snapshot.updatedAt, fields: snapshot.form, answers: snapshot.answers }, { timeout: 8000, withCredentials: true });
}
