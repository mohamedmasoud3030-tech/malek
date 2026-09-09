# Live reconstruction execution inventory

Baseline: `fe2a5911076229206eb54cbcd7f3fc5303501360`. This is an execution ledger, not a replacement product specification. Canonical rules and stage credit remain in their existing documents.

## COMPLETED
- Session persistence/restore/logout and authoritative route workspace permissions (first extraction).
- Invoice gross/remaining read authority across collection, previews, contract/person/tenant/property/owner dossiers, reports, AI context and deposit allocation. VAT and posted credits are projected; credits reduce collectible debt but never inflate cash collections.
- Full/batched financial reads, invoice/dossier/contract snapshot loading, owner relationship reads, report pagination and integrity audit pagination share `lib/paginatedRead.ts`; intentional UI pages/latest-activity limits remain.
- Arrears hooks share one snapshot cache/query with selectors; period/collection summaries share one snapshot. Root invalidation and scope partition are behavior-tested.
- CSV output uses one RFC/formula-safe encoder; contracts/properties/expenses and office templates retain intended column order, localized content and download behavior.
- Office imports share field specifications, parser, preview and CSV/XLSX templates. Real calendar dates, status vocabulary, unsupported fields, source row numbers, and stale async preview prevention are covered. This remains preview-only.
- Build/runtime Supabase configuration validation is one pure policy. Recognizable non-public keys abort Vite compilation even locally; synthetic negative-build evidence confirms rejection. Invalid diagnostics no longer log any key prefix.
- Person/tenant dossiers and tenant registers share one party-scoped complete contract loader; legacy ACTIVE casing is handled by the existing status authority.
- Production PWA browser verification: worker activates, Arabic RTL offline fallback works, and observed caches contain no API/auth/storage responses.
- Runtime import/dependency graph inspected before dependency removal; no unproven dead business files deleted.

## IN PROGRESS
- Continuing financial authority review: VAT/credit report lineage, lifecycle eligibility, historic snapshot semantics, and least-authority RPC/table grants.
- Historical AR/deposit cutoff repair now passes repository SQL and desktop/mobile browser regressions. Continuing legacy-lineage compatibility and remaining report/tax authority review; hosted deployment is unverified.

## NEXT
- Inspect remaining report/snapshot authorities against actual credit, cash, deposit and reversal events; extend persisted lifecycle coverage.
- Authorized QA, when available: hosted Auth/RLS/schema/Storage/Edge parity (not a blocker for local work).
- Governed product/scale/device acceptance items listed in `RECONSTRUCTION_COVERAGE.md`; no invented bulk writes or historical rewrites.

## BLOCKED (external verification only)
- Hosted Auth/RLS/schema parity/Storage/Edge configuration and hosted financial journeys require an authorized QA environment. Local authenticated SQL replay and browser-to-SQL journeys are now running; they do not prove hosted GoTrue/JWT/PostgREST parity. No production writes. The expressly authorized GitHub checkpoint push is verified below.

## REMOVED
- Duplicated session restoration/cleanup and protected-layout permission map.
- Hook-owned invoice batching, duplicate report pagination loops, separate arrears/collection service reads and caches.
- Parallel office-import compatibility specifications/encoder and ad hoc CSV escaping in feature exporters.
- Duplicate build/runtime configuration validation, unused `framer-motion` and `@vercel/speed-insights`, duplicate dev `sonner` (runtime notifier retained).

## PRESERVED
- Routes/workflows, persisted keys, server-owned posting, historical schema/migrations/data, OMR3 policy, effective permissions, reversals/idempotency and company isolation. Confirmed defects are repaired only through explicit forward migrations.
- Standalone previous-period overdue read used by property documents; pure calculation helpers and support-only graph files still used by tests/scripts.
- Specialized database finance engines, approved baseline and document platform. Complexity with business/permission/historical meaning is not classified as obsolete.

## Evidence discipline
- Indexed files are not automatically reviewed or safe to delete.
- Record focused checks and broader regression results after each substantial change.
- No whole-application or hosted verification claim without corresponding evidence.

## Earlier checkpoint evidence (before the continuation below)
- Full application suite: **521 files / 3,617 tests passed**.
- Application typecheck, full test-source typecheck (1280 MB Node heap), repository TypeScript-based lint, architecture and register inventory: passed.
- Accessibility primitives: **15 passed**.
- Hermetic browser matrix: **43 passed / 1 intentionally skipped**; desktop/tablet/mobile dimensions, RTL/light/dark, real-route collection presets and report A4/PDF/share.
- Production PWA browser: **1 passed** (worker activation, Arabic RTL offline fallback, observed private-response cache exclusions).
- Production build with synthetic public config: passed. Synthetic non-public-key build: rejected as expected.
- Business rules, migration hygiene, GL-write boundary, enterprise freeze, document links and client key scan: passed.
- Source/patch/log/evidence bundle regenerated; patch checked against pristine baseline.
- No pushes, production mutations or live hosted acceptance claims.


