# MALEK Help and Support System

**Status:** repository implementation contract; not proof of a staffed production support operation  
**Date:** 2026-08-20  
**Canonical rules:** PRD-001, PRD-006, PRD-009, SEC-002, SEC-003, SEC-005, SEC-010, UX-001, UX-002, UX-008  
**User route:** `/help`  
**Owners:** Product Operations (content), Platform (runtime), Security (privacy/escalation), Finance (financial articles)

## 1. Purpose and evidence

MALEK needs task help close to the work, not a second generic manual that duplicates every field. The implemented system combines:

1. concise inline states already present in forms, empty/error surfaces, permission dialogs and the offline banner;
2. a searchable, task-based in-app guide for recurring journeys and failure modes;
3. contextual article selection from the route that opened Help;
4. privacy-minimized internal support intake and request status; and
5. this operator/admin runbook.

The initial content set was inferred from the verified route contract, canonical product rules, repeated application error/empty states, account recovery behavior, financial duplicate-protection messages, bank import preview flow, document/PDF errors, permission workflow, offline notice and AI safety contract. No claim is made that production analytics or a staffed ticket history was available: repository logs are implementation evidence, not production-frequency evidence.

## 2. What belongs where

| Need                                                         | Surface                                     | Rule                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Required field meaning, irreversible effect, disabled action | Inline beside the field/action              | Keep specific and one sentence; never send users to Help to understand a dangerous button.             |
| Empty state and next valid action                            | Existing page empty state                   | Explain whether data is truly absent versus filtered; link to creation only when authorized.           |
| Loading/error/offline recovery                               | Existing state plus contextual Help article | Never display a data error as an empty result. Warn that offline writes are not queued reliably.       |
| Multi-step recurring task                                    | Searchable Help article                     | Three to five verified steps, warning, deep links and owner/date metadata.                             |
| Short factual question                                       | FAQ-style article search                    | Reuse task articles; do not create a separate duplicate FAQ taxonomy.                                  |
| Unresolved product defect or access issue                    | Internal support request                    | Capture minimized diagnostics and expected/actual behavior; no attachment.                             |
| Service availability                                         | Session status card                         | Report browser connectivity and build only. Do not claim backend health without an actual status feed. |
| Security/data/payment incident                               | Support escalation                          | Stop unsafe retries, create a high/critical internal request, and follow the runbook.                  |
| Support administration                                       | This document + controlled RPC              | ADMIN-only status updates with append-only events.                                                     |

## 3. Content map

The source is `rentrix-app/src/features/help-support/help-content.ts`. It is deliberately small and covers high-value tasks:

| Area                  | Articles                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Onboarding            | First office setup; property/unit setup                                                       |
| Leasing               | Contract creation, review and activation                                                      |
| Money                 | Invoices, collections and receipts; bank import and reconciliation                            |
| Permissions/access    | Missing actions and permission requests; login/session/password recovery                      |
| Reliability           | Offline, loading, save ambiguity and duplicate prevention; reports/PDF                        |
| Privacy               | Safe support sharing; AI Assistant limits                                                     |
| Billing clarification | Operational tenant/contract billing versus the currently absent MALEK subscription-billing UI |

The content does not reproduce field-by-field forms, accounting policy, legal wording, migration procedures or the canonical pack. It links to real routes and states the boundary when authority remains in reports, RPCs, legal review or accounting review.

## 4. Navigation and contextual search

- A keyboard-accessible Help icon is available in the authenticated global header on larger screens; phone users use the clearly labelled Help item in the mobile drawer.
- The header passes only the current pathname as `from`; query parameters and record identifiers are not captured.
- `/help?from=/contracts/...` opens the relevant task article. Unknown routes default to first-office setup.
- Search is local, Arabic-aware and matches title, summary, keywords and steps. No search text leaves the browser.
- Category filtering uses five stable groups: starting, workflows, access, troubleshooting and privacy.
- Article deep links target canonical routes and approved workspace query bindings.
- Each article carries a content owner and `verifiedOn` date. Search results expose a concise count through an `aria-live` status.

