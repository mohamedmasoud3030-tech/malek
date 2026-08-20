# MALEK Admin and Support Operations Specification

**Status:** repository-side minimal operations toolkit; not proof of production deployment or staffing  
**Date:** 2026-08-20  
**Canonical rules:** PRD-001, PRD-009, SEC-002, SEC-003, SEC-004, SEC-005, SEC-008, SEC-009, SEC-010, UX-001, UX-008  
**Route:** `/admin-support`  
**Owners:** Platform Operations, Security, Product Operations; Finance owns every financial correction decision

## 1. Product decision

MALEK does not need a universal super-admin console. Staff need a narrow, company-scoped toolkit to answer four real questions:

1. Is the user blocked by support status, access, configuration, or a system failure?
2. What safe metadata identifies the affected route/version/event without opening private business content?
3. Can a low-risk support request be moved through triage with an accountable reason?
4. If access appears wrong, what change should be proposed for independent approval—without executing it?

The implemented route provides masked read-only investigation, single-request support triage and non-executable access proposals. It intentionally has no impersonation, arbitrary record editor, unrestricted search, export, bulk mutation, refund, cancellation, payment, journal, production SQL or access-change execution.

## 2. Inventory and disposition

| Capability               | Repository reality before this work                                                                | Decision                                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| User lookup              | ADMIN user-role screen read full names/emails and directly updated `public.users` from the browser | Keep ADMIN-only lookup but mask results in support operations; retire direct browser writes. Existing user list becomes read-only.                   |
| User role/status changes | Direct table update, no reason/idempotency/maker-checker/re-auth                                   | Disable execution. Add reasoned, idempotent, expiring proposal only.                                                                                 |
| Support requests         | User can create/list own; historical ADMIN status RPC allowed reason-optional updates              | Add ADMIN/MANAGER triage RPC with required reason, safe public note, transition rules, event/audit evidence and idempotency. Revoke old browser RPC. |
| Business records         | Feature-specific routes and RLS/RPCs exist                                                         | Support toolkit shows no tenant/owner/contract/payment content. Staff follow a generic route and use existing authorization.                         |
| Status changes           | Many domain-specific status workflows                                                              | Only support-ticket status is available here. Contract, payment, receipt, settlement and maintenance status remain in authoritative feature RPCs.    |
| Moderation               | No marketplace/user-generated public content                                                       | Not applicable; do not invent a moderation queue.                                                                                                    |
| Refunds/cancellations    | Financial reversal/void and contract termination are governed feature workflows                    | No support/admin action. Support can investigate metadata and link the operator to the official workflow only.                                       |
| Impersonation            | No approved system                                                                                 | Prohibited. No session/token creation, “view as user,” password reset or bypass.                                                                     |
| Exports                  | Existing domain reports have explicit permissions                                                  | No admin/support export. Snapshot hard-codes `exports=false`.                                                                                        |
| Bulk actions             | No safe operational need established                                                               | None. Snapshot hard-codes `bulk_actions=0`; every triage action is single-record.                                                                    |
| Support notes            | User-visible `public_note`; support descriptions stored internally                                 | Allow one screened public note plus separate required reason in immutable event. No private free-form dossier.                                       |
| Configuration            | Settings/system pages exist                                                                        | Read/link only according to existing permissions; no config mutation in this toolkit.                                                                |
| Audit history            | General audit log plus support events exist                                                        | Add append-only support-operations audit preview with masked actor and no target ID/reason in UI.                                                    |
| Investigation tools      | Audit/data-integrity/support pages were separate                                                   | Add one summary joining only safe counts and metadata; no arbitrary table/entity query.                                                              |

## 3. Role and capability matrix

Capabilities—not hidden buttons—are the contract.

