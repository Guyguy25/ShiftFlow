"""Load mission list overviews in one shifts query instead of one per mission."""
from collections import defaultdict


def summarize_mission(mission, shifts):
    shifts = [shift for shift in shifts if not shift.get("deleted_at")]
    active = [shift for shift in shifts if shift.get("status") != "cancelled"]
    mission.update(
        first_date=min((s["date"] for s in active), default=None),
        last_date=max((s.get("end_date") or s["date"] for s in active), default=None),
        total_needed=sum(s["people_needed"] for s in active),
        total_confirmed=sum(s.get("confirmed_count", 0) for s in active),
        shifts=shifts,
    )
    return mission


async def load_mission_overviews(db, missions, compute_estimate):
    if not missions:
        return missions
    groups = defaultdict(list)
    rows = await db.shifts.find(
        {"mission_id": {"$in": [mission["id"] for mission in missions]}}, {"_id": 0}
    ).sort("date", 1).to_list(None)
    for shift in rows:
        group = groups[shift["mission_id"]]
        # Preserve the existing per-mission limit and date ordering.
        if len(group) < 500:
            shift["estimated_cost"] = compute_estimate(shift)
            group.append(shift)
    for mission in missions:
        summarize_mission(mission, groups[mission["id"]])
    return missions
