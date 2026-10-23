# Whop billing deployment

Every organization has separate operational data, WhatsApp configuration and subscription. Login identities remain in `users`; additional organization accounts use `organization_accounts`. The first organization retains its historical agency ID. Free mission reservations share the owner's original three-mission pool, atomically, across owned organizations. Invitations never transfer ownership or subscription benefits to a member's other organizations.

## Production prerequisites

Configure these server environment variables in the ShiftFlow Vercel project, for production, then redeploy:

- `WHOP_API_KEY`: server-only company API key with plan, checkout configuration, payment and membership read/create permissions required by this integration.
- `WHOP_COMPANY_ID`: company ID `biz_…` owning all six plans.
- `WHOP_WEBHOOK_SECRET`: signing secret of the production webhook.
- Leave `WHOP_SANDBOX` unset for production. Sandbox requires separate credentials and matching sandbox plans.

Webhook URL: `https://www.shiftflow.io/api/whop/webhook`. Subscribe to `payment.succeeded`, `payment.failed`, `payment.refunded` and all membership lifecycle events available in the Whop dashboard. Existing Stripe webhooks must remain enabled for existing subscribers.

The six public plan IDs live in `backend/whop_billing.py`. Expected EUR renewal prices (initial setup fee must be 0, because Whop adds it to the first recurring charge): Pro 79/month or 711/year; Team 99/month or 831.60/year; Business 149/month or 1072.80/year. Plans must be recurring, 30 or 365 days respectively, without trials, split-pay or multiple quantities. Whop adaptive pricing applies only to one-time purchases; its raw plan flag does not block these recurring plans. The modal uses `@whop/elements` and `@whop/elements-react` pinned to 1.9.0. It passes the server-created `ch_` configuration as `Checkout.checkoutConfiguration`, preserving the server-bound organization metadata. It mounts `CheckoutElement` directly, without a hosted-checkout button. Fulfillment verifies the actual currency and amount. The server validates the provider catalog before opening checkout. Tax treatment remains a merchant dashboard setting; the app does not assert tax exemption.

If configuration is missing, the public pricing page explains this and blocks new purchases. Never expose server keys in `REACT_APP_` variables or commit them. Plan IDs alone cannot authorize checkout or verify payment.

## Verification before accepting customers

1. Verify all six plans have the intended amounts, currency, recurrence and company. Ensure each product provides the intended subscription access; this application maps by plan ID.
2. In an isolated sandbox, create one checkout per tier and frequency; confirm its modal, return URL and signed webhook. Verify activation only after provider confirmation, including 3DS and delayed delivery.
3. Confirm cancellation at period end, renewal, failed renewal, full/partial refunds, portal plan changes with prorata, and duplicate/out-of-order notifications. A paid renewal on an already-bound membership can update its offer. Membership activation alone cannot grant an unpaid upgrade.
4. Confirm owner-only billing, Business administrator delegation, Business coordinator restrictions, five/fifteen collaborator caps, pending invitations, revocation and downgrade seat locking. Existing Stripe customers use their existing portal and cannot create a duplicate subscription.

Offline coverage uses mocked provider responses and in-memory MongoDB. It is not a substitute for a sandbox transaction with the company's real configuration. No live payment was made during implementation.

Feedback rewards from the Stripe era are blocked from accidental paid conversion; transfer outstanding personal free-month rewards with support before purchasing on Whop.

## CheckoutElement return handling

`Checkout.onComplete` only starts server verification for a `payment` result with a valid `pay_` identifier. A saved payment method or waitlist entry never unlocks access. Off-site steps return to pricing with the original checkout reference and organization plus `payment` and `status`. Failed/canceled returns show an interruption; succeeded returns still verify the payment server-side. The SDK handles card details inside its frames. Load failures remain in the dialog with a French retry instruction. The dialog scrolls within the mobile viewport.

Whop wallet buttons require merchant payment-method domain verification for `www.shiftflow.io` (and `shiftflow.io` if served there). Card checkout does not depend on those optional wallet buttons. See https://docs.whop.com/elements/beta/checkout/overview.

Unpaid checkout configurations are reused for 20 minutes per organization **and offer**, not across the whole organization. A buyer can close the modal and immediately inspect another tier or frequency. Old references remain available for delayed verified payments; browsing does not activate a subscription. Existing-subscription and fulfillment conflict guards remain in force.
