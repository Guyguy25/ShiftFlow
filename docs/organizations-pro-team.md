# Organizations and Pro Team

Each account owns a personal organization, created idempotently on signup or first authenticated use. Organization IDs equal the existing account/agency IDs, preserving all missions, workers, WhatsApp configuration and hours without rewriting historical records. Registration step three collects the organization name. Organization name and compressed image can be changed by its owner in Settings.

Pro remains €79/month or €711/year (25%). Pro Team is €89/month or €747.60/year (30%), with the owner plus five additional collaborators. Pending invitations reserve places. All collaborators share missions, workers, hours and workspace configuration; billing, organization edits and membership management remain owner-only. Team has the existing unlimited Pro quotas (`plan=pro`, `subscription_tier=team`). Each request checks current membership and the owner's entitlement. Losing Team suspends member access while retaining data and letting members switch back to their personal space.

## Invitations

The owner creates email-bound invitations from Settings. Links expire after seven days, use a URL fragment, and contain a random secret stored only as SHA-256 in MongoDB. Accepting consumes the invitation atomically and switches the active organization. Switching reloads the application to clear workspace state. Removing a member takes effect on their next API request. The owner cannot be removed. The member's own identity/profile, personal organization and personal data remain separate.

Email delivery reuses `RESEND_API_KEY` and `ONBOARDING_EMAIL_FROM`; optional `TEAM_EMAIL_FROM` overrides the sender. Use a verified Resend sender. If either configuration or delivery is unavailable, the interface explicitly offers a copyable invitation link. No new environment variable is required for the workspace or Stripe integration.

## Stripe

Existing Stripe keys and webhook signing secret are reused. Team checkout or owner-only `POST /api/payments/catalog/sync` automatically provisions deterministic product `shiftflow_pro_team_v1` and lookup keys `shiftflow_team_monthly` (8900 EUR cents/month), `shiftflow_team_yearly` (74760 EUR cents/year). Product creation and price creation use stable idempotency keys; conflicting tariffs/products fail closed. Existing Pro prices remain unchanged. Products are provisioned on demand, not by frontend code.

Existing Pro subscribers use the Stripe billing portal to change plans, preventing duplicate subscriptions. The portal configuration allows all four recurring prices, displays prorations before confirmation, supports card updates and cancellation at period end. New subscriptions use the existing embedded Stripe Checkout modal. No actual charge is initiated automatically.

The webhook handles checkout completion/async payment, expiration/failure, subscription updates/deletions, invoice.paid and invoice.payment_failed. Configure the existing Stripe webhook `/api/stripe/webhook` to include these event types (or all events). Team entitlement derives from actual validated Stripe prices and a settled latest invoice, never frontend metadata. Subscription and invoice handlers retrieve current Stripe state to tolerate out-of-order events. Existing checkout status polling also fulfills paid checkout sessions.

## Validation

ASGI integration tests use an isolated in-memory MongoDB, real authentication dependencies and actual API routes. They cover registration, legacy migration, shared data, identity separation, isolation, invitations, concurrent seat limits, revocation, role/billing permissions and suspended Team access. Billing tests cover catalog provisioning, amount/product validation, paid entitlement and portal configuration. Frontend tests cover Team monthly/annual selection, Stripe upgrade behavior, settings restrictions and organization registration.

Run Python tests with `pip install -r backend/requirements-test.txt` and `python -m unittest discover -s backend/tests -p 'test_organizations.py'` (and other individual offline suites). Frontend: `CI=true npm test --prefix frontend -- --watchAll=false --runInBand`; build: `npm run build --prefix frontend`.