## Continuation — 2026-09-09 (intermediate, not mission completion)
### COMPLETED
- Four explicit forward migrations: total/fail-closed role predicates; credit-aware deposit claim eligibility; receipt command fingerprint/context integrity; tenant statement settlement ledger and effective-permission boundary. No historical row updates, destructive migration or grant widening.
- Authenticated replay proves disabled/invalid identities fail closed, foreign-company reads/writes are denied, deposit applications respect credited debt, and deposit/refund/reversal journals reconcile with 2200.
- Tenant statement previously omitted credits and deposit settlements and exposed data to disabled identities. Actual red tests reproduced both; the current RPC emits distinct credit/application/reversal movements, preserves original movements, and uses stable running-balance ordering. Document labels describe debit/credit totals rather than calling all credits cash. Existing due-date presentation for invoices is preserved.
- Payment acknowledgements now require recorded status, correctly typed identifiers and matching request/invoice identities. The invoice controller uses the same payload-bound retry store as deposits, replacing its separate single-ID helper. Edited failed intents no longer trap subsequent payments on a conflicting request ID.
- Governed payments have nullable direct invoice links; receipt allocations carry the authoritative relationship. Actual persisted tests exposed missing contract payment history. Invoice detail and contract history now share one allocation-aware loader, preserving legacy direct links, allocated amounts, unique receipt counts and commercial references. Receipt context/reference reads share complete bounded loaders.
- `e2e/financial-persisted-journey.spec.ts`: actual UI deposit -> committed response loss -> same-ID retry -> reload; actual credit -> statement reload; actual UI cash collection -> corrected statement. All financial commands/read state in this journey use authenticated replayed SQL. Auth and unrelated modules remain hermetic fixtures.
### REMOVED
- Dead direct-deduction validation schemas; duplicated payment retry-ID helper; invoice/contract direct-link-only payment reads; duplicate receipt allocation/reference readers.
### VERIFIED CHECKPOINTS
- Frozen whole-application suite after payment/receipt relationship consolidation: **528 files / 3,654 tests PASS** (`/home/user/validation/continued/full-regression.log`). The subsequent filtered-report repair is covered by **90 financial files / 535 tests PASS**, including actual SQL-backed filtering. Do not mislabel the earlier whole-repo run as a rerun of that final small repair.
- Main/test TypeScript checks PASS after the filtered-report repair. Synthetic-public-config production build, architecture and frontend/database contract checks PASS after that repair. TypeScript-based lint, migration hygiene, business rules, GL boundary, documentation links and enterprise freeze passed at the preceding consolidated checkpoint.
- Browser matrix **43 PASS / 1 device-specific skip**; production PWA **1 PASS**; accessibility primitives **15 PASS**. Latest targeted browser rerun after filtered-report repair: persisted financial journey plus desktop/mobile collection presets **3 PASS**. `NODE_OPTIONS=--max-old-space-size=512` resolves the earlier worker SIGKILL. No financial assertions were skipped.
### LIMITS / NEXT
- Retry identity is mounted-memory only; reload BEFORE acknowledgement remains an uncertain-command recovery boundary. No financial payloads or credentials are stored in browser persistence.
- These independent reads are not an atomic reporting snapshot. Historical/live deployment parity, full historical-data compatibility and broader tax/as-of lifecycle cases remain separate verification work.
- Earlier source/patch/report archives are stale intermediate artifacts, not a completion claim. No push or production mutation.

### Additional persisted findings and repairs
- Property/tenant/contract-filtered cash reports also dropped real payments with a nullable `payments.invoice_id`. Fixed by selecting receipt/contract identities, sharing receipt-allocation resolution, and resolving contract scope without multiplying a multi-invoice receipt into several cash movements. Persisted regression + multi-invoice count tests pass.
- The suspected TRUNCATE exposure in the raw baseline was **not present after replay**: existing migration `20260901000001_restore_dump_acl_lock.sql` already removes it. Added actual rolled-back cross-company TRUNCATE denial and full public-table anon/authenticated privilege audit. No redundant ACL migration was introduced.

### Original reproduction — historical as-of drift (FIN-019; repaired below)
- Disposable SQL diagnostic at as-of **2026-09-08**, before new events: AR subledger/GL both **1000**, deposit subledger/GL both **0**.
- After recording a **123.456** payment and **500** deposit dated **2026-09-09**, querying the SAME earlier cutoff returned AR subledger **876.544** versus GL **1000**, and deposit subledger **500** versus GL **0**.
- `wp05_subledger_tenant_receivables` subtracts current paid/credit fields; `wp05_subledger_security_deposits` ignores its cutoff. This is a reproduced repository defect, not a hosted claim. Probe source/output are under `/home/user/validation/continued/asof-probe-source.txt` and `asof-diagnostic.log`; the diagnostic is not a passing correctness regression and is not left in the application test suite.
- Next repair must derive dated payment/credit/deposit/refund/reversal events, respect posting-period effective dates and immutable lineage, and explicitly handle incomplete historical lineage. Simply summing GL as the “subledger” would conceal reconciliation errors and is not acceptable.
- VAT return aggregation also needs deeper source/credit/fee/tax-recognition review; no statutory accounting policy or historical correction has been invented to force a quick green result.


