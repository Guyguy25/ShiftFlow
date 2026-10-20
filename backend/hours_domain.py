"""Time and money rules shared by timesheets and planned shift estimates."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo


def instant(value, zone="Europe/Paris", fold=0):
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is not None:
        return dt.astimezone(ZoneInfo(zone))
    tz = ZoneInfo(zone)
    dt = dt.replace(tzinfo=tz, fold=fold)
    # ZoneInfo accepts nonexistent spring-forward times; explicitly reject them.
    if dt.astimezone(timezone.utc).astimezone(tz).replace(tzinfo=None) != dt.replace(tzinfo=None):
        raise ValueError("Cet horaire n'existe pas lors du changement d'heure.")
    return dt


def normalize_entries(entries, zone="Europe/Paris", now=None):
    if not 1 <= len(entries) <= 100:
        raise ValueError("Renseignez entre 1 et 100 périodes de travail.")
    result, ranges = [], []
    for entry in entries:
        start = instant(entry["start"], zone, entry.get("start_fold", 0))
        end = instant(entry["end"], zone, entry.get("end_fold", 0))
        a, b = start.astimezone(timezone.utc), end.astimezone(timezone.utc)
        minutes = int((b - a).total_seconds() / 60)
        pause = entry.get("break_minutes", 0)
        if a.second or a.microsecond or b.second or b.microsecond:
            raise ValueError("Les horaires doivent être précis à la minute.")
        if minutes <= 0 or minutes > 31 * 24 * 60 or pause < 0 or pause >= minutes:
            raise ValueError("Vérifiez les dates de début/fin et la pause (inférieure à la durée).")
        if now and b > now:
            raise ValueError("Impossible de déclarer des heures futures.")
        ranges.append((a, b))
        result.append({"start": start.isoformat(), "end": end.isoformat(), "break_minutes": pause,
                       "start_fold": start.fold, "end_fold": end.fold,
                       "minutes": minutes - pause})
    ranges.sort()
    if any(right[0] < left[1] for left, right in zip(ranges, ranges[1:])):
        raise ValueError("Les périodes de travail se chevauchent.")
    if sum(row["minutes"] for row in result) > 31 * 24 * 60:
        raise ValueError("La déclaration dépasse 31 jours de travail.")
    return result


def planned_entries(shift, zone="Europe/Paris"):
    start = datetime.fromisoformat(f"{shift['date']}T{shift['start_time']}")
    end = datetime.fromisoformat(f"{shift.get('end_date') or shift['date']}T{shift['end_time']}")
    if not shift.get("end_date") and end <= start:
        end += timedelta(days=1)
    return normalize_entries([{"start": start.isoformat(), "end": end.isoformat(),
                               "break_minutes": shift.get("break_minutes", 0)}], zone)


def amount_cents(minutes, compensation):
    fixed = compensation.get("pay_type") == "fixed"
    amount = Decimal(str(compensation.get("fixed_amount" if fixed else "rate_hourly", 0)))
    if not fixed:
        amount *= Decimal(minutes) / Decimal(60)
    return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
