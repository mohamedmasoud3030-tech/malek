# MALEK — Technical Health Report

> **Type:** Non-canonical engineering assessment. Canonical product/business/governance documents remain authoritative.  
> **Assessed branch:** `arena/01a0109a-malik` after PR #1489 work.  
> **Date:** 2026-08-17.

## Executive verdict

The repository has a strong security/data core: company-scoped RLS, RPC-owned sensitive writes, generated DB types, replayable migrations, idempotency/concurrency tests, append-only financial correction rules, private Storage and broad CI. The architecture should be incrementally hardened, not rewritten.

The highest confirmed repository risks found by this assessment were:

1. a current DOMPurify XSS advisory in a production dependency;
2. CI failures caused by test-type drift and selective migration replay compatibility;
3. AI provider calls without bounded timeouts and only per-worker rate limiting;
4. generic attachment upload validation existing only in one UI caller instead of the storage boundary;
5. production CSP permitting `unsafe-eval` without a demonstrated runtime need;
6. an oversized application entry chunk and unclassified retries of deterministic permission failures.

The security/reliability findings received safe repository remediations. A manual vendor split was tested and deliberately rejected because it violates the existing landing-performance contract and can pull optional application vendors into public startup. Live backup/restore, deployed Auth/RLS/Storage, monitoring and exact-SHA browser acceptance remain external and unverified.

## Assessment evidence

- Repository instructions, canonical pack, migrations, rollback policy and current Git/PR state inspected.
- Final integrated application tests: 456 files / 2933 tests PASS; financial suite 449/449 PASS; app and test TypeScript PASS.
- Financial suite: 449/449 PASS.
- Final DB0 after technical hardening: 281/281 migrations and 7/7 gates PASS, including idempotency, type drift, contract and isolation.
- Dependency audit before remediation: 1 moderate production vulnerability (`DOMPurify <=3.4.12`, GHSA-55q2-fjhq-7xh7).
- Dependency audit after remediation: 0 known vulnerabilities.
- Existing production application entry is ~641.7 kB minified (~190 kB gzip). A manual vendor split reduced the named app chunk but did not prove a lower total startup cost and failed the repository landing contract, so it was reverted. `DocumentRenderer` remains a lazy ~651 kB specialist chunk.
- PR #1489 checks inspected. Failed code check root cause was `typecheck:test`; failed DB checks were selective replay assumptions already reproduced and fixed locally. Browser jobs are external CI evidence, not replaced by unit tests.

## Health scorecard

| Area | Repository health | Runtime/live health | Evidence and risk |
|---|---:|---:|---|
| Build and type safety | 9/10 | 6/10 | app/test typechecks and production build; deployed runtime not inspected |
| Architecture/maintainability | 8/10 | n/a | coherent React/Vite/Supabase boundaries; several large workspaces remain |
| Authentication/session | 9/10 | 5/10 | expiry cleanup, recovery, JWT/RLS model; hosted redirect/email/Auth Hook proof pending |
| Authorization/company isolation | 9/10 | 5/10 | six roles, RLS/RPC negatives, DB0; deployed policies/claims pending |
| Financial/data correctness | 9/10 | 4/10 | GL/subledger/reversal/idempotency; real pilot/reconciliation pending |
| Migration safety | 9/10 | 5/10 | clean replay/idempotency/rollback guards; production ledger not verified |
| Storage/uploads | 9/10 | 5/10 | private bucket, MIME/size/path validation, signed URLs; hosted bucket policy pending |
| External integrations | 8/10 | 4/10 | AI fail-closed, distributed quota, timeouts; provider config/cost/availability pending |
| PWA/cache/privacy | 8/10 | 6/10 | runtime caches navigation shell/static assets only; installed-device update behavior needs browser proof |
| Dependency security | 10/10 | n/a | production audit clean after DOMPurify 3.4.13 floor |
| CSP/browser hardening | 8/10 | 5/10 | `unsafe-eval` removed; inline bootstrap/style still require `unsafe-inline` |
| Performance | 7/10 | 5/10 | route lazy loading exists; public startup and low-end real-device metrics remain open |
| Reliability/retries | 8/10 | 5/10 | deterministic 4xx/permission failures no longer retried; no centralized telemetry |
| Backups/recovery | 7/10 procedure | 2/10 live | local runbook exists; document explicitly says `PENDING_LIVE_EXECUTION` |
| Observability | 5/10 | 2/10 | structured local/Edge logs, no verified centralized alerting/SLOs |

## Confirmed issues and remediation

