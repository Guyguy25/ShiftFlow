// Illustrative manual workload for a staffing coordinator, not messages observed by ShiftFlow.
// One initial invitation per place, one extra invitation per refusal and one J-1 reminder per place.
export function estimateLandingVolume({ missions, people, refusals }) {
  const initialRequests = missions * people;
  const replacementRequests = missions * refusals;
  const reminders = missions * people;
  const actions = initialRequests + replacementRequests + reminders;
  return { initialRequests, replacementRequests, reminders, actions, estimatedMinutes: actions };
}

export function formatLandingTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} h`;
  return `${hours} h ${String(remainder).padStart(2, "0")}`;
}
