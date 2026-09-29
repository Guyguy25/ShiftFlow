"""Run with backend environment configured: python registration_report.py.
Aggregate the current seven-day draft window. Never print contact information.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from server import db

LABELS = ["Identité", "Coordonnées", "Sécurité"]

async def main():
    # No visits for 30 minutes is a provisional abandonment, not a certainty.
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    print("Étape | Visites | Arrêts provisoires (>30 min sans activité)")
    for step, label in enumerate(LABELS):
        visited = await db.registration_drafts.count_documents({f"visited.{step}": {"$exists": True}})
        stopped = await db.registration_drafts.count_documents({"last_step": step, "completed_at": {"$exists": False}, "updated_at": {"$lt": cutoff}})
        print(f"{label} | {visited} | {stopped}")
    completed = await db.registration_drafts.count_documents({"completed_at": {"$exists": True}})
    print(f"Comptes créés : {completed}")

if __name__ == "__main__":
    asyncio.run(main())