| ID | Severity | Proof/root cause | Decision | Result |
|---|---|---|---|---|
| TH-01 | HIGH supply chain | `pnpm audit` found DOMPurify 3.4.12 XSS advisory through jsPDF | raise root override to `>=3.4.13`, update lock | audit now reports no known vulnerabilities |
| TH-02 | HIGH release correctness | CI `typecheck:test` failed on optional DOM expression | narrow test guard with explicit null proof | test TypeScript passes |
| TH-03 | HIGH migration reliability | subset replays applied new migrations without every late dependency | optional dependency DDL/revokes use `to_regclass/to_regprocedure`; runtime authority stays fail-closed | selective replay and full DB0 pass |
| TH-04 | HIGH cost/abuse | AI quota Map was worker-local; any authenticated Auth user reached paid provider | DB atomic quota verifies active app user + company membership; Edge calls it with user JWT | cross-worker quota, inactive-user denial, focused DB tests |
| TH-05 | HIGH outage/cost | Auth/provider fetch had no application timeout; Edge runtime could wait until platform limit | 5s Auth/quota and 25s provider aborts; 30s browser abort | bounded failure with Arabic recovery message |
| TH-06 | HIGH upload defense | central upload helper trusted caller MIME/size and filename extension | validate empty/size/MIME centrally; derive canonical extension from MIME | bypass callers cannot upload unsupported/oversized/extension-confused files |
| TH-07 | MEDIUM browser security | CSP allowed `unsafe-eval` though production bundle does not require it | remove `unsafe-eval`; add `object-src`, `base-uri`, `form-action` restrictions | stronger XSS/exfiltration boundary; build remains green |
| TH-08 | MEDIUM performance | application entry ~641.7 kB minified (~190 kB gzip) | preserve route-driven splitting; reject manual vendor split after landing contract failure | no unsafe optimization shipped; real-device profiling remains |
| TH-09 | MEDIUM reliability | global QueryClient retried deterministic permission/404/JWT failures | classify non-retryable auth/client/abort errors; retain bounded transient retry | less duplicate load and clearer failures |
| TH-10 | MEDIUM CI visibility | PR failed before expensive suites due earlier code/type errors | reproduce exact failed steps locally, fix root causes, push new SHA | requires fresh GitHub check run after push |

## Frontend/runtime assessment

### Strengths

- Protected routes fail closed and session expiry clears stale storage.
- Forms use schema/server validation, error summaries and mobile stepper patterns.
- Query states generally distinguish loading/error/empty/stale data.
- Financial values are company-formatted and server/DB authoritative.
- PWA precaches static resources and uses NetworkFirst for navigation; no Supabase/API response runtime cache rule exists.
- Sensitive document links are signed and time-limited.

### Remaining risks

- CSP still needs `unsafe-inline` because `index.html` contains inline theme bootstrap, JSON-LD and critical CSS. A proper per-response nonce or generated hashes is a later deployment-aware change; a static public nonce would not be security.
- `DocumentRenderer` is a large lazy chunk. It does not block initial shell, but print/PDF on low-end phones needs runtime timing/memory evidence.
- AI context aggregation still reads full authorized row sets in the browser. Correct totals are favored over silent sampling, but a server summary RPC is the next performance evolution for large tenants.
- No verified real-user monitoring, error aggregation or alert routing is configured.

## Backend/database assessment

### Strengths

- 3dp OMR rules, balanced GL, append-only corrections, reversals and maker-checker controls are deeply tested.
- DB0 checks migration replay, idempotency, generated types, RLS isolation, function exposure and role representability.
- New contract evidence and AI quota tables are company-scoped and RPC-owned.
- Sensitive browser financial writes have regression guards.

### Remaining risks

- Live migration ledger/schema/Auth Hook/RLS drift remains unproven.
- `pg_cron` migrations intentionally tolerate unavailable managed extension; actual deployed scheduler/job health is not evidenced.
- Actual backup restore rehearsal is pending live execution, as stated in `evidence/wp07/backup-restore-rehearsal.md`.
- Legal registration profiles remain empty by default and must not be populated without authorized Oman legal review.

## Integrations

| Integration | Current boundary | Confirmed controls | Remaining external proof |
|---|---|---|---|
| Supabase Auth/DB/Storage | primary platform | JWT, RLS, private bucket, signed URL, generated types | exact hosted config and restore |
| AI provider | Supabase Edge Function | secret server-side, HTTPS URL validation, read-only prompt, active membership, distributed quota, timeouts | provider key/model/cost alerts and live latency |
| WhatsApp | preview/deep-link only | no silent send/provider charge | privacy/provider approval if automated later |
| Vercel | static SPA + security headers | env guard, CSP/frame/nosniff/referrer headers | exact production headers and rollback rehearsal |

## External blockers

- No production mutation or deployment was performed.
- No paid monitoring/AI/provider action was taken.
- Live backup/restore, Auth Hook, email recovery redirect, Storage and browser/AT acceptance need authorized environment access.
- Centralized observability would require selecting/configuring an account or provider; that is intentionally not fabricated.