## Post-push reconstruction — 2026-09-09
### PRESERVED / CHECKPOINT VERIFIED
- New branch `reconstruction/checkpoint-20260909` was pushed before reconstruction resumed. Local and remote SHA matched **`58b5da5fb3f8efca66ca0316c01034bfc0379f46`**. All 125 changed paths / 1,654 checked files were preserved exactly. No PR was created; credentials were not written to repository files, remote URLs or the credential store.
- Subsequent changes below are working-tree reconstruction after that checkpoint; they are not represented as already pushed.
### COMPLETED (repository evidence)
- Forward migration `20260909000004_historical_reconciliation_lineage.sql` reconstructs AR and deposit cutoffs from independent operational amounts and source journal **header dates**, retaining fully settled invoices/refunded deposits. Source allocations, credits, claims, refund/reversal transactions and original source balances remain intact; GL line amounts are not copied into subledgers. Existing stable-invoker signatures/grants/RLS are retained, with a migration precondition against authority drift.
- The original **1000 / 0** earlier-cutoff regression now stays **1000 / 0** after later **123.456 / 500** receipts. Actual SQL lifecycle tests cover cash, credits, approved applications, refunds, compensating reversals, maker/checker receipt VOID with retained allocations, full settlement, company isolation, and an independent GL-only variance that correctly remains FAIL.
- Unknown settlement dates/counter gaps fail explicitly, including future cutoffs: current counters can include future-dated events, so there is no unsafe `current_date` exemption. This is a read-model safeguard, not a historical correction/backfill. Removed invoice history remains a guarded review boundary.
- Closed-period regression confirms payment in a new open period leaves the old-period receivable intact. Reversal accounting follows the booked effective date, including original-date restatement; no alternative reversal dating policy was invented.
- Reconciliation response validation accepts actual numeric/decimal-string contracts and rejects malformed monetary evidence instead of converting it into zero/PASS. Valid empty results remain NO_EVIDENCE in the existing output gate.
- Posted commands now invalidate the actual `reports-authority` readiness/cash-flow query namespace. A red cache regression reproduced the missed invalidation before the root was added.
- SQL-backed browser journey now displays real reconciliation and trial-balance reads, checks earlier/current cutoff balances, and repeats after reload on desktop and mobile. Auth and unrelated modules remain mocked; this is not hosted proof.
### REMOVED
- Unreferenced duplicate reconciliation implementation/date helper in `statements/accountingReportsService.ts` and its unused raw row type. All consumers retain the one accounting facade/service implementation; no parallel replacement tree or compatibility copy was added.
### VALIDATION
- Whole application: **530 files / 3,679 tests PASS** (`/home/user/validation/historical/full-regression.log`). Main and test-source TypeScript checks PASS.
- Focused SQL/read-model/cache checks: **3 files / 24 tests PASS**; prior expanded deposit/credit lifecycle set **3 files / 29 tests PASS** and period/statement set **3 files / 17 tests PASS**.
- Extended persisted browser journey: **desktop PASS, mobile PASS**. A mobile test selector initially assumed a desktop table; it now verifies both monetary fields on the actual responsive cards, without bypassing assertions.
### IN PROGRESS / NEXT
- Run migration/architecture/contract/build gates for the new forward migration and read boundary; continue VAT/credit/fee source and authorization review, then remaining high-impact persisted workflows.
### BLOCKED / DEPLOYMENT LIMITS
- No authorized hosted runtime is available for migration parity, real JWT/PostgREST/RLS and deployment-data compatibility checks. These remain external verification only, not blockers to other repository work.
- Deployment must inspect incomplete historical lineage and removed invoice cases. No automatic dates, backfill, retrospective journal edits, or statutory tax policy changes are supplied. Existing S08/S09 accounting-approval controls remain required for historical correction. If the new read contract fails on legacy data, surface the error and review it; do not restore a false historical PASS as a fallback.
- Broad reconstruction is not complete; no governed stage credit is advanced.

