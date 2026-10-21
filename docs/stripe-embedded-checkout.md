# Stripe checkout in a modal

Stripe remains the sole payment provider. This replaces the inactive Whop integration with Stripe Embedded Checkout, using the existing subscription prices, coupons, webhook and billing portal.

## Configuration

Existing `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` stay on the Python backend.

Provide the matching **publishable** key using either:

- `STRIPE_PUBLISHABLE_KEY=pk_live_...` on the backend service (recommended; this Vercel repository routes `/api` to the Python service); or
- `REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...` as a frontend build variable.

The public config endpoint `/api/payments/config` returns only the publishable key and disables caching. It also accepts the existing backend alias `STRIPE_PUBLIC_KEY`. A secret key is never returned. The publishable and secret keys must belong to the same Stripe account and environment. Use matching `pk_test_...` / `sk_test_...` in a preview and sandbox webhook before testing cards.

The pricing page obtains the public key and requests `ui_mode=embedded` on `/api/payments/checkout`. The backend creates the subscription Checkout Session with `ui_mode=embedded`, card payments and `redirect_on_completion=never`, and returns the per-session client secret only to the authenticated owner. Stripe.js is loaded directly from `https://js.stripe.com/v3/` and mounts the embedded checkout in a Radix dialog. Closing, retrying and asynchronous initialization all clean up the Stripe instance.

If no publishable key is configured, existing hosted Stripe Checkout remains available. After adding the public key on Vercel and redeploying the relevant service, the modal is selected automatically. No Whop variables or provider flag are required; any old `REACT_APP_PAYMENT_PROVIDER=whop` value is ignored and can be removed.

## Pricing and rewards

Existing Stripe pricing is preserved: **79 EUR/month**, **711 EUR/year** (25% discount). The annual plan created on Whop at -45% is not transferred to Stripe. No Stripe price object is created or modified by this checkout UI change.

The personal two-month feedback coupon validation and Stripe discount application remain in the same server checkout route. Existing hosted clients still work: `CheckoutIn.ui_mode` defaults to `hosted`. Pending sessions are selected by UI mode so a previous hosted session cannot be returned as an embedded session. Idempotency keys include the mode; completed pending payments are reconciled before another subscription can be created.

## Payment confirmation

The Stripe browser completion callback only starts a read of `/api/payments/status/{session_id}`. This existing authenticated endpoint verifies transaction ownership and fulfills only a Stripe-confirmed paid (or explicitly zero-value complete) session. The Stripe webhook also continues to fulfill payments. The modal shows success and refreshes account access only after the server reports fulfillment. Card details are collected by Stripe, not ShiftFlow.

Public-key configuration and route smoke tests can be checked without creating accounts or charges. Real card payments, 3DS, cancellation and coupon end-to-end validation still require sandbox credentials; no live charge was made by this change.

## Validation

- Backend isolated tests: session parameters, hosted compatibility, mode-specific reuse, duplicate-purchase prevention, two-month reward, terms, ownership, safe public config, schema and unpaid fulfillment.
- Frontend: existing pricing/settings plus embedded monthly/annual selection, feedback code, duplicate clicks, modal lifecycle, delayed initialization, error/retry and server-confirmed success.
- Optimized frontend build including prerendered marketing pages.

References:
- https://docs.stripe.com/checkout/embedded/quickstart
- https://docs.stripe.com/api/checkout/sessions/create
- The installed `stripe==14.4.1` SDK pins API `2026-02-25.clover`, whose session schema supports `ui_mode=embedded` and `redirect_on_completion=never`.
