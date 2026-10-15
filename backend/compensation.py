"""Backward compatible compensation display; never infer gross/net for old data."""


def compensation_label(shift):
    fixed = shift.get("pay_type", "hourly") == "fixed"
    amount = shift.get("fixed_amount", 0) if fixed else shift.get("rate_hourly", 0)
    basis = {"gross": " brut", "net": " net"}.get(shift.get("pay_basis"), "")
    return f"{amount:g} €{basis}{' / cachet' if fixed else '/h'}"