## Continued reconstruction — tax authority, fee lifecycle and candidate guards
### COMPLETED (repository evidence, not hosted acceptance)
- Migration `20260909000005_tax_posting_read_authority.sql` gives existing VAT reads one private immutable-source authority. OFFICE invoices/credits, OWNER collection allocations, RATE fee snapshots and FIXED daily accrual/reversal events retain their saved tax treatment and booked dates. Independent 2100 checks reject unclassified or mismatched GL postings; there is no source-total copying from GL, historical rewrite, tax-policy invention or public parallel VAT API.
- Persisted tests cover configured VAT / VAT_ZERO / NON_TAXABLE treatment, collection without double counting, governed receipt VOID, credit/reversal cutoff, cross-company and disabled-identity rejection, private ACLs and GL-only discrepancy errors. Missing/failed VAT evidence no longer appears as a zero KPI.
- Migration `20260909000006_fixed_fee_tax_history_metadata.sql` repairs reproduced false fixed-fee API metadata. One private invoker helper classifies company/date/version-scoped immutable history: `NO_ACCRUALS` for no evidence, `VERSIONED_FEE_TREATMENT` for fully versioned history, existing review status otherwise. Existing orchestrator/list definitions are replaced only after a precise metadata precondition; posting logic, existing ACLs and historical rows are preserved.
- Fixed-fee UI now warns about historical tax-review needs only for nonempty, not-fully-versioned history. It does not universally claim that tax was not calculated. Execution and reversal invalidate shared financial reads even when acknowledgements are lost.
- SQL-backed desktop/mobile fee journeys prove committed-but-lost acknowledgement, retry without duplicate accruals, reload, compensating reversal, retained source history and restored VAT totals. Mobile testing reproduced an unreachable action tray: `height:100%` on the card pushed sibling actions outside paint containment. Shared flex sizing keeps the card and action tray inside their row; fee status is explicitly visible on mobile cards. No forced click or alternative desktop-only test path was used.
- A further service-boundary regression reproduced **12 failures**: null/empty/failed list, execute and reverse responses were accepted as zero totals or success. Strict response schemas now reject missing or malformed financial evidence and acknowledgements, while accepting PostgreSQL decimal transport and legitimate nullable zero-amount posting metadata. A real governed zero-fee execution/reversal verifies that validation does not fabricate or forbid legitimate zero evidence. Contract precision is preserved separately from posted OMR precision.
- GL-write and migration guards previously missed uncommitted candidate files. Shared NUL-safe discovery now inspects merge-base to actual worktree plus untracked files, including staged changes and rename/type cases. Guard red regressions became GL **13 PASS** and migration **11 PASS**; actual working-candidate gates pass.
### REMOVED
- Dead fixture-only cash-flow normalizer/type/facade exports and obsolete assertions, after route/reference/consumer checks. Canonical GL cash flow remains the sole production authority, with architecture and behavior regressions retained.
- Permissive fixed-fee response coercion that converted absent/malformed financial evidence into zero or successful reversal identifiers. The existing RPC boundary remains; no duplicate service tree was added.
### PRESERVED
- Checkpoint branch and verified remote SHA above; subsequent changes remain uncommitted working-tree reconstruction. No PR, production mutation, credential persistence, ledger backfill, receipt allocation deletion or historical tax recomputation.
### VALIDATION
- Before the final strict fee-boundary change: **534 files / 3,721 tests PASS**, both TypeScript projects PASS, production build/PWA generation PASS, all six repository gates PASS; GL guard checked **78** production files. Logs: `/home/user/validation/tax/{full-regression-final-green,types-final,test-types-final,build-final,gates-final}.log`.
- Browser matrix after shared card repair: **44 PASS / 1 intentional device skip**. Initial run used deliberately invalid placeholder configuration and correctly disabled login; rerunning with public-format synthetic test configuration passed without weakening the configuration guard. This remains mocked auth, not hosted login acceptance.
- Persisted financial/fee browser journeys: **4 PASS** across desktop/mobile. After strict fee parsing: fee journey **2 PASS** again. Strict service suite **26 PASS**, including the real zero-amount SQL lifecycle. Logs: `browser-matrix-configured.log`, `browser-fees.log`, `browser-fee-contract.log`, `fee-zero-contract.log` in the same validation directory.
- Final replay after strict fee parsing: **534 files / 3,743 tests PASS** (492.73s), main/test TypeScript PASS, production build/PWA generation PASS, all six gates PASS; GL boundary checked **79** production files. Both guard regression files pass again. Evidence: `/home/user/validation/tax/{full-regression-latest,types-latest,test-types-latest,build-latest,gates-latest,guard-regression-latest}.log`.
### IN PROGRESS / NEXT
- Trace remaining owner/vendor payable and due-from-owner historical balances and settlement workflows through the same independent-source/cutoff tests. Continue cross-company authorization, async state/scope and architecture/dependency cleanup; none is declared exhausted by the current green slice.
### BLOCKED / UNKNOWN
- Hosted JWT/PostgREST/RLS parity, real deployment data compatibility and production PWA acceptance remain externally unverified. Source-gap deployment review and governed accounting approvals are still required; repository replay does not authorize historical repair.
- Fixed-fee manual-load date/session races have not yet been reproduced or cleared. Remaining historical control-account families beyond the repaired tenant AR/deposit and VAT paths are not claimed comprehensively audited.
- Reconstruction remains in progress; no stage-credit change or mission-completion claim.

## Continued reconstruction — owner receivables (1300)
### COMPLETED / REPRODUCED AND REPAIRED
- The next real SQL probe found source **0** versus control **125.555** at the earlier cutoff and **100.555** after a **25** recovery. The operational receivable retained the correct amount/outstanding, but the report helper read only legacy expenses. Separate probes reproduced a second recovery failing `GL_EVENT_CONFLICT` and original reversal failing `due_from_owners_outstanding_chk`.
- Forward migration `20260909000007_owner_receivable_history_and_recovery.sql` adds one private invoker history projection to the existing 1300 helper. Governed receivables, recoveries, offsets and compensating reversals use saved source amounts and linked booked header dates. Missing/duplicated posting links, orphan events and counter gaps fail explicitly. No GL line totals are copied into the source balance.
- Existing legacy expense evidence remains visible; it is not dropped merely to obtain agreement. Legacy classification/history is still a separate review track, not declared repaired by this addition.
- Recovery events now use request-specific event identity after the existing company-scoped fingerprint/cache check. Separate partial recoveries work; the same request remains idempotent and changed content remains rejected. Existing posted `recover` events are not renamed or rewritten.
- The original outstanding constraint is retained verbatim with one additional branch for a compensating reversal's zero outstanding. Original amount and settlement components remain historical facts. No financial rows are backfilled or deleted; original function attributes/ACLs are retained through constrained replacements.
### VALIDATION
- Initial governed lifecycle regressions: **4 FAIL / 1 PASS**. Expanded focused suite: **8 PASS**, including earlier/current cutoffs, separate/retried recoveries, recovery/original reversal, company isolation, independent GL discrepancy, missing-link/counter rejection, and an actual pre-07 migration upgrade over already booked recoveries. Upgrade checks preserve original batch IDs/event IDs/dates and old request responses, then allow a new recovery.
- AR/deposit and VAT suites remained green alongside the initial owner repair (**22 PASS** before the final owner-suite expansion). Evidence: `/home/user/validation/owner-receivable/{source-probe,red,green,green-expanded,upgrade-green}.log`.
- Broad replay after migration 07: **535 files / 3,751 tests PASS** (533.62s); main/test types and all six gates PASS; GL guard checked **80** production files. Persisted financial/fee desktop/mobile browser regression **4 PASS** again. Build/PWA generation PASS on a 1024 MB heap retry after a 1280 MB run hit the sandbox total-memory limit (137); no source/build checks were disabled. Evidence: `/home/user/validation/owner-receivable/{full-regression,types,test-types,gates,browser-regression,build-retry}.log`. After final migration-boundary precondition tightening: **8 owner lifecycle/upgrade tests PASS**, migration-hygiene and GL-write gates PASS (`precondition-green.log`, `migration-final.log`, `gl-final.log`).
### IN PROGRESS / NEXT / UNKNOWN
- Inspect remaining owner/vendor payables, lawful-offset command lifecycles, legacy expense classification, and older public reconciliation entry points. The new projection's offset mapping is not a claim that all offset command flows have been verified.
- Browser owner-receivable command UI coverage is not established; current proof uses governed SQL commands and the actual report authority. Existing financial UI/browser coverage must not be mislabeled as a new owner-receivable UI journey.
- Hosted migration/data parity and production authorization remain unverified. No PR or additional push is implied; this is ongoing work after the preserved checkpoint.

