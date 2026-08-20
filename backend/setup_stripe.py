"""One-shot Stripe catalog bootstrap. Idempotent. Run via python setup_stripe.py."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import stripe

stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

try:
    s = stripe.tax.Settings.retrieve()
    if not (s.head_office and getattr(s.head_office, "address", None)):
        stripe.tax.Settings.modify(
            head_office={"address": {"country": "FR", "line1": "1 rue Demo", "city": "Paris", "postal_code": "75001"}},
            defaults={"tax_behavior": "exclusive"},
        )
        print("Tax settings configured (FR)")
except Exception as e:
    print("tax settings warning:", e)

EMERGENT_PRODUCT_ID = "shiftflow_pro"
product = None
for p in stripe.Product.list(active=True).auto_paging_iter():
    if p.to_dict().get("metadata", {}).get("emergent_product_id") == EMERGENT_PRODUCT_ID:
        product = p
        break
if not product:
    product = stripe.Product.create(
        name="ShiftFlow Pro",
        description="Missions et intervenants illimités, cascade automatique, rappels SMS, historique complet.",
        tax_code="txcd_10103001",
        metadata={"managed_by": "emergent", "emergent_product_id": EMERGENT_PRODUCT_ID},
    )
print("Product:", product.id)

PRICES = [
    {"lookup_key": "shiftflow_pro_monthly", "amount": 4900, "currency": "eur", "interval": "month"},
    {"lookup_key": "shiftflow_pro_yearly",  "amount": 48800, "currency": "eur", "interval": "year"},
]
for pr in PRICES:
    existing = stripe.Price.list(lookup_keys=[pr["lookup_key"]], active=True, limit=1).data
    if existing and (existing[0].unit_amount != pr["amount"] or existing[0].currency != pr["currency"]):
        stripe.Price.modify(existing[0].id, active=False)
        existing = []
    if not existing:
        stripe.Price.create(
            product=product.id, unit_amount=pr["amount"], currency=pr["currency"],
            lookup_key=pr["lookup_key"], transfer_lookup_key=True,
            recurring={"interval": pr["interval"]},
        )
        print("Created price:", pr["lookup_key"])
    else:
        print("Price exists:", pr["lookup_key"])
print("DONE")
