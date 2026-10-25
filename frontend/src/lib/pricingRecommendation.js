// Recommend by mission volume, never by the number of intervenants per mission:
// contacts are unlimited, while collaborator seats are separate account access.
const monthlyBands = {
  "1-3": [3, "1 à 3"], "1à3": [3, "1 à 3"], "0-3": [3, "0 à 3"],
  "4-10": [10, "4 à 10"], "4à10": [10, "4 à 10"],
  "11-20": [20, "11 à 20"], "11à20": [20, "11 à 20"],
  "21+": [21, "plus de 20"], "plusde20": [21, "plus de 20"],
};
const tierFor = monthly => monthly <= 3 ? "start" : monthly <= 20 ? "pro" : "business";
const validNumber = value => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value)) && Number(value) >= 0;

export function pricingRecommendation(answers) {
  if (!answers || typeof answers !== "object") return null;
  const monthly = answers.monthly_missions;
  if (typeof monthly === "string") {
    const band = monthlyBands[monthly.toLowerCase().replace(/\s/g, "").replace(/[–—]/g, "-")];
    if (band) return { tier: tierFor(band[0]), reason: `D’après vos ${band[1]} missions par mois.` };
  }
  if (validNumber(monthly)) {
    const count = Number(monthly);
    return { tier: tierFor(count), reason: `D’après vos ${count.toLocaleString("fr-FR")} missions par mois.` };
  }
  // Use only the saved answer; never replace missing answers with form defaults.
  if (validNumber(answers.annual_events)) {
    const annual = Number(answers.annual_events);
    return { tier: tierFor(annual / 12), reason: `D’après vos ${annual.toLocaleString("fr-FR")} événements par an.` };
  }
  return null;
}
