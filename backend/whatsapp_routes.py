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


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/whatsapp",
    tags=["WhatsApp"],
)


# ============================================================
# CONFIGURATION SERVICE WHATSAPP
# ============================================================

WHATSAPP_SERVICE_URL = os.environ.get(
    "WHATSAPP_SERVICE_URL",
    "http://localhost:3001",
).rstrip("/")


WHATSAPP_TIMEOUT = float(
    os.environ.get(
        "WHATSAPP_SERVICE_TIMEOUT",
        "90",
    )
)


# ============================================================
# SESSION WHATSAPP
# ============================================================

def session_id_for_user(user):
    """
    Chaque utilisateur/agence possède
    sa propre session Baileys.

    Le service Node reçoit cet ID dans :
    X-WhatsApp-Session
    """

    return str(user["id"])


# ============================================================
# REQUÊTE VERS LE SERVICE BAILEYS
# ============================================================

async def whatsapp_request(
    method: str,
    path: str,
    user,
    **kwargs,
):
    url = (
        f"{WHATSAPP_SERVICE_URL}"
        f"{path}"
    )


    headers = dict(
        kwargs.pop(
            "headers",
            {},
        )
        or {}
    )


    headers[
        "X-WhatsApp-Session"
    ] = session_id_for_user(user)


    try:
        async with httpx.AsyncClient(
            timeout=WHATSAPP_TIMEOUT
        ) as client:

            response = await client.request(
                method,
                url,
                headers=headers,
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


    try:
        data = response.json()

    except Exception:
        data = {
            "error": response.text
        }


    if response.status_code >= 400:

        error_message = (
            data.get(
                "error",
                "Erreur du service WhatsApp",
            )
            if isinstance(
                data,
                dict,
            )
            else "Erreur du service WhatsApp"
        )


        raise HTTPException(
            status_code=response.status_code,
            detail=error_message,
        )


    return data


# ============================================================
# STATUS WHATSAPP
# ============================================================

@router.get("/status")
async def whatsapp_status(
    user=Depends(get_current_user),
):
    return await whatsapp_request(
        "GET",
        "/status",
        user,
    )


# ============================================================
# CONTACTS WHATSAPP
# ============================================================

@router.get("/contacts")
async def whatsapp_contacts(
    user=Depends(get_current_user),
):
    return await whatsapp_request(
        "GET",
        "/contacts",
        user,
    )


# ============================================================
# REFRESH CONTACTS
# ============================================================

@router.post("/refresh")
async def whatsapp_refresh(
    user=Depends(get_current_user),
):
    return await whatsapp_request(
        "POST",
        "/refresh",
        user,
    )


# ============================================================
# START SESSION
# ============================================================

@router.post("/session/start")
async def whatsapp_start(
    user=Depends(get_current_user),
):
    return await whatsapp_request(
        "POST",
        "/session/start",
        user,
    )


# ============================================================
# LOGOUT SESSION
# ============================================================

@router.post("/session/logout")
async def whatsapp_logout(
    user=Depends(get_current_user),
):
    return await whatsapp_request(
        "POST",
        "/session/logout",
        user,
    )


# ============================================================
# IMPORT WHATSAPP → WORKERS
# ============================================================

@router.post("/import")
async def whatsapp_import(
    payload: dict,
    user=Depends(get_current_user),
):
    selected_ids = payload.get(
        "contacts",
        [],
    )


    # --------------------------------------------------------
    # VALIDATION
    # --------------------------------------------------------

    if (
        not isinstance(
            selected_ids,
            list,
        )
        or not selected_ids
    ):
        raise HTTPException(
            status_code=400,
            detail="Aucun contact sélectionné.",
        )


    # --------------------------------------------------------
    # RÉCUPÉRER LES CONTACTS BAILEYS
    # --------------------------------------------------------

    whatsapp_data = await whatsapp_request(
        "GET",
        "/contacts",
        user,
    )


    if not isinstance(
        whatsapp_data,
        list,
    ):
        raise HTTPException(
            status_code=502,
            detail=(
                "Réponse invalide du service WhatsApp."
            ),
        )


    whatsapp_contacts = {
        str(contact.get("id")): contact
        for contact in whatsapp_data
        if contact.get("id")
    }


    # --------------------------------------------------------
    # CONTACTS SÉLECTIONNÉS
    # --------------------------------------------------------

    selected = []


    for contact_id in selected_ids:

        contact = whatsapp_contacts.get(
            str(contact_id)
        )


        if contact:
            selected.append(
                contact
            )


    if not selected:

        raise HTTPException(
            status_code=400,
            detail=(
                "Les contacts sélectionnés "
                "sont introuvables."
            ),
        )


    # --------------------------------------------------------
    # PLAN UTILISATEUR
    # --------------------------------------------------------

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


    # --------------------------------------------------------
    # NOMBRE ACTUEL DE WORKERS
    # --------------------------------------------------------

    current_count = (
        await db.workers.count_documents(
            {
                "agency_id": user["id"],
            }
        )
    )


    # --------------------------------------------------------
    # LIMITE
    # --------------------------------------------------------

    limit = (
        None
        if plan_name == "pro"
        else 10
    )


    created = []

    skipped = []


    # --------------------------------------------------------
    # CRÉATION DES WORKERS
    # --------------------------------------------------------

    for contact in selected:

        # -----------------------------------------------
        # LIMITE DU PLAN
        # -----------------------------------------------

        if (
            limit is not None
            and current_count >= limit
        ):
            skipped.append(
                contact
            )

            continue


        # -----------------------------------------------
        # NUMÉRO
        # -----------------------------------------------

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
            skipped.append(
                contact
            )

            continue


        number = number.replace(
            " ",
            "",
        )


        normalized_number = (
            number
            if number.startswith("+")
            else f"+{number}"
        )


        number_without_plus = (
            number.lstrip("+")
        )


        possible_numbers = [
            number,
            normalized_number,
        ]


        # France :
        # +33612345678
        # 0612345678

        if number_without_plus.startswith(
            "33"
        ):
            possible_numbers.append(
                f"0{number_without_plus[2:]}"
            )


        # -----------------------------------------------
        # ÉVITER LES DOUBLONS
        # -----------------------------------------------

        existing = await db.workers.find_one(
            {
                "agency_id": user["id"],
                "phone": {
                    "$in": possible_numbers,
                },
            }
        )


        if existing:
            skipped.append(
                contact
            )

            continue


        # -----------------------------------------------
        # NOM
        # -----------------------------------------------

        full_name = str(
            contact.get(
                "name",
                "",
            )
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


        # -----------------------------------------------
        # WORKER
        # -----------------------------------------------

        worker = {
            "id": new_id(),

            "agency_id":
                user["id"],

            "first_name":
                first_name,

            "last_name":
                last_name,

            "phone":
                normalized_number,

            "email":
                "",

            "skills":
                [],

            "note":
                "",

            "active":
                True,

            "created_at":
                iso(now_utc()),
        }


        # -----------------------------------------------
        # INSERTION
        # -----------------------------------------------

        await db.workers.insert_one(
            worker
        )


        worker.pop(
            "_id",
            None,
        )


        created.append(
            worker
        )


        current_count += 1


    # ====================================================
    # RÉPONSE
    # ====================================================

    return {
        "success": True,

        "created":
            len(created),

        "skipped":
            len(skipped),

        "workers":
            created,

        "quota_hit": (
            limit is not None
            and len(skipped) > 0
            and current_count >= limit
        ),

        "limit":
            limit,
    }