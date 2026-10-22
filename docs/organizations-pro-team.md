# Organizations and Pro Team

Each account may own one organization and belong to multiple organizations as an invited collaborator. Ordinary registration creates the owned organization idempotently. Invitation registration creates only the personal login and joins the inviting team; the owned organization is created later only if explicitly requested. Organization IDs equal the existing account/agency IDs, preserving all missions, workers, WhatsApp configuration and hours without rewriting historical records. Registration step three collects the organization name. Organization name and compressed image can be changed by its owner in Settings.

Pro remains €79/month or €711/year (25%). Pro Team is €89/month or €747.60/year (30%), with the owner plus five additional collaborators. Pending invitations reserve places. All collaborators share missions, workers, hours and workspace configuration; billing, organization edits and membership management remain owner-only. Team has the existing unlimited Pro quotas (`plan=pro`, `subscription_tier=team`). Each request checks current membership and the owner's entitlement. Losing Team suspends member access while retaining data. Members can switch to another team, return to their own organization, or explicitly create their own if they do not have one.

## Invitations

The owner creates email-bound invitations from Settings. New invitees use a single-step registration (name, email/password or Google), without business questions or an organization-name field. Registration validates the invitation and email before account creation, then accepts it server-side. If it is revoked during registration, the new account remains usable and can retry or create its own organization. Invite-only users are excluded from owner setup emails and onboarding prompts. Links expire after seven days, use a URL fragment, and contain a random secret stored only as SHA-256 in MongoDB. Accepting consumes the invitation atomically and switches the active organization. Switching reloads the application to clear workspace state. Removing a member takes effect on their next API request. The owner cannot be removed. The member's own identity/profile, personal organization and personal data remain separate.

Email delivery reuses `RESEND_API_KEY` and `ONBOARDING_EMAIL_FROM`; optional `TEAM_EMAIL_FROM` overrides the sender. Use a verified Resend sender. If either configuration or delivery is unavailable, the interface explicitly offers a copyable invitation link. No new environment variable is required for the workspace or Stripe integration.

## Stripe

Existing Stripe keys and webhook signing secret are reused. Team checkout or owner-only `POST /api/payments/catalog/sync` automatically provisions deterministic product `shiftflow_pro_team_v1` and lookup keys `shiftflow_team_monthly` (8900 EUR cents/month), `shiftflow_team_yearly` (74760 EUR cents/year). Product creation and price creation use stable idempotency keys; conflicting tariffs/products fail closed. Existing Pro prices remain unchanged. Products are provisioned on demand, not by frontend code.

Existing Pro subscribers use the Stripe billing portal to change plans, preventing duplicate subscriptions. The portal configuration allows all four recurring prices, displays prorations before confirmation, supports card updates and cancellation at period end. New subscriptions use the existing embedded Stripe Checkout modal. No actual charge is initiated automatically.

The webhook handles checkout completion/async payment, expiration/failure, subscription updates/deletions, invoice.paid and invoice.payment_failed. Configure the existing Stripe webhook `/api/stripe/webhook` to include these event types (or all events). Team entitlement derives from actual validated Stripe prices and a settled latest invoice, never frontend metadata. Subscription and invoice handlers retrieve current Stripe state to tolerate out-of-order events. Existing checkout status polling also fulfills paid checkout sessions.

## Validation

ASGI integration tests use an isolated in-memory MongoDB, real authentication dependencies and actual API routes. They cover registration, legacy migration, shared data, identity separation, isolation, invitations, concurrent seat limits, revocation, role/billing permissions and suspended Team access. Billing tests cover catalog provisioning, amount/product validation, paid entitlement and portal configuration. Frontend tests cover Team monthly/annual selection, Stripe upgrade behavior, settings restrictions and organization registration.

Run Python tests with `pip install -r backend/requirements-test.txt` and `python -m unittest discover -s backend/tests -p 'test_organizations.py'` (and other individual offline suites). Frontend: `CI=true npm test --prefix frontend -- --watchAll=false --runInBand`; build: `npm run build --prefix frontend`.

## Organization ownership and billing

The menu lists all joined organizations and offers **Create my organization** only when the account does not own one. `POST /api/organization` uses the immutable account ID as its organization ID and rejects a second creation, including concurrent calls. Creating an organization changes neither the stored subscription nor the existing mission balance. The three free missions are offered once for the owned organization, not per invitation, workspace switch or creation attempt.

Pro (€79/month or €711/year) covers only the owner's organization. Pro Team (€89/month or €747.60/year) covers that organization and up to five invited collaborators. Joining other teams does not incur an additional subscription for the invitee; each team owner pays for that team's access. Data, WhatsApp configuration, mission quotas and Stripe billing permissions remain scoped to the active organization. Owning multiple organizations is deliberately unavailable in this version; it requires separate organization billing records before it can be supported.