## 5. Support intake data contract

Migration: `supabase/migrations/20260902000000_self_service_support_requests.sql`.

### Captured automatically

- authenticated user and active company, derived by the server;
- active-company role, derived only by the server;
- route pattern only—query/fragment removed and UUID, long opaque and long numeric path segments replaced with `:id`; no page content or browser history;
- `VITE_APP_VERSION` when configured, otherwise the honest value `unavailable`;
- creation/update timestamps and an opaque `MS-YYYYMMDD-XXXXXXXX` reference.

### Entered by the user

- category and urgency;
- optional safe error reference;
- expected behavior and actual behavior, each 10–1,000 characters.

### Never collected

- password, passcode, token, API key, Authorization header, private key or recovery link;
- email, phone, national ID, bank/account/card number or another long numeric identifier;
- names, rent amounts, document text, bank rows or communication content;
- screenshots, attachments, contracts, IDs, logs, browser storage or full URLs.

Client and database validations reject common secrets, email-shaped content and sequences of eight or more digits. Detection is defense in depth, not permission to paste private data. The UI and article tell the user what not to enter.

Requests remain in the existing company-scoped MALEK database. There is no webhook, email sender, external analytics event or paid support integration.

## 6. Categories, urgency and routing

| Category          | Default owner                | Examples                                                    |
| ----------------- | ---------------------------- | ----------------------------------------------------------- |
| `HOW_TO`          | Product Operations           | How to complete a verified workflow                         |
| `ACCESS`          | Company admin, then Platform | Missing action, role or permission lifecycle                |
| `TECHNICAL`       | Platform                     | Error, latency, loading or PDF failure                      |
| `DATA_QUALITY`    | Platform + domain owner      | Missing/mixed/inconsistent records; no ad-hoc repair        |
| `PAYMENT_POSTING` | Finance + Platform           | Ambiguous payment, receipt, duplicate or posting result     |
| `SECURITY`        | Security + Platform          | Suspected exposure, cross-company access or credential risk |

| Urgency  | Meaning                                                           | Response target after a staffed support owner is enabled   |
| -------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| LOW      | Question; work continues                                          | 3 business days                                            |
| NORMAL   | Degraded with a safe workaround                                   | 2 business days                                            |
| HIGH     | Core task blocked                                                 | 1 business day                                             |
| CRITICAL | Security, potential data loss or potential payment/posting impact | Escalate immediately; human review target 4 business hours |

The server raises SECURITY, DATA_QUALITY and PAYMENT_POSTING requests to at least HIGH. CRITICAL is accepted only for those categories. Targets are operational goals, not contractual SLAs; the UI says so. Every valid request receives immediate automated `ACKNOWLEDGED` status and a reference.

## 7. Status lifecycle

`ACKNOWLEDGED → IN_REVIEW → WAITING_USER → RESOLVED → CLOSED`

- The requester sees reference, category, status, safe public note and updated date only. The list does not re-publish expected/actual descriptions.
- Only an active-company ADMIN may update status through `update_support_request_status_atomic`.
- Every creation and changed status appends a `support_request_events` row.
- A CLOSED request is immutable. A new recurrence gets a new request and references the old opaque ID in the operator's internal workflow—not in user free text.
- Public notes are limited to 500 characters and receive the same sensitive-content screening.

## 8. Security, data and payment escalation

### Security/privacy

1. Tell the user to stop using the affected route; do not ask for screenshots, credentials or record content.
2. Preserve request reference, timestamps, route and app version.
3. Use the feature kill switch or revoke access when an authorized incident procedure supports it.
4. Check company isolation and audit metadata. Never query another company merely to “compare.”
5. Escalate to Security and follow credential rotation/privacy notification obligations if evidence warrants.

### Data integrity

1. Stop writes to the affected workflow when records may be mixed or missing.
2. Do not “fix” rows directly in production.
3. Reproduce with safe IDs in an authorized environment and trace UI → service/RPC → DB → RLS → audit.
4. Use a forward migration or governed correction workflow only after evidence and approval.