## Continuous remote checkpointing resumed
- Mandatory preservation completed before further edits: all 41 prior changed paths committed/pushed to `reconstruction/checkpoint-20260909`; local/remote exactly **d399a0e1e7ed409eb5ac76e55b30e3634f84caaf**, clean at verification. No PR or credential persistence. Each further meaningful milestone must be committed, pushed and remotely verified before another major repair.
- Compact operational handoff saved outside the repository at `/home/user/RECONSTRUCTION_SESSION.md`. Existing source, canonical decisions, inventory and evidence retained. No transcript-compaction API exists; no claim that the live transcript was truncated.
### COMPLETED — lawful-offset identity and scope (FIN-007/008/013/016/019; SEC-001/002; GAP-008)
- Reproduced three failures: separate offsets shared `event_id=offset`, and a receivable could derive offset permission from another owner's or property's agreement. Migration 08 preserves existing functions/ACLs/caches while adding request-specific offset event identity and enforcing named agreement owner/property scope. No old event, amount or legal-evidence row is rewritten.
- Governed collection -> maker/checker-approved settlement -> scoped receivable fixture uses authenticated SQL and actual immutable agreement creation. Tests cover separate/equal/retried offsets, earlier/later 1300/2000 reconciliation, reversal, insufficient right/payable/outstanding, foreign company, disabled identity and withdrawn settlement authority.
- A pre-08 upgrade over an already posted offset preserves batch/event IDs/dates and its retry response, rejects changed financial content under the old key, and permits the next legitimate offset.
- Hosted QA preflight was attempted and stopped before network access because required QA configuration is absent. GitHub push authorization is not hosted Supabase authorization. No runtime parity claim is made.
### NEXT / PRESERVED
- Older reconciliation entry points and legacy expense classification remain active debt. Owner-receivable/offset command UI coverage is still not established; these checks are real SQL/API authority proof, not a browser command journey. Governed stage status unchanged.
- Offset milestone validation: **4 files / 33 tests PASS** (offset10, owner-receivable8, existing collection/expense/settlement6, VAT9), test-source TypeScript PASS, migration hygiene and GL-write gates PASS. Evidence: `/home/user/validation/offset/{red,expanded,milestone,types,gates,hosted-preflight}.log`. Whole-app535/3751 and prior browser results predate migration08; they are not relabeled as a new offset UI proof.

## Reconciliation entry-point consolidation (FIN-013/016/019; SEC-001/002/009; GAP-013)
### CHECKPOINT / COMPLETED / REMOVED
- Offset milestone remotely verified at **ab4200a95a81ea09df13e544945dcb24a9d97896** before this work began; no large uncommitted carryover.
- Reproduced stale historical balances and reversed-GL omission in the older `gl_reconcile_subledgers` public contract. Also reproduced disabled/stale-membership reads and authorized accountant failure at underlying RLS boundaries. Initial tests: **8 FAIL / 1 PASS** (the comparison fixture was subsequently corrected to include the legacy account-name field as well as financial values).
- Migration09 retains both public signatures but replaces the legacy calculation with a five-row compatibility shape adapter. WP05 calculation lives once in a private core, behind the same existing financial-report permission gate as the other financial reports. The public wrapper validates company context before privileged reads; no direct authenticated private-core execution is allowed.
- Removed the older endpoint's independent table scans, current-counter cutoff logic, and POSTED-only GL calculation. Preserved its account names, five-account set, order, mismatch direction and details shape. No posted rows or source metadata changed.
### VALIDATION
- Expanded entry-boundary suite: **12 PASS**, including authorized ACCOUNTANT/VIEWER, denied OPERATIONS/disabled/stale membership, foreign-company denial, private-core ACLs, three cutoffs and compensating-reversal parity.
- Whole application **537 files / 3,773 tests PASS** (535.13s); main/test TypeScript, build/PWA generation, all six repository gates and frontend DB-contract gate PASS. Persisted financial/fee browser regression **4 PASS** across desktop/mobile. Evidence: `/home/user/validation/report-entry/{red,expanded,full,types,test-types,build,gates,browser}.log`.
### NEXT / BLOCKED
- Continue legacy expense classification and remaining financial/source and architecture cleanup after remote checkpoint. Hosted auth/data parity still blocked by missing authorized QA runtime configuration. Repository/brokered browser evidence is not hosted JWT/PostgREST acceptance. No stage credit or mission completion claimed.

