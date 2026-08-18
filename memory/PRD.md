# ShiftFlow — PRD (MVP)

## Problem statement
B2B SaaS for small stand assembly/disassembly agencies and event technical providers. The agency owner is the only user with an account. Workers confirm/decline missions via a personal secure link — no worker login.

## Architecture
- Backend: FastAPI + Motor (MongoDB), JWT auth via httpOnly cookies, /api prefix.
- Frontend: React 19 + Tailwind + Shadcn primitives, sonner for toasts, lucide-react icons, mobile-first.
- Data model: users, workers, missions, mission_workers (slots with priority + token), notifications, password_reset_tokens.

## Core requirements (static)
1. Owner auth: signup / login / logout / password reset stub.
2. Workers CRUD (no accounts).
3. Missions CRUD.
4. Priority-ordered worker selection per mission.
5. Cascade logic: contact N first workers, on refuse/no-answer/cancel contact the next one, stop when confirmed_count == people_needed.
6. Public token-based confirmation page for workers (mobile-first, huge buttons).
7. Dashboard with KPIs, upcoming/ongoing missions, alerts.
8. History page for past missions.
9. Landing + Pricing (Free / Pro 49€ — Stripe architecture prepared, disabled).
10. Notifications: DEMO mode only (copyable link + open link). Twilio prepared, off.
11. AI Risk Alert: placeholder in settings.
12. Multi-tenant isolation: every collection has agency_id and all queries filter by user.id.

## Implemented (2026-08-18)
- Auth (JWT + httpOnly cookies), admin seed on startup.
- Demo workers (10) + 2 demo missions with varied slot statuses.
- Full mission lifecycle: create, select workers with priority, cascade auto-contact, accept/refuse/no-answer/cancel-confirmation, cancel/delete mission.
- Dashboard, Missions list, Mission detail (with copy link + open worker link), Workers CRUD, History, Settings.
- Public /m/:token page — mobile-first with huge accept/refuse buttons and refuse reasons.

## Not built (out of scope MVP)
- Real Twilio / WhatsApp send.
- Real Stripe checkout (page shows "Bientôt").
- Reminder 24h before (simulated concept only).
- AI risk alert (placeholder).
- Password reset UI page (endpoint exists, returns demo_token).
- Multi-user per agency.

## Backlog / next
- P1: Wire real SMS via Twilio (needs SID/token).
- P1: Stripe checkout for Pro plan.
- P1: Password reset UI + email delivery via Resend.
- P2: Real AI risk alert using Emergent LLM key.
- P2: ICS calendar file for accepted workers.
