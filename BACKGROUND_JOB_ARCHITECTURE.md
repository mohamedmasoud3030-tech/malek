# MALEK Background Job Architecture

**Status:** durable repository foundation; Production schedules remain disabled  
**Date:** 2026-08-20  
**Canonical rules:** PRD-009, SEC-002, SEC-003, SEC-005, SEC-009, SEC-010, UX-008  
**Owners:** Platform Operations; each job type retains a named domain owner

## 1. Decision

Use the existing Supabase/PostgreSQL stack as a small durable queue. MALEK does not currently justify Redis, SQS, RabbitMQ, Kafka or a paid queue service. PostgreSQL provides transactional enqueueing, advisory locks, `FOR UPDATE SKIP LOCKED`, company isolation and the same migration/test evidence model as the application.

A narrowly authenticated Supabase Edge Function is the provider-neutral worker adapter. It accepts no client-selected job, company or payload. It dispatches due schedules, asks the database which companies have work, claims at most one job per company and processes at most three jobs per invocation.

No Production cron/schedule is installed or enabled by this change. The historical `rentrix-automation-hourly` cron is explicitly unscheduled and its entry point returns `BACKGROUND_SCHEDULE_ACTIVATION_REQUIRED`.

## 2. Complete job inventory and synchronous/background decisions

| Operation                                                                                                     | Current behavior / risk                                                                                                                | Decision                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Financial writes: invoice generation, collection/payment, receipt void, deposit, settlement, accrual/reversal | Authoritative atomic RPC result is required immediately; duplicate execution is financially dangerous                                  | **Synchronous only.** Keep transaction/idempotency/maker-checker in domain RPC. Never place free-form financial jobs in the queue.                                                        |
| Contract approval/activation/renewal/termination                                                              | User needs a definite lifecycle result and evidence snapshot                                                                           | **Synchronous only.** No delayed state transition.                                                                                                                                        |
| Property/party/maintenance CRUD and settings                                                                  | Short user-driven database operations                                                                                                  | **Synchronous only.** Normal request timeouts and visible result.                                                                                                                         |
| Bank CSV preview/import                                                                                       | Browser parses up to 5 MB; server import is all-or-nothing. No row cap existed, allowing a long request                                | Keep synchronous for atomic review/import, but cap at **5,000 rows** and require larger files to be split. Do not background financial ingestion without a new resumable review contract. |
| Reports and CSV exports                                                                                       | Current reports are interactive and CSV is browser-generated                                                                           | **Synchronous.** Add a background export only after measured size/latency proves it necessary; never pre-authorize an export job.                                                         |
| PDF/print/document rendering                                                                                  | Browser/offscreen rendering, user waits for artifact                                                                                   | **Synchronous browser work.** Existing in-flight dedupe/timeouts remain; no server file job or retained private payload.                                                                  |
| Upload/file validation                                                                                        | User needs immediate MIME/size/storage result                                                                                          | **Synchronous.** Virus scanning is not currently integrated; if later required it becomes a quarantined file job with separate approval.                                                  |
| AI Assistant                                                                                                  | Interactive, one bounded provider attempt, budget reservation and deterministic fallback                                               | **Synchronous.** No autonomous/background AI, retry loop or stored prompt job.                                                                                                            |
| In-app permission/support notifications                                                                       | Transactionally coupled to the source event or derived aggregate                                                                       | **Synchronous metadata event.** No external delivery.                                                                                                                                     |
| Email/WhatsApp/SMS/push                                                                                       | Preview-only; no live provider                                                                                                         | **No background delivery yet.** Communication outbox remains PREVIEW/SUPPRESSED. A future live adapter would enqueue only metadata after separate approval.                               |
| Webhooks                                                                                                      | No live inbound/outbound provider webhooks                                                                                             | **None.** Future callbacks need signature verification and provider-event idempotency before queueing.                                                                                    |
| Billing/provider sync                                                                                         | No subscription billing provider or external billing sync                                                                              | **None.** Property financial operations are not SaaS billing sync.                                                                                                                        |
| Automation rule evaluation                                                                                    | Historical browser RPC and hourly pg_cron executed loops synchronously, created row-level notification spam, and logged raw SQL errors | **Durable job.** Manual action enqueues; worker evaluates one company/rule and creates at most one aggregate in-app notification.                                                         |
| Scheduled reminders                                                                                           | Historical cron assumed `pg_cron` availability and enabled all rules without rollout evidence                                          | **Durable disabled schedules.** Prepared per-company schedules use fixed intervals and `Asia/Muscat`; activation is explicit and external.                                                |
| AI quota/budget cleanup                                                                                       | Opportunistic per-request rate-limit cleanup; budget metadata otherwise accumulates                                                    | **Daily background cleanup**, disabled until schedule approval; max 500 deletions per run.                                                                                                |
| Job/event retention cleanup                                                                                   | New queue metadata needs bounded retention                                                                                             | **Daily background cleanup**, disabled; SUCCEEDED/CANCELLED 30 days, DEAD 90 days, batch 500.                                                                                             |
| Support/admin operations                                                                                      | Interactive triage/proposal with required confirmation and audit                                                                       | **Synchronous.** No bulk support job or access-change execution.                                                                                                                          |
| Production migrations/backfills/historical correction                                                         | Governed, high-risk, environment-specific                                                                                              | **Never this queue.** Use authorized migration/correction runbooks and explicit approval.                                                                                                 |

