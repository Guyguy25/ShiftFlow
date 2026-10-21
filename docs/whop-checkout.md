# Whop embedded checkout

The frontend uses the existing Stripe checkout until `REACT_APP_PAYMENT_PROVIDER=whop` is set at build time. The Whop implementation opens a responsive modal, binds the purchase to an authenticated ShiftFlow transaction using an opaque token, validates the live Whop plan before collecting payment, and grants access only after a signed webhook and a server-side membership read. The billing portal uses Whop's membership management URL.

## Deployment configuration

The repository's root `vercel.json` routes `/api` to its Python backend service. The currently published frontend uses `https://www.shiftflow.io` as its API origin. Put backend secrets in the environment of the service that actually runs `backend/server.py` (Vercel for this multi-service configuration; Railway only if separately hosting that backend). Never prefix secret names with `REACT_APP_`.

Backend environment:

```dotenv
WHOP_API_KEY=<company API key>
WHOP_WEBHOOK_SECRET=<exact signing secret from the webhook, ws_...>
WHOP_COMPANY_ID=<biz_... from your Whop company>
WHOP_MONTHLY_PLAN_ID=plan_RK1Q30cZoGceV
WHOP_YEARLY_PLAN_ID=plan_qTHTFF6iyWHCn
FRONTEND_URL=https://www.shiftflow.io
```

The plan IDs have these defaults in code but can be overridden for a sandbox. Monthly must be a EUR recurring plan with 79 initial and recurring price, billing period 30, no trial. Annual must have 521.40 initial and recurring price, billing period 365, no trial. Prices are checked server-side; a mismatch blocks checkout rather than collecting the wrong price. Confirm the annual amount in Whop before activation.

1. Create a **company API key** in Whop Developer. Grant read access to plans, memberships, payments and the membership management URL. If the UI offers only role presets, use an appropriate business billing role. Keep the key private.
2. Deploy this code with the frontend switch still unset. Add the backend variables except the webhook secret initially.
3. In Whop Developer, create a webhook with URL `https://www.shiftflow.io/api/whop/webhook`, API envelope **v1** (not legacy v2/v5), and events **payment.succeeded**, **payment.failed**, **membership.activated**, **membership.updated**. If the UI exposes other membership lifecycle events, subscribe to them too: all `membership.*` events reconcile the current API state. Copy its signing secret verbatim to `WHOP_WEBHOOK_SECRET`; redeploy the backend. Sample events with placeholder membership IDs do not test fulfillment; use a real sandbox transaction.
4. In an isolated preview using sandbox API keys, sandbox plan IDs and a matching sandbox webhook, set the frontend build variable `REACT_APP_PAYMENT_PROVIDER=whop`. The sandbox plans must have the same expected EUR prices. Verify monthly and annual success, declined/canceled payments, no access before webhook, duplicate deliveries, cancellation, renewal and billing portal. No real purchase has been made by this change.
5. Add `REACT_APP_PAYMENT_PROVIDER=whop` to the **Production** frontend environment and redeploy only after the preceding checks. No Whop API secret belongs in the browser. Keep `REACT_APP_BACKEND_URL` as already configured; do not change the API origin for this migration.
6. If wallets are required, register/verify the production payment method domain with Whop (including the domain actually used, e.g. `www.shiftflow.io`). Whop requires a verified domain for express wallets; card checkout and wallet availability are distinct checks.

The old Stripe endpoints remain available for rollback and historical payment records. Removing the frontend switch and rebuilding restores the existing Stripe prices (79/month, 711/year). Existing Whop subscribers retain the Whop management portal, independently of that switch.

## Feedback rewards

Personal two-month feedback coupons currently belong to Stripe. The Whop endpoint explicitly blocks these purchases with an explanatory message; it never silently charges full price for a promised free offer. These coupons need an equivalent Whop promotion or manual support handling before those accounts can subscribe through Whop.

## Verification performed in this change

- Python unit tests for plan validation, signatures, tampering/replay, checkout ownership, activation/cancellation, period-end access, stale snapshots, duplicate events, provider failures and billing portal URL validation.
- Frontend tests for monthly/annual Whop selection, modal lifecycle, duplicate clicks, SDK failures, server confirmation and existing Stripe pricing/settings.
- Production frontend build with Whop enabled, including server-rendered marketing pages and aligned annual price/legal/provider copy.

A live end-to-end transaction and wallet checks still require the seller's private configuration and are not claimed as completed.

## Sources

- https://docs.whop.com/payments/checkout-embed
- https://docs.whop.com/developer/guides/webhooks
- https://docs.whop.com/api-reference/plans/retrieve-plan
- https://docs.whop.com/api-reference/memberships/retrieve-membership
- https://docs.whop.com/api-reference/payments/retrieve-payment
