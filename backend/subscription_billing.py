"""Resolve the configured Stripe subscription by lookup key or exact nickname."""
from fastapi import HTTPException


def resolve_price(stripe, name, expected):
    prices = stripe.Price.list(lookup_keys=[name], active=True, limit=1).data
    if not prices:
        # Dashboard labels are price nicknames, which need not be lookup keys.
        prices = [price for price in stripe.Price.list(
            active=True, type="recurring", limit=100).auto_paging_iter()
            if getattr(price, "nickname", None) == name]
    if len(prices) != 1:
        raise HTTPException(503, "Cette offre est indisponible ou ambiguë dans Stripe. Contactez le support.")
    price = prices[0]
    recurring = price.recurring
    if (not recurring or recurring.interval != expected["interval"]
            or recurring.interval_count != 1 or price.currency != "eur"
            or int(price.unit_amount or 0) != expected["amount"]):
        raise HTTPException(503, "Le tarif de paiement doit être vérifié par le support.")
    return price