### Payment/posting

1. Tell the user not to repeat the payment or create a compensating journal.
2. Check invoice, receipt/payment idempotency reference, authoritative status and GL/subledger evidence.
3. Escalate to Finance and Platform. Reversal/void uses the official maker-checker flow.
4. Never request bank credentials, full account numbers or a complete statement.

## 9. Admin/support runbook

There is intentionally no broad support-admin UI in this foundation. Authorized operators use reviewed SQL/RPC tooling against the correct environment; routine browser users cannot read the tables directly.

### Queue metadata

```sql
select reference, category, urgency, status, route, app_version,
       requester_role, created_at, updated_at
from public.support_requests
where company_id = '<authorized-company-id>'
  and status not in ('RESOLVED', 'CLOSED')
order by
  case urgency when 'CRITICAL' then 1 when 'HIGH' then 2 when 'NORMAL' then 3 else 4 end,
  created_at;
```

Do not export `expected_behavior` or `actual_behavior` into chat, email or analytics. Inspect only when assigned and authorized.

### Status update under the authenticated company-admin session

```sql
select public.update_support_request_status_atomic(
  '<request-id>'::uuid,
  'IN_REVIEW',
  'جارٍ فحص المرجع التقني'
);
```

Use `WAITING_USER` only with a safe, precise question that does not request private content. Use `RESOLVED` after the remediation or guidance is verified. Use `CLOSED` only after closure; it cannot be reopened.

### Operational review

- Daily: critical/high queue, aging and missing owner assignment outside the database.
- Weekly: repeated route/category pairs, stale WAITING_USER and unresolved defects.
- Monthly: article search gaps, article freshness, rejection rate and whether a staffed channel is sufficient.
- Incident: preserve metadata and event history; never enable broad table grants to speed investigation.

## 10. Ownership and update triggers

| Trigger                                                 | Required change                                                                                | Owner                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------- |
| Route, label, redirect or workspace binding changes     | Update links/context mapping and route tests in the same PR                                    | Product                 |
| Workflow, permission, error or offline behavior changes | Update affected article and `verifiedOn`                                                       | Feature owner + Product |
| Financial lifecycle/accounting rule changes             | Finance review; link to authority rather than restating policy                                 | Finance                 |
| Auth/recovery/privacy changes                           | Security review and intake screening tests                                                     | Security                |
| New support category/status/SLA                         | Migration, UI mapping, runbook and event tests together                                        | Platform + Operations   |
| New external platform/webhook                           | Privacy/security/procurement approval, DPA/retention, data map, kill switch and migration plan | Owner approval required |
| Article older than 180 days                             | Review against current code or remove from search until verified                               | Named article owner     |

## 11. Freshness and quality tests

Automated tests require:

- unique article IDs, at least three steps, valid owner and verification date;
- Arabic search and route-context behavior;
- rejection of secrets, email and long numbers;
- migration replay, company/actor/role derivation and automatic acknowledgement;
- metadata-only requester listing;
- sensitive-content rejection and ADMIN-only status updates;
- route registration and global Help access; and
- documentation links/typecheck/build.

A hosted browser pass remains required for phone/desktop search, keyboard expansion, screen-reader announcements, intake error/success focus and authenticated RLS behavior. Repository tests are not live support-readiness evidence.

## 12. External support platform decision

A paid platform is **not justified yet**. There is no measured ticket volume, staffing model, external SLA, omnichannel requirement or approved data-processing basis. The internal queue provides the required safe foundation without exporting user data.

If future evidence shows sustained volume that the internal queue cannot route, the recommended candidate is **Zendesk Suite** because it offers mature Arabic help-center/ticket workflows, role controls, SLAs, auditability and enterprise data-governance options. That is only a candidate: do not connect it until pricing, region, retention, DPA, SSO, redaction and field mapping are approved. At that point the single owner question should be:

> **Yes or no: approve a privacy/security/procurement evaluation of Zendesk using synthetic data only, with no production connection or real user data?**

No such approval is requested now because the platform is not currently justified.
