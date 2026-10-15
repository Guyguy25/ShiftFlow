export function compensationLabel(shift) {
  const fixed = shift.pay_type === "fixed";
  const amount = fixed ? (shift.fixed_amount ?? 0) : (shift.rate_hourly ?? 0);
  const basis = { gross: " brut", net: " net" }[shift.pay_basis] || "";
  return `${amount} €${basis}${fixed ? " / cachet" : "/h"}`;
}
