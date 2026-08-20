"""Idempotent Stripe setup for the user's own Stripe test account.
Uses the pre-existing product prod_V6sLUSy2g9m7Ga.
Creates a monthly 49 EUR recurring price if absent.
Registers a webhook endpoint pointing to the preview URL.
Writes STRIPE_WEBHOOK_SECRET back to .env.
"""
import os
import re
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(ENV_PATH)

import stripe

stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
PRODUCT_ID = os.environ["STRIPE_PRODUCT_ID"]
FRONTEND_URL = os.environ.get("FRONTEND_URL", "").rstrip("/")
WEBHOOK_URL = f"{FRONTEND_URL}/api/stripe/webhook"

acct = stripe.Account.retrieve()
print("Connected to Stripe account:", acct.id, "country:", acct.country)

product = stripe.Product.retrieve(PRODUCT_ID)
print("Product:", product.id, "-", product.name)

# 1) Look for or create the monthly 49 EUR recurring price
LOOKUP_MONTHLY = "shiftflow_pro_monthly"
price_id_monthly = None
prices = stripe.Price.list(product=PRODUCT_ID, active=True, limit=100).data
for p in prices:
    if (p.recurring and p.recurring.get("interval") == "month"
            and p.currency == "eur" and p.unit_amount == 4900):
        price_id_monthly = p.id
        print("Reusing existing monthly price:", p.id)
        # Ensure lookup_key is set for consistent frontend calls
        if p.lookup_key != LOOKUP_MONTHLY:
            try:
                stripe.Price.modify(p.id, lookup_key=LOOKUP_MONTHLY, transfer_lookup_key=True)
            except Exception as e:
                print("  (lookup_key set warning:", e, ")")
        break

if not price_id_monthly:
    p = stripe.Price.create(
        product=PRODUCT_ID,
        unit_amount=4900,
        currency="eur",
        lookup_key=LOOKUP_MONTHLY,
        transfer_lookup_key=True,
        recurring={"interval": "month"},
        tax_behavior="inclusive",  # 49€ total, no tax added
    )
    price_id_monthly = p.id
    print("Created monthly price:", p.id)

# 2) Register (or reuse) webhook endpoint
WEBHOOK_EVENTS = [
    "checkout.session.completed",
    "checkout.session.expired",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "customer.subscription.deleted",
    "customer.subscription.updated",
]
existing_hook = None
for wh in stripe.WebhookEndpoint.list(limit=100).auto_paging_iter():
    if wh.url == WEBHOOK_URL:
        existing_hook = wh
        break

if existing_hook:
    print("Webhook exists:", existing_hook.id, "→", existing_hook.url)
    # We cannot re-fetch the secret. We must delete + recreate to get a fresh one.
    try:
        stripe.WebhookEndpoint.delete(existing_hook.id)
        print("Deleted old webhook to regenerate secret")
        existing_hook = None
    except Exception as e:
        print("Delete webhook warning:", e)

hook = stripe.WebhookEndpoint.create(url=WEBHOOK_URL, enabled_events=WEBHOOK_EVENTS)
webhook_secret = hook.secret
print("Created webhook:", hook.id, "secret:", webhook_secret[:12] + "...")

# 3) Persist STRIPE_WEBHOOK_SECRET into .env
env_text = ENV_PATH.read_text()
if re.search(r'^STRIPE_WEBHOOK_SECRET=', env_text, re.M):
    env_text = re.sub(r'^STRIPE_WEBHOOK_SECRET=.*$',
                      f'STRIPE_WEBHOOK_SECRET="{webhook_secret}"',
                      env_text, flags=re.M)
else:
    env_text += f'\nSTRIPE_WEBHOOK_SECRET="{webhook_secret}"\n'
ENV_PATH.write_text(env_text)
print("Wrote STRIPE_WEBHOOK_SECRET to .env")

print("DONE. price_monthly_id =", price_id_monthly, " webhook_url =", WEBHOOK_URL)