## 3. Existing defects corrected

- Removed the active-cron assumption; migration no longer silently schedules work.
- Replaced synchronous manual automation execution with durable enqueueing.
- Revoked the old whole-run retry RPC and legacy internal executor from API/service roles.
- Replaced per-row automation notification loops with one generic aggregate notification per rule evaluation.
- Sanitized historical raw automation failure text to `LEGACY_AUTOMATION_FAILURE`.
- Revoked browser writes to legacy automation job/run/log evidence; ADMIN/MANAGER retain read-only visibility.
- Added a 5,000-row synchronous bank import ceiling.
- Added bounded queue/company/day limits, leases, dead-letter state, safe cancellation and retention.
- Added explicit ownership and status APIs instead of silent `NOTICE`/catch-and-continue behavior.

## 4. Data model and payload minimization

### `background_jobs`

Stores company, type, minimal JSON payload, status, priority, availability, attempts, lease, cancellation, progress, idempotency, safe source references, safe result counts, safe error code, zero estimated cost and timestamps.

Allowed types:

- `AUTOMATION_RULE_EVALUATION`: payload exactly `{ "rule_id": "..." }`;
- `CLEANUP_AI_METADATA`: payload exactly `{}`;
- `CLEANUP_JOB_RETENTION`: payload exactly `{}`.

Payload maximum is 2 KiB. Type-specific validation rejects unknown keys and strings containing password/secret/token/API key/authorization/email/phone/amount/document/content/message markers. Browser callers cannot enqueue generic cleanup or select an arbitrary payload.

### `background_job_events`

Append-only lifecycle metadata: job/company, event type, attempt, safe code, optional idempotent cancellation request key and timestamp. Product callers cannot update/delete it. Service-role retention may delete events only through parent job cleanup.

### `background_job_schedules`

Company, stable name, job type, minimal payload, interval minutes, fixed `Asia/Muscat` timezone, enabled flag and next run. Every seeded schedule is `enabled=false`.

No secrets, recipient addresses, prompts, file contents, SQL, report filters, financial amounts or document text are stored in jobs/events/schedules/logs.

## 5. Lifecycle

```text
QUEUED -> RUNNING -> SUCCEEDED
                  -> RETRY_WAIT -> RUNNING
                  -> DEAD
QUEUED/RETRY_WAIT -> CANCELLED
RUNNING -> cancellation_requested -> CANCELLED at next safe boundary
```