## Expense evidence, command identity and read boundaries
### CHECKPOINT / COMPLETED / REMOVED
- Reconciliation milestone pushed and exactly verified at **352f1edea48b5d1ea104c2a066f4444f29d47cfc** before these edits.
- Expense list failures now propagate into the existing query/register error boundary instead of returning a successful empty list. The duplicated page-level expense error panel is removed; the register owns retry. Summary metrics and CSV actions cannot present failed/loading evidence as valid figures, including the imperative export handler and mobile overflow sheet.
- Create/update acknowledgements must contain the existing successful protocol fields and match the command identity (and expense identity for updates). Missing/negative/unrelated responses cannot close the workflow as success. Removed the RPC type-erasure casts and blank-ID success defaults.
- Creation reuses the existing `RetryableCommandStore` authority: an uncertain response keeps its request identity; confirmed success ends that intent. Removed the workspace's per-click UUID that turned an uncertain retry into a new expense. No browser persistence of financial data or credentials added.
- Both mutations invalidate the expense register and the shared financial read models after success **or uncertainty**, rather than refreshing only the older financial-report namespace after success.
### VALIDATION
- Read-boundary RED: **1 FAIL / 2 PASS** before repair. Focused expense/identity suite: **7 files / 29 tests PASS**. Real QueryClient tests verify read-model invalidation and retained/new intent identity; service tests reject malformed and unrelated acknowledgements.
- Whole application **537 files / 3,781 tests PASS** (559.00s); main/test TypeScript, build/PWA, six repository gates and frontend DB-contract gate PASS. Evidence: `/home/user/validation/expenses/{read-red,focused,full,types,test-types,build}.log`.
- Brokered desktop/mobile expense browser journeys execute real authenticated SQL creation, lose the first acknowledgement after commit, retry with the same key, and verify exactly one persisted expense. A 503 read hides financial summaries and disables export; retry restores both. Desktop and mobile overflow actions are exercised. Existing persisted financial/fee journeys also pass. The combined run had **5 PASS / 1 worker SIGKILL before assertions**; the affected desktop scenario passed alone on rerun. Earlier desktop/mobile expense run was **2 PASS**. This is six successfully exercised scenarios, not an uninterrupted six-pass run or hosted auth proof.
- Browser harness corrections are explicit: the initial 20s assertion underestimated existing SDK-plus-query retry delays for 503; it now waits up to 40s without changing runtime retries. Mobile export is reached through its real overflow sheet, not a hidden desktop button. Evidence: `browser-green.log`, `browser-final.log`, `browser-desktop-rerun.log` in the same evidence directory.
### IN PROGRESS / NEXT / PRESERVED
- A persisted classification probe creates OWNER30 and COMPANY20: account6100 debit **50**, account1300 GL **0**, independent owner-receivable source **30**, reconciliation **FAIL**. This confirms the inspected FIN-007 defect; it is **not repaired by the client milestone**. Probe: `/home/user/validation/expenses/classification-probe.ts` and `.log`.
- Do not change just the debit account. Legacy owner statements/settlement reservation currently deduct OWNER expense automatically; posting to1300 alone would strand payable/receivable balances after net payout. Repair must link explicit owner/agreement/contract scope, lawful offset/recovery, payout, adjustments/reversals and historical evidence without inventing rights or reallocating old money.
- Inspected (not yet persisted-probed): expense updates treat only amount/date as financial changes; responsibility/property/contract changes can alter meaning without accounting compensation. Owner-property selectors can attribute the entire expense to multiple owners. The expense form currently has no owner/agreement selection and does not submit its API's optional contract link.
- Remaining read architecture debt: SDK read retries multiply the query retry policy; generic pagination wraps non-Error backend failures and can lose retry-classification metadata. These observations are not silently marked fixed.
- Hosted auth/deployment-data parity remains blocked by absent authorized QA configuration only. Owner-receivable/offset command UI remains unproven. No SQL history, settlement rule, RLS policy, public financial signature or stage status changed in this client milestone.

