# MALEK — Technical Remediation Plan

> Prioritized engineering plan. Status reflects repository evidence, not production deployment.

## P0 — Credentials, unauthorized access, data loss, money, outage

| Item | Status | Exit evidence |
|---|---|---|
| Repair PR CI typecheck/selective replay regressions | IMPLEMENTED / CI rerun pending | `typecheck:test` PASS; selective replay PASS; new SHA pushed and checks green |
| Patch production sanitizer advisory | VERIFIED LOCALLY | `pnpm audit --prod --audit-level moderate` reports no vulnerabilities; lock has 3.4.13 |
| Distributed AI abuse/cost control | VERIFIED LOCALLY | active company membership + atomic 10/min user/company quota; inactive denial; 2/2 behavioral tests |
| Bound AI external calls | VERIFIED LOCALLY | Auth/quota 5s, provider 25s, browser 30s; focused tests/build |
| Preserve financial write boundaries after evidence changes | VERIFIED LOCALLY | financial suite 449/449; sensitive-write and GL guards |
| Live backup/restore rehearsal | EXTERNAL BLOCKER | actual hosted backup restored to isolated target; row/schema/RLS fingerprints recorded |
| Exact deployed Auth/RLS/Storage verification | EXTERNAL BLOCKER | release SHA, Auth Hook, policies, bucket, signed URL positive/negative tests |

## P1 — Core correctness and regression protection

| Item | Status | Exit evidence |
|---|---|---|
| Central upload validation | VERIFIED LOCALLY | empty/oversized/unsupported rejected; MIME-derived extension tests |
| Query retry classification | VERIFIED LOCALLY | deterministic auth/client/abort not retried; transient 5xx/network/429 bounded |
| AI quota migration replay/idempotency/types | VERIFIED LOCALLY | DB0 7/7 and generated types after migration |
| Full integrated tests after hardening | VERIFIED LOCALLY | full app + financial + typecheck:test PASS |
| Fresh GitHub required checks | PENDING PUSH/RERUN | CI, isolated replay, release blockers, browser matrix green or exact external failure documented |

## P2 — PWA, performance and operations

| Item | Status | Exit evidence |
|---|---|---|
| Remove CSP `unsafe-eval` and harden object/base/form | VERIFIED LOCALLY | production build; config contract; hosted response header check pending |
| Public startup profiling | PENDING RUNTIME | manual vendor split rejected by landing contract; collect current-SHA coverage/network/CPU trace before changing chunk graph |
| Keep PWA caches free of API/tenant payloads | VERIFIED CONTRACT | config test; installed browser cache inspection pending |
| DocumentRenderer low-end measurement | PENDING RUNTIME | print/PDF on 375px low-memory device; peak memory/time recorded |
| AI browser aggregation scale | DEFERRED UNTIL MEASURED | if large tenant exceeds UX budget, add server summary RPC and parity tests |
| Scheduler health | EXTERNAL | deployed pg_cron jobs listed, last run/failed run alerts evidenced |
| Central error monitoring/SLO alerts | EXTERNAL / may be paid | owner-approved provider/account; scrubbed errors, alert routing, retention and cost cap |

## P3 — Technical debt

- Remove remaining `any` casts around legacy vault/entity label queries after live schema contract is frozen.
- Replace inline CSP bootstrap/style with generated hashes or per-response nonce only when hosting pipeline supports a real unpredictable nonce.
- Evaluate splitting `DocumentRenderer` internals if real-device profiling shows unacceptable latency; do not split by file size alone.
- Monitor `ai_assistant_rate_limits` cardinality; the quota RPC already prunes each user's windows older than one day, so no cron is required.
- Reconcile stale audit baselines/SHA text without granting stage credit.

## Verification matrix

| Check | Required final state |
|---|---|
| dependency audit | 0 known moderate/high/critical production vulnerabilities |
| app + test TypeScript | PASS |
| lint / architecture | PASS |
| production build | PASS with measured chunk report |
| full app tests | PASS |
| financial tests | PASS |
| DB0 | 7/7 PASS; all migrations replay and type-match |
| selective replay | PASS on historical harness subsets |
| migration/docs/business guards | PASS |
| browser desktop/tablet/mobile | PASS on current SHA, or external runner failure explicitly separated |
| live environment | not claimed until authorized QA evidence |

## Rollback

- Dependency/CSP/chunk/retry changes are configuration or pure code and can be reverted independently.
- AI quota migration has a manual rollback and stores only ephemeral counters, not business history.
- No production migration or deployment is performed by this assessment.
- Financial and legal evidence history remains append-oriented and is never purged for rollback convenience.

## Next action

Push the hardening commit, obtain a fresh PR #1489 check run, then investigate only failures reproduced on the new SHA. After repository CI is green, the next gate is authorized hosted backup/Auth/RLS/Storage/browser verification—not another architecture refactor.