- Enqueue and source transaction may be one database transaction.
- Uniqueness is `(company, job_type, idempotency_key)` under an advisory lock.
- Claim uses `FOR UPDATE SKIP LOCKED`, priority then availability then creation order.
- Lease is five minutes; expired leases retry only below max attempts and otherwise become DEAD.
- Claim limit is 5; Edge worker limits actual processing to 3 jobs/invocation and one/company.
- Per-company active queue limit: 1,000.
- Automation enqueue limit: 100/company/day.
- Every current job has `estimated_cost_microusd=0`.

## 6. Execution, timeout and atomicity

`process_background_job_atomic` requires a valid worker/lease and sets a 45-second PostgreSQL statement timeout. Job side effects and the SUCCEEDED/RETRY/DEAD transition occur in one transaction. If the worker loses the response after commit, status is already terminal and the lease cannot execute it again.

Automation evaluation:

- verifies enabled rule and company;
- locks per company/rule;
- computes one aggregate count for contract expiry, overdue invoices or overdue maintenance;
- writes one generic in-app notification only when count > 0;
- records count, not record content;
- updates the existing automation run summary with safe text; and
- rejects unsupported rule types as permanent failure.

Financial/destructive actions are not valid job types, so duplicate financial effects cannot be produced by this worker.

## 7. Retry and failure policy

Transient unclassified execution failures retry at:

1. 60 seconds;
2. 5 minutes;
3. 30 minutes;
4. then DEAD.

Permanent SQL/auth/input/missing-contract classes (`22023`, `42501`, `42P01`, `42883`) go directly to DEAD. Stored error values are stable codes (`TRANSIENT_JOB_FAILURE`, `PERMANENT_JOB_FAILURE`, lease codes), never raw SQL/provider text.

DEAD is the dead-letter state. It is visible through safe metadata/status, retained for 90 days and never replayed automatically. Safe replay requires diagnosing the cause and enqueueing a new logical job with a new reviewed idempotency key; the old job/event history remains until retention.

## 8. Cancellation and partial failure recovery

ADMIN/MANAGER can request cancellation for a company job with a 10–300 character screened reason and idempotency UUID.

- QUEUED/RETRY_WAIT: transitions immediately to CANCELLED.
- RUNNING: sets `cancellation_requested`; processor checks before side effects. Current automation evaluation is one bounded SQL transaction and cannot be interrupted after its safe boundary starts.
- Terminal job: returns unchanged.
- Duplicate cancellation key returns the original event.

There is no “rollback job.” If a domain side effect could require reversal, it must use the domain's governed reversal workflow, not generic queue compensation.

## 9. Scheduling and time zones

Schedules use fixed intervals and record `Asia/Muscat`. Occurrence idempotency combines schedule ID and its local scheduled minute. Dispatcher advances `next_run_at` only after enqueue returns. Each due schedule runs in its own exception boundary: an invalid/poison schedule is disabled with `SCHEDULE_DISPATCH_FAILED` and cannot block other schedules in the batch.

Oman currently has no daylight-saving transition; storing the timezone still avoids server-local assumptions. Any future multi-jurisdiction schedule requires an approved timezone policy and DST tests.

No migration calls `cron.schedule`. The old `rentrix-automation-hourly` is unscheduled. A failed/absent `pg_cron` extension cannot silently appear as a running schedule.

## 10. Worker authentication and concurrency

`background-worker` Edge Function:

- POST only;
- requires a distinct 32+ character `BACKGROUND_WORKER_SECRET` using constant-time comparison;
- keeps `SUPABASE_SERVICE_ROLE_KEY` server-side;
- accepts no request body/job/company/payload selection;
- uses service-role-only dispatcher/list/claim/process RPCs;
- max 5 companies and 3 jobs/invocation;
- one claimed job/company per invocation;
- 50-second RPC timeout;
- parallel processing bounded to at most three; and
- logs invocation ID and counts only.

A client JWT cannot claim/process/list queue companies. Service keys, worker secret, payloads and errors never enter logs or browser bundles.

## 11. Progress and observability

User-safe status returns:

- type/status;
- attempt/max attempts;
- available time;
- progress current/total/code;
- safe last error code;
- cancellation requested;
- lifecycle timestamps; and
- estimated micro-USD.

It omits payload, worker ID, lease details, source ID, requester and event details.

