import os
import httpx

from fastapi import APIRouter, Depends, HTTPException

from server import (
    get_current_user,
    db,
    new_id,
    iso,
    now_utc,
)


router = APIRouter(
    prefix="/whatsapp",
    tags=["WhatsApp"],
)


WHATSAPP_SERVICE_URL = os.environ.get(
    "WHATSAPP_SERVICE_URL",
    "http://localhost:3001",
).rstrip("/")


# ==========================================
# COMMUNICATION AVEC WHATSAPP SERVICE
# ==========================================

async def whatsapp_request(
    method: str,
    path: str,
    **kwargs,
):
    url = f"{WHATSAPP_SERVICE_URL}{path}"

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.request(
                method,
                url,
                **kwargs,
            )

    except httpx.RequestError as error:
        print(
            "❌ Service WhatsApp inaccessible :",
            error,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Le service WhatsApp n'est pas disponible. "
                "Vérifiez que whatsapp_service.js est lancé."
            ),
        )

    # ======================================
    # RÉPONSE DU SERVICE
    # ======================================

    try:
        data = response.json()
    except Exception:
        data = {
            "error": response.text
        }

    # ======================================
    # ERREUR HTTP
    # ======================================

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail=data.get(
                "error",
                "Erreur du service WhatsApp",
            ),
        )

    return data


# ==========================================
# STATUT WHATSAPP
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
# CONTACTS WHATSAPP
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
# ACTUALISER LES CONTACTS
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
# IMPORTER DANS SHIFTLOW
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

    # ======================================
    # VALIDATION
    # ======================================

    if not selected_contacts:
        raise HTTPException(
            status_code=400,
            detail="Aucun contact sélectionné.",
        )

    # ======================================
    # RÉCUPÉRATION DES CONTACTS WHATSAPP
    # ======================================

    whatsapp_data = await whatsapp_request(
        "GET",
        "/contacts",
    )

    whatsapp_contacts = {
        contact["id"]: contact
        for contact in whatsapp_data
        if contact.get("id")
    }

    # ======================================
    # CONTACTS SÉLECTIONNÉS
    # ======================================

    selected = []

    for contact_id in selected_contacts:
        contact = whatsapp_contacts.get(
            contact_id
        )

        if contact:
            selected.append(contact)

    if not selected:
        raise HTTPException(
            status_code=400,
            detail=(
                "Les contacts sélectionnés "
                "sont introuvables."
            ),
        )

    # ======================================
    # PLAN / QUOTA
    # ======================================

    plan = await db.users.find_one(
        {
            "id": user["id"],
        },
        {
            "plan": 1,
        },
    )

    plan_name = (
        (plan or {}).get(
            "plan",
            "free",
        )
    )

    current_count = await db.workers.count_documents(
        {
            "agency_id": user["id"],
        }
    )

    # Free = 10 workers
    # Pro = illimité

    limit = (
        None
        if plan_name == "pro"
        else 10
    )

    created = []
    skipped = []

    # ======================================
    # CRÉATION DES WORKERS
    # ======================================

    for contact in selected:

        # ----------------------------------
        # QUOTA
        # ----------------------------------

        if (
            limit is not None
            and current_count >= limit
        ):
            skipped.append(contact)
            continue

        # ----------------------------------
        # NUMÉRO
        # ----------------------------------

        number = str(
            contact.get(
                "number",
                "",
            )
        ).strip()

        if (
            not number
            or len(number) < 8
        ):
            skipped.append(contact)
            continue

        # ----------------------------------
        # NORMALISATION
        # ----------------------------------

        number = number.replace(
            " ",
            "",
        )

        if number.startswith("+"):
            normalized_number = number
        else:
            normalized_number = f"+{number}"

        # ----------------------------------
        # DÉTECTION DOUBLON
        # ----------------------------------

        possible_numbers = [
            number,
            normalized_number,
        ]

        # Cas français :
        # 33612345678
        # +33612345678
        # 0612345678

        number_without_plus = number.lstrip("+")

        if number_without_plus.startswith("33"):
            possible_numbers.append(
                f"0{number_without_plus[2:]}"
            )

        existing = await db.workers.find_one(
            {
                "agency_id": user["id"],
                "phone": {
                    "$in": possible_numbers,
                },
            }
        )

        if existing:
            skipped.append(contact)
            continue

        # ----------------------------------
        # NOM
        # ----------------------------------

        full_name = (
            contact.get("name")
            or "Sans nom"
        ).strip()

        parts = full_name.split()

        first_name = (
            parts[0]
            if parts
            else "Sans"
        )

        last_name = (
            " ".join(parts[1:])
            if len(parts) > 1
            else "Nom"
        )

        # ----------------------------------
        # WORKER
        # ----------------------------------

        worker = {
            "id": new_id(),
            "agency_id": user["id"],
            "first_name": first_name,
            "last_name": last_name,
            "phone": normalized_number,
            "email": "",
            "skills": [],
            "note": "",
            "active": True,
            "created_at": iso(
                now_utc()
            ),
        }

        await db.workers.insert_one(
            worker
        )

        worker.pop(
            "_id",
            None,
        )

        created.append(worker)

        current_count += 1

    # ======================================
    # RÉSULTAT
    # ======================================

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