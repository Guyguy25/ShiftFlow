# Whop billing deployment

**Catalog updated 2026-10-24:** see [pricing-v2-2026-10-24.md](pricing-v2-2026-10-24.md) for prices, shared monthly quotas, grandfathering and live verification requirements.

Every organization has separate operational data and WhatsApp configuration. One subscription covers every workspace with the same owner, including future workspaces. Under the 2026-10-24 catalog, Start allows the owner only, Pro adds three distinct collaborators, and Business adds ten. Pre-existing Team and Business subscriptions retain their five/fifteen seats respectively. A person in multiple owned spaces counts once, and pending invitations reserve shared seats. Owner-wide locks serialize purchases, seat reservations and lifecycle events. Login identities remain in `users`; additional organization accounts use `organization_accounts`. The first organization retains its historical agency ID. Free mission reservations share the owner's original three-mission pool, atomically, across owned organizations. Invitations never transfer ownership or subscription benefits to a member's other organizations.

## Production prerequisites

Configure these server environment variables in the ShiftFlow Vercel project, for production, then redeploy:

- `WHOP_API_KEY`: server-only company API key with plan, checkout configuration, payment and membership read/create permissions required by this integration.
- `WHOP_COMPANY_ID`: company ID `biz_…` owning all six plans.
- `WHOP_WEBHOOK_SECRET`: signing secret of the production webhook.
- Leave `WHOP_SANDBOX` unset for production. Sandbox requires separate credentials and matching sandbox plans.

Webhook URL: `https://www.shiftflow.io/api/whop/webhook`. Subscribe to `payment.succeeded`, `payment.failed`, `refund.created`, `refund.updated` and all membership lifecycle events available in the Whop dashboard. Existing Stripe webhooks must remain enabled for existing subscribers.

The six public plan IDs live in `backend/whop_billing.py`. Expected EUR renewal prices (initial setup fee must be 0, because Whop adds it to the first recurring charge): Start (formerly Team plan IDs) 29/month or 278.40/year; Pro 79/month or 711/year; Business 149/month or 1072.80/year. Existing Team contracts require separate grandfathering checks at renewal (see pricing-v2-2026-10-24.md). Plans must be recurring, 30 or 365 days respectively, without trials, split-pay or multiple quantities. Whop adaptive pricing applies only to one-time purchases; its raw plan flag does not block these recurring plans. The modal uses `@whop/elements` and `@whop/elements-react` pinned to 1.9.0. It passes the server-created `ch_` configuration as `Checkout.checkoutConfiguration`, preserving the server-bound organization metadata. It mounts `CheckoutElement` directly, without a hosted-checkout button. Fulfillment verifies the actual currency and amount. The server validates the provider catalog before opening checkout. Tax treatment remains a merchant dashboard setting; the app does not assert tax exemption.

If configuration is missing, the public pricing page explains this and blocks new purchases. Never expose server keys in `REACT_APP_` variables or commit them. Plan IDs alone cannot authorize checkout or verify payment.

## Verification before accepting customers

1. Verify all six plans have the intended amounts, currency, recurrence and company. Ensure each product provides the intended subscription access; this application maps by plan ID.
2. In an isolated sandbox, create one checkout per tier and frequency; confirm its modal, return URL and signed webhook. Verify activation only after provider confirmation, including 3DS and delayed delivery.
3. Confirm cancellation at period end, renewal, failed renewal, full/partial refunds, portal plan changes with prorata, and duplicate/out-of-order notifications. A paid renewal on an already-bound membership can update its offer. Membership activation alone cannot grant an unpaid upgrade.
4. Confirm owner-only billing, Business administrator delegation, Business coordinator restrictions, v2 Start/Pro/Business collaborator caps (0/3/10) and legacy Team/Business caps (5/15), pending invitations, revocation and downgrade seat locking. Existing Stripe customers use their existing portal and cannot create a duplicate subscription.

Offline coverage uses mocked provider responses and in-memory MongoDB. It is not a substitute for a sandbox transaction with the company's real configuration. No live payment was made during implementation.

Feedback rewards from the Stripe era are blocked from accidental paid conversion; transfer outstanding personal free-month rewards with support before purchasing on Whop.

## CheckoutElement return handling

`Checkout.onComplete` only starts server verification for a `payment` result with a valid `pay_` identifier. A saved payment method or waitlist entry never unlocks access. Off-site steps return to pricing with the original checkout reference and organization plus `payment` and `status`. Failed/canceled returns show an interruption; succeeded returns still verify the payment server-side. The SDK handles card details inside its frames. Load failures remain in the dialog with a French retry instruction. The dialog scrolls within the mobile viewport.

Whop wallet buttons require merchant payment-method domain verification for `www.shiftflow.io` (and `shiftflow.io` if served there). Card checkout does not depend on those optional wallet buttons. See https://docs.whop.com/elements/beta/checkout/overview.

Unpaid checkout configurations are reused for 20 minutes per selected workspace **and offer**, not across the whole organization. A buyer can close the modal and immediately inspect another tier or frequency. Old references remain available for delayed verified payments; browsing does not activate a subscription. Existing subscriptions across the owner’s workspaces block additional purchases. Old Whop and Stripe subscriptions keep their original provider binding; no charge is silently migrated or cancelled. Entitlements are resolved at read time so future spaces and revocations stay consistent.

## Meta attribution with Whop

The existing Meta pixel ID is retained. With current cookie consent, checkout records the browser attribution context and sends `InitiateCheckout` once per configuration. A verified initial Whop payment sends the existing `Subscribe` conversion server-side, once per membership (`subscribe_mem_…`), including the paid EUR amount. Replays use the same event ID and a persisted sent marker. No consent means no attribution event. Analytics failures never block paid access. The server needs its existing `META_PIXEL_ID` and `META_CAPI_ACCESS_TOKEN`; the client keeps its existing public pixel ID. Avoid a second independent Whop-to-Meta subscription conversion integration unless deduplication IDs are coordinated. Confirm delivery in Meta Test Events; offline tests and a rendered checkout cannot establish real transaction/webhook delivery.
