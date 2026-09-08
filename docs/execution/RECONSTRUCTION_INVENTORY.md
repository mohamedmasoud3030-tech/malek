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
- Confirmed next financial defect: historical AR/deposit reconciliation reads current operational balances instead of an as-of event history. Designing a lineage-aware correction without rewriting historical data or manufacturing missing event dates.

## NEXT
- Inspect remaining report/snapshot authorities against actual credit, cash, deposit and reversal events; extend persisted lifecycle coverage.
- Authorized QA, when available: hosted Auth/RLS/schema/Storage/Edge parity (not a blocker for local work).
- Governed product/scale/device acceptance items listed in `RECONSTRUCTION_COVERAGE.md`; no invented bulk writes or historical rewrites.

## BLOCKED (external verification only)
- Hosted Auth/RLS/schema parity/Storage/Edge configuration and hosted financial journeys require an authorized QA environment. Local authenticated SQL replay and browser-to-SQL journeys are now running; they do not prove hosted GoTrue/JWT/PostgREST parity. No production writes or pushes.

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

### CONFIRMED OPEN — historical as-of drift (FIN-019)
- Disposable SQL diagnostic at as-of **2026-09-08**, before new events: AR subledger/GL both **1000**, deposit subledger/GL both **0**.
- After recording a **123.456** payment and **500** deposit dated **2026-09-09**, querying the SAME earlier cutoff returned AR subledger **876.544** versus GL **1000**, and deposit subledger **500** versus GL **0**.
- `wp05_subledger_tenant_receivables` subtracts current paid/credit fields; `wp05_subledger_security_deposits` ignores its cutoff. This is a reproduced repository defect, not a hosted claim. Probe source/output are under `/home/user/validation/continued/asof-probe-source.txt` and `asof-diagnostic.log`; the diagnostic is not a passing correctness regression and is not left in the application test suite.
- Next repair must derive dated payment/credit/deposit/refund/reversal events, respect posting-period effective dates and immutable lineage, and explicitly handle incomplete historical lineage. Simply summing GL as the “subledger” would conceal reconciliation errors and is not acceptable.
- VAT return aggregation also needs deeper source/credit/fee/tax-recognition review; no statutory accounting policy or historical correction has been invented to force a quick green result.