| Capability                               |               ADMIN | MANAGER | ACCOUNTANT | OPERATIONS | USER | VIEWER |
| ---------------------------------------- | ------------------: | ------: | ---------: | ---------: | ---: | -----: |
| `support.operations.view`                |                 Yes |     Yes |         No |         No |   No |     No |
| `support.requests.triage`                |                 Yes |     Yes |         No |         No |   No |     No |
| `support.user_lookup.view`               |                 Yes |      No |         No |         No |   No |     No |
| View masked support audit                |                 Yes |      No |         No |         No |   No |     No |
| Create non-executable access proposal    |                 Yes |      No |         No |         No |   No |     No |
| Close support request                    |                 Yes |      No |         No |         No |   No |     No |
| Execute access change                    | **Not implemented** |      No |         No |         No |   No |     No |
| Impersonate/export/bulk/financial action |                  No |      No |         No |         No |   No |     No |

MANAGER handles operational triage but cannot search the user directory or see support audit. ADMIN can investigate masked users and propose access changes. ACCOUNTANT investigates financial questions through Finance/Reports but receives no support-admin authority. OPERATIONS continues work through contracts/properties/maintenance, not a privileged support console.

## 4. Investigation workflow

### Support reference

- Search is local form state and never appears in the URL.
- A support reference returns at most 50 company-scoped requests.
- Returned fields: opaque ID for action binding, reference, category, urgency, status, generic route, app version, requester role, safe public note and timestamps.
- Not returned: expected/actual descriptions, requester ID/name/email, attachments, document text or record IDs.

### Masked user lookup

- ADMIN only, minimum three characters, maximum 100, maximum 20 results.
- Server searches active-company members, then returns masked name/email, application/company roles, status, active flag and last-login time.
- Email masking is `n***@d***`; name masking is first character plus `***`.
- Exact user ID is returned only to bind an access proposal; it is not displayed, logged or placed in a URL.
- No password, auth metadata, tokens, phone, company claims, grants, private profile or cross-company result.

### Health summary

Only safe counts are shown: open/high support cases, waiting-user cases, oldest-open time, DEAD/suppressed communication counts and reserved AI micro-USD. Counts are diagnostics, not permission to modify the underlying subsystem.

## 5. Support triage workflow

Allowed transitions:

```text
ACKNOWLEDGED -> IN_REVIEW -> WAITING_USER -> IN_REVIEW
IN_REVIEW -> RESOLVED
RESOLVED -> CLOSED (ADMIN only)
ACKNOWLEDGED/IN_REVIEW/WAITING_USER -> CLOSED (ADMIN only where transition permits)
```

Controls:

- active-company capability enforced server-side;
- row locked before transition;
- one request per action—no bulk operation;
- required internal reason, 10–500 characters;
- optional public note, maximum 500 characters;
- secret/email/phone/long-number screening inherited from the support privacy boundary;
- UUID idempotency key and unique event index;
- duplicate returns the original outcome;
- immutable `support_request_events` plus `admin_support_audit_events`;
- MANAGER cannot close; and
- user descriptions remain unavailable to the toolkit.

Partial failure is explicit: if the authoritative transaction fails, neither status nor either audit event commits. The UI keeps the dialog context and displays a safe error; retry uses a fresh key only when the first transaction is known to have failed. Network ambiguity should first refresh the queue and reuse the original logical action.

## 6. User access workflow

Direct authenticated `INSERT/UPDATE/DELETE` on `public.users` is revoked and the broad `users_admin_write` policy is removed. The existing user-role page is read-only.

The toolkit can create `admin_user_access_change_proposals` only:

1. server re-derives company, actor and target membership;
2. ADMIN-only capability;
3. proposed role constrained to the six canonical roles;
4. self-change prohibited;
5. last-active-ADMIN demotion/deactivation prohibited;
6. reason and idempotency required;
7. immutable audit event appended;
8. proposal expires after seven days; and
9. response states `executed=false`.

There is deliberately no approve/execute RPC in this change. `APPROVED_NOT_ENABLED` is reserved metadata, not executable authority.

## 7. High-impact execution requirements (not implemented)

If access-change execution is later approved, it must be a separate migration and UI release with all of:

