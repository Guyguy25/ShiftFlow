// Suggestion de correction pour les fautes de frappe courantes dans le domaine
// d'un email (gmial.com, hotmail.fe…), comme le font Stripe ou Mailcheck.
const DOMAINS = [
  "gmail.com", "hotmail.fr", "hotmail.com", "outlook.fr", "outlook.com", "live.fr", "yahoo.fr", "yahoo.com",
  "orange.fr", "free.fr", "sfr.fr", "laposte.net", "wanadoo.fr", "icloud.com", "me.com", "bbox.fr", "neuf.fr",
];

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

export function suggestEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1) return null;
  const domain = value.slice(at + 1);
  if (domain.length < 3 || DOMAINS.includes(domain)) return null;
  let best = null;
  for (const candidate of DOMAINS) {
    const d = distance(domain, candidate);
    if (d > 0 && d <= 2 && (!best || d < best.d)) best = { candidate, d };
  }
  return best ? `${value.slice(0, at)}@${best.candidate}` : null;
}

export function passwordChecks(password) {
  const value = String(password || "");
  return {
    length: value.length >= 8,
    letter: Array.from(value).some(c => c.toLowerCase() !== c.toUpperCase()),
    digit: /[0-9]/.test(value),
  };
}

export function passwordScore(password) {
  const checks = passwordChecks(password);
  const base = Object.values(checks).filter(Boolean).length;
  if (base < 3) return base;
  return 3 + (password.length >= 12 || /[^A-Za-z0-9]/.test(password) ? 1 : 0);
}
