# Guided activation and signup

## User experience

The authenticated layout shows five real milestones (including account creation), then retires the checklist after a successful first invitation. The next action uses the existing activation rules. On narrow screens the checklist collapses, and its redundant action is hidden on the current destination page.

Contextual hints appear next to mission creation, adding workers, WhatsApp connection, invitation preparation and incomplete profile fields. Dismissal is local and scoped to the user. Help can restore the hints without changing user data. Animations are finite and respect reduced-motion settings.

Signup now has three steps: identity, contact details, security. Existing password rules, advertising consent and attribution are retained. No survey is reintroduced.

## Draft storage and reporting

`PUT /api/registration/draft` stores a bounded allowlist of draft fields and step progress. Passwords and legal acceptance are never part of drafts. Local drafts permit same-browser resume; both local and server drafts expire after seven days. Server TTL cleanup is asynchronous. Successful signup removes personal draft fields.

Capability tokens are generated with 256 random bits and hashed at rest. There is no public read endpoint. Revision checks prevent delayed writes from overwriting newer data; completion prevents late writes from restoring personal fields. The endpoint is rate limited to 1200 writes per hour per socket peer. Configure forwarded-header trust only for the deployment's actual proxy if distinct client IPs are needed.

Run `python registration_report.py` from backend with the usual backend environment to inspect aggregate step visits, successful registrations and provisional stops after 30 minutes of inactivity. The report covers retained records; it exposes no contact details. A provisional stop is not proof of abandonment.

## Validation

Frontend production build; activation and draft unit tests; isolated backend activation and draft tests. Browser checks cover the three signup steps, same-browser resume, guided empty states, profile progress, Help, worker-add choices, and mobile layout down to 320px. These checks do not send real invitations or create production accounts.