## Paginated read evidence and retry ownership (FIN-019; SEC-002; GAP-013)
### CHECKPOINT / COMPLETED / REMOVED
- Expense milestone remotely verified **b45a793301db0b8ba26fcc75b2ad7bb03a0c9230**, clean, before this repair. Snapshot-lost remote metadata/executable bits and local tooling were restored without source changes; authorization used transiently, never persisted.
- Reproduced **5 FAIL / 9 PASS**: pagination discarded SQLSTATE/auth metadata, did not disable nested SDK retries, and accepted missing row payloads as known-empty results.
- The shared pagination authority now preserves the original backend error, rejects absent/non-array row payloads, and disables native per-page SDK retries where that capability exists. The existing caller/query policy owns complete-read retries. Non-network SQL/test adapters remain compatible; real empty arrays and explicit truncation retain their contracts. No parallel error classifier or retry algorithm added.
- Verified the pinned SDK's actual `retry(false)` implementation. Real SDK + real QueryClient protocol tests prove one request for42501 and three total requests for503. Browser expense tests assert exactly three failed HTTP reads, retain error/CSV/recovery assertions, and reduce the error-state wait from40s to20s without replacing runtime policy.
### VALIDATION / PRESERVED
- Focused shared-reader/query-policy/expense-list suite **25 PASS**. Whole application **537 files / 3,788 tests PASS** (520.96s); main/test TypeScript PASS. Evidence: `/home/user/validation/pagination/{red,focused,full,types,test-types}.log`.
- Final combined persisted browser regression **6 PASS**, desktop/mobile (2.7min), including expense lost-response retry, failed-read recovery, deposit/credit/cash reconciliation and fee reversal. Browser binaries/system dependencies were absent after snapshot and restored. A preceding mobile initialization timeout passed unchanged alone, then the entire six-scenario run passed; its intermittent initialization cause remains unproven rather than being labeled a product fix. Evidence: `browser-restored.log`, `browser-mobile-rerun.log`, `browser-confirmation.log`.
- Build/PWA, six repository gates and frontend DB-contract gate validation recorded in `build.log` and `gates.log` alongside the above evidence.
- This removes retry multiplication for the **shared paginated** path, not every unpaged SDK call. Caller policies/authorization checks, financial source rules, historical data and SDK version remain unchanged. No new migration, stage credit or hosted parity claim.
### IN PROGRESS / NEXT / BLOCKED
- Expense FIN-007 classification and its coupled owner allocation/settlement/lawful offset/history remain open as recorded above. Continue coherent lifecycle repair and remaining unpaged read/API/UI boundaries. Hosted configuration still blocks only hosted verification; no production changes authorized or attempted.

## Historical expense diagnostic source lineage (FIN-007/013/019; SEC-001/002; GAP-013)
### COMPLETED / PRESERVED
- Started from verified `4f88dced9077e61761587ba1090b87f24f067baa`, without redoing prior repairs. The existing S08 diagnostic missed actual OWNER expenses because it read category rather than responsibility; it rounded OMR evidence to2dp and mislabeled company-wide results with the requested period.
- Migration10 replaces that existing public implementation. It reads explicit responsibility (legacy category fallback only when responsibility is absent), exact source amounts, linked expense/adjustment/S09/reversal postings, and company-scoped economic periods. Multiple historical owners produce one unresolved-allocation finding, not a fabricated split or full assignment to every owner. Archived posted sources remain reviewable. Legacy adjustment metadata is explicitly not certified as an immutable allocation snapshot.
- The existing financial-report permission authority and company/period validation guard the privileged read. ACCOUNTANT/VIEWER receive complete evidence; disabled identities, OPERATIONS and foreign company/period requests reject. Existing public signature and grants retained. No balance, posting, source transaction, legal right or historical row is rewritten by the migration.
- Test-only identifier validation now permits digits after the first character, allowing the real S08/S09 RPC names while retaining an SQL-identifier-only boundary.
### VALIDATION
- Corrected RED **8 FAIL / 1 PASS**. The first run also exposed two fixture errors (missing prior accounting period and default-primary second owner); these were corrected before the recorded product RED, not bypassed. Focused diagnostic suite **12 PASS**; adjacent owner history/offset/reconciliation **42 PASS** total.
- A disposable, explicitly scoped S08 review with a separate accountant reviewer and existing S09 compensation changes source/control1300 from **30.125/0 FAIL** to **30.125/30.125 PASS**. Original batch evidence remains unchanged; reversing the compensation restores the diagnostic. This is test evidence of the existing controlled path for a first-day expense, **not production correction approval or proof of all correction dates/allocations**.
- Full application **538 files / 3,800 tests PASS** (594.40s). Main/test TypeScript, build/PWA, six repository gates and frontend DB-contract gate PASS. Logs: `/home/user/validation/expense-history/{red-corrected,compensation,focused,full,types,test-types,build}.log`.
- Built-app desktop/mobile upgrade journeys **2 PASS**: pre10 governed OWNER expense and retry survive migration unchanged, SQL diagnostic identifies it, and actual reconciliation UI shows source30.125/control0 with the review warning. Diagnostic itself has no newly claimed command UI. Combined eight-scenario browser run **7 PASS / 1 pre-existing desktop reload initialization timeout**; the affected existing spec passed unchanged on rerun (**2 PASS**). Do not report an uninterrupted eight-pass run. Logs: `browser-green.log`, `browser-regression.log`, `browser-prior-rerun.log`.
- Development-server/browser attempts hit worker SIGKILL while esbuild retained substantial memory. Verification used the production build with a lightweight preview server instead. One new harness assertion incorrectly expected a PASS-only disclosure on a FAIL panel; removed that click because failed evidence is already expanded. Assertions of the warning and monetary values remain.
### IN PROGRESS / NEXT / BLOCKED
- OWNER expense creation still posts6100; legacy expense deductions, explicit beneficiary/allocation, receivable recovery/offset and payout remain coupled unfinished work. This diagnostic does not close FIN-007/008 or confer stage credit. Historical fixes require the governed, source-scoped path; never deploy blanket reclassification or invent legal rights.
- Newly traced write-path concerns for the next checkpoint: S09 apply chooses accounting-period start instead of the expense's economic date; S08 fingerprints aggregate expense count/sum but omit responsibility/property/contract/allocation metadata; S09 apply does not recheck that full source snapshot. These are inspected code findings, not yet persisted RED cases or repaired controls.
- Legacy journal bridge uses source_type `expense` and hash-based `legacy-auto` event identity; repeated expense updates at one date can target the same compatibility event group. Further posting-history/compensation proof required before replacing that authority.
- Hosted QA configuration remains absent. Browser auth and ancillary modules are hermetic; migrated SQL, expense writes, correction test and financial report reads are real persisted local execution. No hosted or production mutation performed. No final application audit/completion claim.

