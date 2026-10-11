"""Daily authenticated visits, deduplicated atomically using UTC days."""
from datetime import date, timedelta, timezone

async def record_visit(users, user_id, at):
    at = at.astimezone(timezone.utc)
    await users.update_one({"id": user_id}, {
        "$addToSet": {"visit_days": at.date().isoformat()},
        "$min": {"visit_tracking_started_at": at.isoformat()},
    })

def visit_summary(user, now):
    today = now.astimezone(timezone.utc).date()
    days = sorted({date.fromisoformat(day) for day in user.get("visit_days", [])})
    returns = days[1:]
    return {
        "tracked": bool(days), "active_days": len(days),
        "return_count": len(returns), "returned": bool(returns),
        "tracking_started_at": user.get("visit_tracking_started_at"),
        "last_return_day": returns[-1].isoformat() if returns else None,
        "days_between_last_visits": (days[-1] - days[-2]).days if returns else None,
        "returned_7d": any(today - timedelta(days=6) <= day <= today for day in returns),
        "returned_30d": any(today - timedelta(days=29) <= day <= today for day in returns),
        "recent_visit_days": [day.isoformat() for day in days[-30:]],
    }

def retention_summary(users, now):
    summaries = [visit_summary(user, now) for user in users]
    tracked = sum(item["tracked"] for item in summaries)
    returned = sum(item["returned"] for item in summaries)
    return {
        "tracked_users": tracked, "returning_users": returned,
        "return_rate": round(100 * returned / tracked) if tracked else 0,
        "returning_users_7d": sum(item["returned_7d"] for item in summaries),
        "returning_users_30d": sum(item["returned_30d"] for item in summaries),
    }
