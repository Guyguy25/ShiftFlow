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


TEAM_PRICES = {
    'shiftflow_team_monthly': {'interval': 'month', 'amount': 8900},
    'shiftflow_team_yearly': {'interval': 'year', 'amount': 74760},
}
TEAM_PRODUCT = 'shiftflow_pro_team_v1'


def ensure_team_prices(stripe):
    """Provision only this new catalog. Deterministic product + idempotent prices."""
    try:
        product = stripe.Product.retrieve(TEAM_PRODUCT)
    except stripe.error.InvalidRequestError as exc:
        if exc.code != 'resource_missing':
            raise
        product = stripe.Product.create(id=TEAM_PRODUCT, name='ShiftFlow Pro Team',
            description='Missions et intervenants illimités, propriétaire et 5 collaborateurs.',
            metadata={'app': 'shiftflow', 'tier': 'team'}, idempotency_key='shiftflow-team-product-v1')
    if product.get('deleted') or not product.get('active', True) or product.get('metadata', {}).get('app') != 'shiftflow':
        raise HTTPException(503, 'Le produit Pro Team doit être vérifié dans Stripe.')
    result = {}
    for lookup, expected in TEAM_PRICES.items():
        prices = stripe.Price.list(lookup_keys=[lookup], active=True, limit=2).data
        if not prices:
            stripe.Price.create(product=TEAM_PRODUCT, currency='eur', unit_amount=expected['amount'],
                recurring={'interval': expected['interval']}, lookup_key=lookup, nickname=lookup,
                metadata={'app': 'shiftflow', 'tier': 'team'},
                idempotency_key=f"shiftflow-team-price-v1-{lookup}-{expected['amount']}")
        price = resolve_price(stripe, lookup, expected)
        if price.product != TEAM_PRODUCT:
            raise HTTPException(503, 'Ce tarif Pro Team appartient à un autre produit Stripe.')
        result[lookup] = price
    return result


def tier_from_subscription(stripe, subscription):
    """Trust actual subscription prices, including changes made through the portal."""
    if not hasattr(subscription, 'get'):
        return 'pro'
    prices = (subscription.get('items') or {}).get('data') or []
    for item in prices:
        price = item.get('price') or {}
        if isinstance(price, str):
            price = stripe.Price.retrieve(price)
        lookup = price.get('lookup_key') or price.get('nickname')
        expected = TEAM_PRICES.get(lookup)
        recurring = price.get('recurring') or {}
        if expected and (price.get('currency') == 'eur' and price.get('unit_amount') == expected['amount']
                         and recurring.get('interval') == expected['interval'] and recurring.get('interval_count') == 1
                         and price.get('product') == TEAM_PRODUCT):
            if subscription.get('pending_update'):
                return 'pro'
            invoice = subscription.get('latest_invoice')
            if isinstance(invoice, str):
                invoice = stripe.Invoice.retrieve(invoice)
            if invoice and (invoice.get('paid') is True or invoice.get('status') == 'paid'):
                return 'team'
    return 'pro'


def team_portal_configuration(stripe, allowed):
    prices = ensure_team_prices(stripe)
    for lookup in ('shiftflow_monthly', 'shiftflow_yearly'):
        prices[lookup] = resolve_price(stripe, lookup, allowed[lookup])
    products = {}
    for price in prices.values():
        products.setdefault(price.product, []).append(price.id)
    signature = '-'.join(sorted(price.id for price in prices.values()))
    return stripe.billing_portal.Configuration.create(
        features={
            'invoice_history': {'enabled': True}, 'payment_method_update': {'enabled': True},
            'subscription_cancel': {'enabled': True, 'mode': 'at_period_end'},
            'subscription_update': {'enabled': True, 'default_allowed_updates': ['price'],
                'proration_behavior': 'always_invoice',
                'products': [{'product': product, 'prices': ids} for product, ids in products.items()]},
        }, metadata={'app': 'shiftflow', 'version': 'team-v1'},
        idempotency_key=f'shiftflow-team-portal-v1-{signature}')