## Reviewed expense correction source controls (FIN-007/013/016/019; SEC-001/002)
### CHECKPOINT / COMPLETED
- Historical diagnostic milestone committed/pushed and exactly verified at **95371dc3de3d1ee5b2fc7905100788d165a7aeb0** before this repair.
- Persisted RED **6 FAIL / 1 PASS** demonstrated premature period-start correction posting, undetected responsibility/ownership drift at approval, stale approved-source drafting/apply, and borrowing a review without the expense being frozen in its scope.
- Migration11 extends the existing S08/S09 authorities, not a parallel correction pipeline. Explicitly named expenses get server-generated snapshots of financial metadata, effective ownership links, linked contract/version identity and source/correction/reversal posting fingerprints. One private snapshot implementation and one comparison helper are reused at approval, draft, validation and apply.
- A nullable provenance column distinguishes new server snapshots from old caller JSON; old rows remain NULL and are never backfilled/reapproved. New review payloads cannot forge the reserved snapshot map. Review scope, source provenance version and creator are immutable. Expense-bearing reviews require an independent accountant/admin reviewer.
- Expense correction posting takes its economic date from the frozen reviewed expense, not period start. Existing central posting-period controls remain. Source/parent/ownership/contract locks plus a per-expense advisory lock protect the checked source through the operation; concurrent multi-session stress is not claimed by the single-session replay.
- Existing posted corrections, old draft retry responses, expense retry identity and reversal paths survive upgrade. Old expense plans without trusted snapshots need a new explicit review before new posting; no financial history is rewritten. Other S08/S09 source types retain existing behavior. Public TypeScript schema contract includes the nullable provenance column.
- Diff/security review identified direct S08 table reads as too broad for frozen financial evidence. Persisted **2 FAIL / 14 PASS → 16 PASS** closes that leak using the existing financial-report permission, retaining restrictive company isolation and valid explicit grants. Cross-company source selection is denied. Failed apply preserves VALIDATED state and original batches; contract scope changes reject while harmless linked-contract description edits remain allowed.
### VALIDATION
- Source-control suite **16 PASS**, including upgrade over an already posted pre11 correction whose review contained caller-supplied snapshot-shaped JSON. Original batches/review fields and retry responses are preserved; that JSON cannot authorize a new correction. Independent reviewer, immutable scope, private ACL, harmless description edits and stale competing proposals are covered.
- Full final application **539 files / 3,816 tests PASS** (572.71s), main/test TypeScript and build/PWA PASS. Evidence: `/home/user/validation/expense-correction/{red,expanded,upgrade,source-rls-red-corrected,source-rls-green,full-final,types,test-types-final,build}.log`.
- Built-app persisted desktop/mobile browser regression: first **10 PASS** (2.5min); after the final RLS tightening **9 PASS / 1 existing mobile workspace-initialization timeout**, followed by unchanged affected desktop/mobile rerun **2 PASS**. New source-scoped compensation for a day9 legacy expense shows source/control1300 **0/0 at day8**, **30.125/30.125 at day9**, with original expense posting retained. Historical uncorrected sample remains visibly FAIL; deposits/credits/cash, fees/reversals and expense retry/error scenarios also pass. Correction commands use real SQL; this is **report UI proof, not a new S09 command UI or hosted authentication proof**. Evidence: `browser.log`, `browser-final.log`, `browser-rerun.log`. The failure remained at workspace initialization, before report readiness; root cause unproven, not attributed to a database assertion.
- Six repository gates, frontend/database contracts and diff whitespace validation PASS after final RLS change. Types were aligned locally to the migration, not regenerated against a hosted instance.
### IN PROGRESS / NEXT / BLOCKED
- OWNER generic expense creation still uses6100 and must be replaced coherently with explicit owner allocation/receivable linkage, settlement exclusion of unapproved automatic deductions, lawful offset/recovery, adjustments and caller/UI parity (including maintenance). Do not change the account in isolation or grant offset rights from a label.
- The controlled historical **sample** now reconciles through reviewed append-only source correction with correct cutoffs. No production dataset was available or corrected. Legal obligation/allocation evidence and authorized source-scoped production review remain external prerequisites, not authority inferred from tests.
- S08 aggregate fingerprint behavior for other source types, other S09 correction dating/validation, unpaged data access, owner-receivable/offset command UI, legacy compatibility event grouping, and wider reconstruction/final-audit inventory remain open. No mission/stage completion claimed.
- Hosted QA still lacks required configuration. Prior sporadic browser initialization stalls remain a tracked risk; one reappeared in the final ten-scenario run; the unchanged affected rerun passed. Assertions/timeouts were not weakened and retries were not enabled.
