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


## First-message confidence

Registration speaks to an organisation rather than only agencies. The public `/demo`
route simulates a one-place cascade with fictitious people using component state only:
no contact import, mission creation, message request, activation event or trial start.
It is linked from the landing page, the dashboard, account activation and the
first-mission FAQ (help and WhatsApp connection/import). Signup deliberately keeps
only the reassurance text: no demo detour while completing the registration form.

The FAQ distinguishes WhatsApp contact synchronisation from selected worker imports,
and describes automatic follow-ups after a real cascade has started. It does not
claim that reconnecting a previously active account suspends its automations.

The mission selector now loads the account's active message template for a personalised
preview (the response link is a labelled placeholder), lists selected recipients and
requires an explicit send confirmation. Changing the selection invalidates the review.
Connecting WhatsApp returns to review instead of automatically submitting the selection.
Preview failure blocks confirmation; retry and a synchronous submit lock prevent an
unreviewed send and concurrent duplicate submissions from the confirmation button.

Validation: InvitationReview.test.js covers preview/no-send, failed preview/retry,
selection invalidation, reconnect/no-send, duplicate clicks and the isolated demo.


## Focused entry points

Ads continue to land on the homepage. Its primary CTA announces account creation;
the secondary CTA opens the optional simulation. The message specifies the user's
existing network and WhatsApp. The signup form contains no simulation link.
After signup the next activation action stays primary; simulation and expandable
questions are secondary help, also available from the dashboard before first send.
Mission creation explicitly states it does not send invitations. These are usability
changes, not a measured conversion lift; assess completion and first-send rates over
comparable cohorts before drawing performance conclusions.