- recent authentication proof (maximum 10 minutes) and explicit re-auth UI;
- distinct maker and checker ADMIN identities;
- preview of current/proposed role, effective capabilities and active state;
- owner-approved reason taxonomy plus free-text reason;
- last-admin and self-lockout checks under row/advisory locks;
- target/company membership re-derived server-side;
- proposal not expired and unchanged since preview;
- idempotent execution record;
- immutable before/after audit event;
- session/grant invalidation after change;
- rollback path as a new reviewed proposal, never audit deletion; and
- hosted two-company negative tests.

No emergency backdoor, service key in browser, hidden override or unrestricted impersonation is acceptable.

## 8. Financial, destructive and production boundaries

Support staff cannot from this toolkit:

- refund or record a payment;
- void a receipt;
- reverse a journal, accrual, settlement or deposit;
- change a contract/property/maintenance lifecycle;
- edit company configuration;
- delete, archive or restore business records;
- run SQL, migrations or data backfills;
- view/upload/download documents; or
- mutate production data in bulk.

These actions remain in their domain-specific maker-checker/RPC workflows. A support case may record the safe route/reference and escalate to Finance/Security/Product, but does not become authorization.

## 9. Audit and privacy requirements

`admin_support_audit_events` is append-only through a mutation-blocking trigger and revoked direct grants. Stored fields are company, actor, capability, action, target type/internal target ID, reason, outcome, idempotency key and timestamp.

The browser audit preview omits target ID and reason and masks actor. Routine logs must contain only request/correlation ID, capability, action, safe outcome and latency. Never log search terms, full users, support descriptions, public notes, target IDs, emails, JWTs or database errors.

Audit events are never editable or deletable through product RPCs. Retention/deletion requires an approved legal/privacy policy and migration; this specification does not invent one.

## 10. UX and accessibility states

The Arabic/RTL route follows the existing MALEK design system and provides:

- loading state that does not imply empty data;
- permission-denied state for server or route denial;
- empty support/user/audit states;
- masked data labels and explicit row limits;
- keyboard-operable dialogs and labelled fields;
- minimum touch targets through shared buttons/inputs;
- reason validation before confirmation;
- success/error announcements through existing toast/status patterns;
- clear “proposal only—non-executable” warning; and
- visible statement that impersonation, exports, bulk and financial actions are unavailable.

No sensitive value is hidden only with CSS; the server never returns it.

## 11. Provider/configuration and operational runbook

No external admin/support platform is connected. `/admin-support` reads the current MALEK database through narrow RPCs.

Daily:

1. review CRITICAL/HIGH support counts;
2. move one case at a time to IN_REVIEW with reason;
3. avoid requesting private content;
4. escalate security/data/payment cases through their documented incident paths; and
5. inspect DEAD communication count without retrying from this toolkit.

Weekly:

- review aging/waiting cases;
- review masked audit outcomes;
- expire stale access proposals automatically by time semantics; and
- investigate repeated routes/categories without exporting descriptions.

Incident:

- stop affected workflow;
- preserve immutable metadata;
- never impersonate or “fix” business rows;
- use canonical incident/correction procedures; and
- rerun company-isolation tests before re-enable.

## 12. Test contract

Automated tests prove:

- ADMIN/MANAGER/normal-user capability matrix;
- route and server denial for normal users;
- manager receives support metadata but no users/audit/descriptions;
- ADMIN-only masked user lookup;
- triage transition, required reason and one-time idempotency;
- manager close denial;
- immutable audit mutation rejection;
- access proposal is non-executable and leaves user unchanged;
- self-change and last-admin protections;
- direct authenticated user writes revoked by migration contract;
- no export, bulk or impersonation capability;
- mobile/desktop route integration, Arabic/RTL and dialog accessibility;
- migration replay, typecheck, build and hygiene checks.

Repository tests do not prove live migration deployment, support staffing, production Auth claims or hosted browser acceptance.

## 13. Recommended high-impact approval request

The only capability that may eventually be justified is controlled execution of an already-reviewed user access proposal. It is not enabled now.

**Yes or no: approve design and staging implementation of maker-checker user access-change execution with recent re-authentication, while keeping production execution disabled until hosted security acceptance?**