Monitor:

- queue depth and oldest QUEUED/RETRY_WAIT age by company/type;
- RUNNING lease expiry;
- throughput/duration and p95;
- retry/DEAD rate and code;
- duplicate enqueue/cancel rate;
- schedule lag and dispatcher count;
- daily automation enqueue cap;
- cleanup deleted counts; and
- worker invocation claimed/completed/request-failure counts.

Alert when oldest ready job > 5 minutes, any lease expires repeatedly, DEAD > 0, queue depth approaches 1,000, schedule lag > 5 minutes, or preview-mode cost becomes non-zero.

## 12. Retention and cleanup

Disabled cleanup schedules are prepared per company:

- AI rate windows older than 1 day: delete max 500/run;
- AI budget reservation metadata older than 90 days: max 500/run;
- SUCCEEDED/CANCELLED jobs older than 30 days: max 500/run;
- DEAD jobs older than 90 days: max 500/run;
- job events cascade with retained job deletion.

No business, financial, audit, support, document or communication history is cleaned by these jobs.

## 13. Runbooks

### Queue stalled

1. Confirm worker function/config without revealing secrets.
2. Inspect safe depth/oldest age and lease codes.
3. Do not reset RUNNING rows manually; wait for lease recovery.
4. If worker is broken, leave schedules disabled or disable them through an authorized database change.
5. Patch and test with synthetic jobs before reactivation.

### DEAD job

1. Inspect job type/source and safe code—not payload dumps.
2. Verify the source still exists and action remains necessary.
3. Never replay financial/destructive work through this queue.
4. Fix root cause.
5. Enqueue a new reviewed job; never rewrite DEAD to QUEUED.

### Schedule issue

1. Disable the specific schedule.
2. Check `next_run_at`, timezone, interval and occurrence key.
3. Do not run all missed occurrences automatically; decide whether latest-only catch-up is safe.
4. Re-enable progressively for one pilot company.

### Worker-secret exposure

1. Disable scheduler invocation.
2. Rotate `BACKGROUND_WORKER_SECRET` and service-role key if implicated.
3. Review metadata events for unauthorized claims.
4. Do not log or paste either secret during investigation.

## 14. Test contract

Repository tests verify:

- normal users cannot enqueue or invoke worker RPCs;
- schedules are seeded disabled and no `cron.schedule` exists;
- historical cron entry point fails closed;
- minimal payload and zero cost;
- enqueue idempotency;
- one-worker claim under concurrency;
- atomic successful automation processing with one aggregate notification;
- bounded retry/backoff and DEAD after attempt three;
- queue/cancel idempotency and reason capture;
- event immutability;
- worker request cannot choose job/company/payload;
- secret/service key stays server-side and out of logs;
- 5,000-row synchronous bank import cap;
- migration replay, TypeScript, build, docs, hygiene and secret scans.

Repository evidence does not prove deployed worker secrets, Edge runtime duration, hosted `pg_cron`, schedule activation, production volume or alert delivery.

## 15. Exact recommended Production activation

After staging worker/runtime tests pass, activate **one pilot company's internal automation and metadata cleanup only**:

1. deploy migration and `background-worker` function;
2. configure `BACKGROUND_WORKER_SECRET` and existing Supabase service-role secret in the function environment;
3. invoke the worker manually with synthetic/seeded staging jobs;
4. enable only that pilot company's `AUTOMATION_RULE_EVALUATION`, `CLEANUP_AI_METADATA` and `CLEANUP_JOB_RETENTION` schedules;
5. configure one Supabase Cron/`pg_net` scheduler to POST to `background-worker` every minute, reading the worker secret from Supabase Vault rather than SQL text;
6. keep external communications, financial actions, imports/exports, AI and all other job types unavailable;
7. alert on DEAD/lease/lag thresholds; and
8. rollback by disabling the three schedule rows and scheduler invocation—never replaying Production failures.

**Yes or no: approve this one-company Production activation after staging evidence, with only internal automation and metadata cleanup and with all financial/external-delivery jobs prohibited?**
