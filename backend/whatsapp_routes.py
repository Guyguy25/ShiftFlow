import os
import httpx

from fastapi import APIRouter, Depends, HTTPException

from server import get_current_user, db, new_id, iso, now_utc, check_quota_or_raise


router = APIRouter(
    prefix="/whatsapp",
    tags=["WhatsApp"],
)

WHATSAPP_SERVICE_URL = os.environ.get(
    "WHATSAPP_SERVICE_URL",
    "http://localhost:3001",
).rstrip("/")


async def whatsapp_request(method: str, path: str, **kwargs):
    url = f"{WHATSAPP_SERVICE_URL}{path}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(
                method,
                url,
                **kwargs,
            )

        if response.status_code >= 400:
            try:
                data = response.json()
            except Exception:
                data = {"error": response.text}

            raise HTTPException(
                status_code=response.status_code,
                detail=data.get(
                    "error",
                    "Erreur du service WhatsApp",
                ),
            )

        return response.json()

    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail=(
                "Le service WhatsApp n'est pas disponible. "
                "Vérifiez que whatsapp_service.js est lancé."
            ),
        )


# ==========================================
# STATUT
# ==========================================

@router.get("/status")
async def whatsapp_status(
    user=Depends(get_current_user),
):
    return await whatsapp_request(
        "GET",
        "/status",
    )


# ==========================================
# CONTACTS
# ==========================================

@router.get("/contacts")
async def whatsapp_contacts(
    user=Depends(get_current_user),
):
    return await whatsapp_request(
        "GET",
        "/contacts",
    )


# ==========================================
# ACTUALISER
# ==========================================

@router.post("/refresh")
async def whatsapp_refresh(
    user=Depends(get_current_user),
):
    return await whatsapp_request(
        "POST",
        "/refresh",
    )


# ==========================================
# IMPORTER DANS SHIFTFlow
# ==========================================

@router.post("/import")
async def whatsapp_import(
    payload: dict,
    user=Depends(get_current_user),
):
    selected_contacts = payload.get(
        "contacts",
        [],
    )

    if not selected_contacts:
        raise HTTPException(
            status_code=400,
            detail="Aucun contact sélectionné.",
        )

    # Récupération des contacts WhatsApp
    whatsapp_data = await whatsapp_request(
        "GET",
        "/contacts",
    )

    whatsapp_contacts = {
        contact["id"]: contact
        for contact in whatsapp_data
    }

    selected = []

    for contact_id in selected_contacts:
        contact = whatsapp_contacts.get(contact_id)

        if contact:
            selected.append(contact)

    if not selected:
        raise HTTPException(
            status_code=400,
            detail="Les contacts sélectionnés sont introuvables.",
        )

    # ==========================================
    # QUOTA
    # ==========================================

    plan = await db.users.find_one(
        {"id": user["id"]},
        {"plan": 1},
    )

    plan_name = (plan or {}).get(
        "plan",
        "free",
    )

    current_count = await db.workers.count_documents(
        {
            "agency_id": user["id"],
        }
    )

    limit = None if plan_name == "pro" else 10

    created = []
    skipped = []

    for contact in selected:

        if limit is not None and current_count >= limit:
            skipped.append(contact)
            continue

        number = contact.get(
            "number",
            "",
        )

        if not number:
            skipped.append(contact)
            continue

        # ==========================================
        # DÉTECTION DOUBLON
        # ==========================================

        existing = await db.workers.find_one(
            {
                "agency_id": user["id"],
                "phone": {
                    "$in": [
                        number,
                        f"+{number}",
                        f"0{number[2:]}"
                        if number.startswith("33")
                        else number,
                    ]
                },
            }
        )

        if existing:
            skipped.append(contact)
            continue

        # ==========================================
        # NOM
        # ==========================================

        full_name = (
            contact.get("name")
            or "Sans nom"
        ).strip()

        parts = full_name.split()

        first_name = parts[0] if parts else "Sans"
        last_name = (
            " ".join(parts[1:])
            if len(parts) > 1
            else "Nom"
        )

        # ==========================================
        # CRÉATION WORKER
        # ==========================================

        worker = {
            "id": new_id(),
            "agency_id": user["id"],
            "first_name": first_name,
            "last_name": last_name,
            "phone": f"+{number}",
            "email": "",
            "skills": [],
            "note": "",
            "active": True,
            "created_at": iso(now_utc()),
        }

        await db.workers.insert_one(worker)

        worker.pop("_id", None)

        created.append(worker)

        current_count += 1

    return {
        "success": True,
        "created": len(created),
        "skipped": len(skipped),
        "workers": created,
        "quota_hit": (
            limit is not None
            and len(skipped) > 0
            and current_count >= limit
        ),
        "limit": limit,
    }