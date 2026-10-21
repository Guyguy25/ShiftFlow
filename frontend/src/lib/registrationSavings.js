// Illustrative workload assumptions, not measured customer results or net savings.
export const MINUTES_SAVED_PER_PERSON = 3;
export const HOURLY_TIME_VALUE = 30;

export function registrationSavings(events, people) {
  const annualEvents = Math.max(1, Math.min(300, Math.round(Number(events) || 30)));
  const peoplePerMission = Math.max(1, Math.min(150, Math.round(Number(people) || 15)));
  const hours = annualEvents * peoplePerMission * MINUTES_SAVED_PER_PERSON / 60;
  return { annualEvents, peoplePerMission, hours, value: hours * HOURLY_TIME_VALUE };
}
