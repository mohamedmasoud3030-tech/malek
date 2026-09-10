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

## LIVE LEDGER — final audit (updated 2026-09-10)

**COMPLETED (with evidence in this file):**
| Domain | Verdict | Evidence |
|---|---|---|
| Company/property/owner/tenant isolation | PASS | `db0:gate` 7/7; 107 tenant tables / 254 policies; 0 weak or tautological fences |
| RLS | **2 DEFECTS FOUND AND FIXED** | SEC-003 `users`, SEC-004 `audit_log`; see section below |
| Permissions / auth / maker-checker | PASS | 69/69 permission suites; 283/283 auth+governance+audit |
| Data-access boundaries | PASS | `anon` holds **0** privileges; only 2 real tables writable by `authenticated`, both RESTRICTIVE-fenced; GL `journal_batches`/`journal_lines` deny-all to browser |
| Reports | PASS | 219/219 report suites; period-scoping, historical cutoff and cash-vs-entitlement invariants each explicitly asserted |
| Migrations | PASS | 97/97 replay from clean, 0 failures; new migration re-applies 3× cleanly |
| Business logic / calculations / historical integrity | PASS | full sharded regression 3,943 tests, 0 assertion failures |
| UI/UX + RTL + responsiveness | PASS | 26/26 + 31/32 + 56 passed across 5 viewports × light/dark, desktop+mobile |
| Accessibility | PASS | axe 15/15 (suite is excluded from the sharded runner; run explicitly) |
| PWA / offline / cache privacy | PASS | runtime-proven 2/2, zero private responses in any cache store |
| Security / secrets | PASS | Guardian PASS incl. privileged-key scan |
| Unused files & dependencies | PASS | 0 of 8 deps unused; 0 of 683 sources unreferenced |
| Regression coverage | PASS | 552 files / 3,943 tests |

**HOSTED VERIFICATION — 2026-09-10 (read-only; see `docs/execution/evidence/hosted-verification-20260910/`)**

A Supabase management token became available and was used against the live `Malek-Plus` project. The session **began read-only**; the user then explicitly authorized applying the pending migration chain (and confirmed production currently holds test data). Outcome: **all 27 pending migrations applied, ledger 79 → 108, zero rows of data changed** — every row count identical to `pre-financial-baseline.json`. No DML was issued against business data; the only non-DDL writes were `schema_migrations` ledger rows.

- ✅ **Hosted JWT/PostgREST anon boundary is now PROVEN, not inferred.** Live REST returns `42501 permission denied` for `companies`/`users`/`audit_log`/`owner_balances`; `anon` holds **0** grants; root discovery is 401 with 0 exposed paths. This closes the long-standing "local SQL with mocked auth cannot prove PostgREST" gap.
- ✅ Live structural isolation: 105 tenant tables, **0** RLS-disabled, **0** without policy, **0** definers missing `search_path`, **0** views not `security_invoker`.
- ✅ **SEC-003 and SEC-004 WERE live in production and are now CLOSED there** (user-authorized apply of `20260910000000`; user confirmed production data is test data). Proven by impersonating the real `authenticated` role with real JWT claims: the admin of company `5138ff36` went from seeing **6 users / 41 audit rows** to **2 users / 0 audit rows**; the admin of `ae96d298` sees its own 6 members and its own 7 attributed rows. Zero data loss (41 rows before and after); 7 rows recovered attribution from embedded evidence, 34 correctly withheld as unproven. Definer writers, VIEWER reads and the anon `42501` boundary all still behave. Ledger updated to 80 entries.
- ✅ **Migration drift FULLY CLOSED — 27 of 27 applied (superseded the earlier "20 of 27, halted" status).** Ledger 79 → **108**, **zero data change** (every row count identical to `pre-financial-baseline.json`). Matching repo files to the ledger by version **and** name: **0 truly unapplied** (99 repo files; 18 recorded under earlier renumbered pre-squash versions; 27 ledger rows are pre-baseline squashed history). Two corrections to the earlier reading, both documented in `HOSTED_VERIFICATION.md` §7: (a) the `20260909000015` anchor needles **were** present — the "missing" verdict was a false negative from exact-string grep against a hosted body that renders without spaces after commas; (b) `RC1_WP05_CASH_FLOW_GUARD_ANCHOR_NOT_FOUND` was **not** drift — `20260901000064` had *moved* the function to `app_private.financial_cash_flow_gl_core`, which already carried byte-identical hardening, so production was **ahead**. The drift that was real: a statement-level diff showed **14 statements present only in the repo** (11 `Cross-company` guards, 2 duplicate-match guards, the enriched `audit_log` write); production had **zero** `Cross-company` occurrences, though all 8 entity lookups were already `company_id`-scoped, making these defence-in-depth rather than an open door. Fixed forward by `20260910000002_rc1_bank_reconciliation_hardening_forward_carry.sql` (lines 1–776 of `033` copied verbatim by line range, obsolete wp05 DO block omitted); function now **16,655 chars / 10 guards**. Separately, `20260909000012` and `20260909000014` had executed but their ledger rows were missing — both files contain `$s$`, which collided with the recorder's dollar-quote tag; re-inserted via base64.
- ✅ **Production money precision is now OMR-correct.** `numeric(18,3)` on `contract_balances.total_paid`/`total_invoiced`/`balance_due`, `bank_accounts.opening_balance`, `units.rent_amount`, `utility_bills.paid_amount`, `properties.purchase_value`, and all 4 `owner_balances` money columns. Deliberately left `numeric(14,2)`: `properties.current_value` (valuation) and `utility_bills.current_reading` (meter reading) — neither is OMR ledger money. Post-apply sweep: 107 tenant tables, **0** RLS-disabled, 260 policies, **0** definers missing `search_path`, **0** anon grants, **0** non-`security_invoker` views.
- 🔍 **Systemic root cause found: rewriting merged migrations.** 24 migrations patch functions by string-matching `pg_get_functiondef()` output. Production applied the pre-squash originals; the repo files were later rewritten (e.g. commit `8258c528` edited `20260901000038` *after* production applied it), so anchors no longer match. One case was proven whitespace-only and fixed forward by `20260910000001_normalize_maintenance_close_anchors.sql` (body captured mechanically from a clean replay, not hand-written; refuses to act unless whitespace-identical). The `033` case is real logic drift and needs a statement-by-statement diff, not a normalizer.

**BLOCKED (still genuinely blocked):**
- Intermittent bootstrap stall root cause: requires authenticated e2e (`E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` unavailable). A management token does not provide a browser session. Diagnosis narrowed to the two synchronous `onAuthStateChange` listeners + `withCompanyResolutionTimeout`; **not** guessed at or "fixed" blind.
- Hosted **concurrency** proof (Web Locks, contended RPCs): not exercised.
- Runtime behaviour of the newly-applied migrations under **real traffic**: applied and structurally verified, not exercised against live usage.

**NEXT:** governed adoption/allocation workflow UI (migration18 follow-on).

## migration16 — owner position cash evidence: BROWSER BLOCKER CLOSED (2026-09-10)

**The interrupted browser run was never a real failure of the fix.** Re-run on the untampered `VITE_E2E=true` production build against the static preview: `e2e/owner-position-cash.spec.ts` **3 PASS** (chromium desktop + tablet + mobile), retries 0.

- **The `property_owners` fixture-relation problem is distinct from the intermittent bootstrap defect, and is now proven by inspection.** The hermetic backend treats `select` as a reserved parameter and skips any filter key containing `.` (`handleTableRequest`), so it has **no PostgREST embed parser at all**. `property_owners` was seeded only as a flat top-level table, so `properties` rows came back without the nested key and `owner-dossier-body.tsx:57` hit `.find()` on `undefined`. The spec now builds the nested relation from **real SQL** (`to_jsonb(p) || jsonb_build_object('property_owners', jsonb_agg(to_jsonb(po)))`). **No production fallback was added**: `listOwnerProperties` uses `property_owners!inner(*)`, and an inner join cannot return a null embed in real PostgREST, so a `?.` there would have masked a fixture defect rather than fixed one. `normalizePropertyWithOwners` remains the single enforcement point for the left-join path (`listPropertiesWithOwners`).
- **Assertions were not weakened — proven by negative control.** Flipping the incomplete-evidence disclosure in `owner-financial-authority-section.tsx` made the spec **FAIL**; the file was then restored byte-for-byte (`git status` clean). The suite genuinely detects the defect class it claims to cover.
- **Settled entitlement is displayed separately from proven cash.** Parser invariant (`owner-financial-authority-service.ts:113-115`) rejects any response where `paid_cash` is non-null while evidence is missing, or where `paid_cash <> paid_cash_proven_total`. Missing history yields `paid_cash = null` rendered as **"غير مكتمل الإثبات"** plus a partial total explicitly labelled as not-the-full-figure — never silently coerced to zero and never presented as a complete total.
- **All-period disbursement is never subtracted from a single period's entitlement.** Every lifecycle figure in `professional-owner-report.ts` is labelled "كل الفترات", and the document states this in-line (lines 330-333, 346-348).
- Focused proof: `owner-paid-cash-position` + `owner-financial-service` + `owner-position-response-contract` = **25 PASS** on real PGlite SQL.

### Regression found and fixed at the source: forward-carry silently reverted migration15

Running the full financial/owner suite surfaced **3 failures** in `owner-payout-cash-authority.test.ts` — **caused by this session's own `20260910000002` forward-carry.** It runs `create or replace function public.process_bank_reconciliation_match_atomic(jsonb)` with the `20260901000033` body; on a **clean replay** filename order places it *after* `20260909000015`, reverting that migration's two patches. The match authority fell back to reading `s.net_payable` (the **entitlement**) instead of `app_private.owner_settlement_paid_cash` (**proven cash**), and lost `OWNER_PAYOUT_CASH_EVIDENCE_REQUIRED`. That would let a bank line reconcile against an owner payout never actually paid in cash.

**Production was never affected** — there `...015` was applied *after* the forward-carry, so the live function already held both changes (verified `owner_settlement_paid_cash` ×1, `OWNER_PAYOUT_CASH_EVIDENCE_REQUIRED` ×1, legacy needle ×0, `Cross-company` ×10). The defect was **clean-replay-only**, which is exactly what the replay gate exists to catch.

**Fix:** `supabase/migrations/20260910000003_reapply_owner_payout_cash_authority_after_forward_carry.sql` re-applies migration15's DO block, **copied verbatim by line range** (`diff` against lines 69-89 of `...015`: IDENTICAL). Neither merged migration was edited — rewriting merged migrations is the root cause of the anchor-drift class this session spent its time repairing. The block is **strictly idempotent**: for each patch it skips when the replacement is already present exactly once, aborts with `OWNER_PAYOUT_CASH_MATCH_PRECONDITION` on any unrecognised state, and never double-applies. Proven by applying the whole chain **plus OPS-003 a second time**: result `cash_reader 1 / guard 1 / cross_guards 10`, 101 applied, 0 failures. Applied to production HTTP 201 as a **verified no-op** (function length `16886` unchanged); ledger row recorded.

Verification: replay **100/100** · `db0:gate` **7/7** · typecheck clean · migration-hygiene OK · business-rules hash unchanged · financials+owners **933/933 PASS** (was 930 + 3 failed) · browser **3 PASS** desktop/tablet/mobile.

## REPO ↔ PRODUCTION PARITY: PROVEN ZERO DRIFT (2026-09-10)

Section 7 of `HOSTED_VERIFICATION.md` proved the migration *ledger* was complete. This proves the *schema itself* agrees — the stronger and more meaningful claim. Full detail in **§8** of that file.

**Method matters here.** A raw `pg_get_functiondef` hash is worthless for this: production stores minified bodies, so 26 functions looked different while being identical code. The comparison normalizes comments, whitespace, semicolons and `public.` prefixes on both sides before hashing.

| Check | Repo (clean replay) | Production | Verdict |
|---|---|---|---|
| Functions compared | 431 | 432 | — |
| **Semantically different** | — | — | **0** |
| Present only in production | — | 1 | benign permission wrapper |
| Columns at `numeric(18,3)` | 74 | 74 | identical |
| Columns at scale 2 | 7 | 7 | identical set, none is money |

- **`custom_access_token_hook` — the JWT claim minter — is byte-equivalent after normalization.** The most security-relevant single result here. So are `role_has_app_permission` (differs by one trailing semicolon), `update_tenant_balance`, `guard_journal_line_rc1_revenue_scope` and `wp05_reconcile_all` (differs only by `current_company_id()` vs `public.current_company_id()`).
- **The one production-only function is not drift.** `public.wp05_rpt_cash_flow_gl(date,date)` is the wrapper left by `20260901000064`'s relocation: it *adds* `require_financial_reports_view()`, is `SECURITY DEFINER` with a pinned `search_path`, and no app code calls it.
- **Money precision, earlier note corrected.** The prior "only 2 `numeric(14,2)` remain" undercounted by filtering on `(14,2)`. The real scale-2 set is 7 columns — `vat_rate`, `tax_rate` (percentage rates), `response_time_hours` (duration), `properties.current_value` (valuation), and three `utility_bills` meter/consumption columns. **No OMR ledger money is at scale 2**; all 74 money columns are `numeric(18,3)` on both sides.
- **`rpt_owner_statement` re-verified against the deployed body on both sides** (identical, 4,519 chars): legacy `s.date` 0, legacy `s.amount` 0, `owner_settlement_paid_cash` 3, `s.paid_at` 3, `_owner_statement_expenses` 1. The three defects recorded in `8d1d5e75` are closed in production, not just in the repo.

## AUDIT FINDING — reversed accruals were invisible on tablet (found and fixed 2026-09-10)

Surfaced by running the financial browser specs during the audit, **not** by a test that was already failing in CI.

- **Defect:** in `fixed-monthly-accrual-workspace.tsx` the `status` column was `priority: 'secondary'`. `resolveTabletColumns` (`entity-table.tsx:236-246`) keeps only the first **1–2** secondary columns — with 4 stable columns here (`date`, `propertyOwner`, `gross`, `actions`) the limit is 2, and `monthly` + `net` come first. **`status` was therefore dropped entirely at 768px**, so a REVERSED accrual ("تم العكس") looked identical to a live one on tablet. Posting state is not a secondary detail; it is the column that says whether the money is real.
- **Pre-existing, not a regression from this session** — `git diff 81ee3671..HEAD` shows the workspace, the spec and `entity-table.tsx` were all untouched by this work.
- **Fixed at the authoritative source** (`priority: 'primary'`), matching how automation, communication, billing-readiness and lands workspaces already treat status. The shared table component was **not** weakened and the assertion was **not** relaxed.
- Verified: `financial-persisted-journey` **6 PASS** (desktop/tablet/mobile, was 1 failing on tablet); accrual + entity-table unit suites **44 PASS**; typecheck clean.
- **Separately, one apparent failure was INFRA, not a defect:** `reconstruction-financial-read-model` was SIGKILLed by the 1.9 GB sandbox during the parallel run and passes **6/6** in isolation. Reported as INFRA rather than counted as a product verdict.

## COMPREHENSIVE AUDIT — status after the 2026-09-10 session

| Dimension | Verdict | Evidence |
|---|---|---|
| Repo ↔ production schema parity | **PASS** | 431/432 functions, **0 semantic differences**; 74/74 money columns `numeric(18,3)` |
| Migrations | **PASS** | ledger 109, 0 unapplied; clean replay **100/100**; `db0:gate` **7/7** |
| Business logic / calculation correctness | **PASS** | full regression **552 files / 3,943 tests / 0 failures**, 0 INFRA kills |
| Historical integrity | **PASS** | owner-funds events append-only (trigger-proven); S09 corrections post compensating batches, originals retained |
| Permissions / auth / RLS / isolation | **PASS** | 107 tenant tables, 0 RLS-disabled, 260 policies, 0 definers missing `search_path`, 0 anon grants; `custom_access_token_hook` byte-equivalent to repo |
| Reports & documents | **PASS** | `rpt_owner_statement` verified on the deployed body both sides; all-period totals never subtracted from a single period |
| UI/UX + RTL + responsive + a11y | **PASS** (1 defect found & fixed) | 95 browser assertions across 5 viewports × light/dark; axe **15/15**; tablet status-column defect fixed |
| PWA / offline / cache privacy | **PASS** | production-contract **3/3** at runtime; **0** `rest/v1`/`auth/v1`/`storage/v1` entries in the precache manifest |
| Security / secrets | **PASS** | Guardian **PASS** (5 layers incl. privileged-key scan + function-default-ACL) |
| Unused files & dependencies | **PASS** | 8/8 runtime deps referenced; 0 unreferenced sources |
| Regression coverage | **PASS** | 3,943 tests; negative control proves the owner-position spec actually fails when the logic is broken |

**Genuinely NOT proven (unchanged, and not claimable without new inputs):**
- **Authenticated app shell** — every spec that logs in is gated on `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`, which are unavailable. This is the same coverage gap that blocks root-causing the intermittent bootstrap stall. Diagnosis remains: the async-auth-callback deadlock hypothesis is *structurally excluded* (both `onAuthStateChange` listeners contain zero `await`), and `withCompanyResolutionTimeout` is a proven fail-closed mitigation — but the root cause is **OPEN**.
- **Hosted concurrency / Web Locks** under contention.
- **Runtime behaviour of the newly-applied migrations under real traffic** — applied and structurally verified, not exercised by live usage.
- Whether the two historical leaks (SEC-003/SEC-004) were **ever exploited** — no historical access logs exist.

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

## Owner expense allocation / lawful settlement source (migration12)
### COMPLETED — repository implementation
- Explicit immutable owner allocation/evidence and exact agreement version; canonical1300 source postings; deferred completeness; duplicate source protection; no inferred offset rights or automatic adopted-expense deduction.
- Shared expense/maintenance entry, three-decimal maintenance persistence, strict closure acknowledgement and retry/cache behavior, all financial read-model invalidations. Retired obsolete positive-cost maintenance insertion.
- Residual payout source/control agreement and fully-offset no-cash path. Unreviewed legacy automatic deductions now block new settlement effects while history/cached responses are preserved.
- SQL16 PASS; current-authority historical/source suites44 PASS; final full540 files/3,833 PASS after the additional historical assertions; refreshed built-app expense/maintenance/report desktop/mobile2 PASS after an unchanged rerun of the tracked initialization stall. Main/test types and build/PWA PASS. Detailed scope, chronology and limitations: `OWNER_EXPENSE_SOURCE_ALLOCATION_20260909.md`.
### IN PROGRESS / NEXT
- Governed historical adoption and unblocking of reviewed legacy-netted settlements; old erroneous payout-source events; pre12-approved S09 apply compatibility; owner adjustment/recovery/offset command UI and parent source presentation.
- Agreement-selector pagination, statements/cache/rebuild/classification/data-access audit; all remaining financial inventory, then the application-wide final audit. This is not financial or application completion.
### BLOCKED externally / PRESERVED / RETIRED
- Hosted JWT/PostgREST/concurrency and production evidence/remediation remain externally blocked; repository work is not blocked by missing hosted configuration.
- Preserve original postings, historical costs and verified cached operations. A source review alone does not yet adopt legacy expenses or authorize their deduction.
- Retired unsafe new raw maintenance expenses, alternate new private OWNER creation and unreviewed legacy automatic deductions. No history was rewritten or silently repaired in reports.

## Agreement read boundary follow-up (FIN-007/016; SEC-002)
### COMPLETED
- After exact remote verification of9fbbc59638483913fd744d151e5e0873285a5b3d, reproduced silent truncation and later-page error loss:5 failing/1 passing agreement-read tests.
- Property/owner agreement lists now use the existing fail-closed paged-read authority and deterministic date+ID ordering. Version reads deduplicate and batch IDs through the existing bounded-IN helper, page every batch, and preserve global version ordering. No new pagination abstraction, permission change, schema change or temporal-policy filter.
- Focused agreement/helper regression49 PASS; real SQL source regression16 PASS; main/test types and frontend/database contracts PASS. Built-app expense/maintenance/report desktop/mobile2 PASS36.4s with retries0. Build/PWA PASS on unchanged rerun after a sandbox exit137. Logs: `/home/user/validation/owner-expense/agreement-*`. Last full-suite baseline remains540/3833 at9fbbc596; this follow-up adds6 focused tests, not a fabricated new full-suite total.
### NEXT / PRESERVED
- Agreement pagination item is resolved; remaining source remediation, approved S09 compatibility, adjustment/recovery/offset command UI and wider inventory remain open. Existing property/owner/RLS scope, all temporal statuses and error metadata are preserved. Multi-page service reproduction uses a capped adapter; the browser selects a real SQL-validated agreement, but is not hosted large-dataset verification.

## Pre12-approved S09 compatibility — persisted upgrade proof
### COMPLETED
- Added actual11→12 upgrade over an independently approved S08 review and VALIDATED S09 expense plan. Frozen review, original expense and every original batch remain unchanged. Cached draft identity survives; first apply appends exactly one correction; repeated apply preserves the existing explicit APPLIED-status rejection with no duplicate effect.
- Historical1300 source/control stays0/0 before the original expense date and30.125/30.125 on that date. Accounting classification approval still cannot authorize a legacy automatic settlement deduction. No runtime implementation change was needed for this compatibility case.
- Source17 PASS (`approved-s09-upgrade-final.log`); final whole suite INCLUDING pagination and upgrade proof541 files/3,840 tests PASS559.03s (`full-followup-final.log`); test types PASS. Runtime build/browser remain the verified unchanged9f7d81a4 artifacts. Earlier test expected repeated apply to succeed; inspection confirmed existing S09 contract rejects an APPLIED state, and the test now verifies that preserved behavior rather than changing it.
### NEXT
- The specific pre12-approved S09 apply compatibility item is resolved. Governed historical allocation/adoption and legitimate unblocking of old netted settlements, historical payout remediation, owner adjustment/recovery/offset UI, statement/cache/rebuild/classification and the later whole-application audit remain IN PROGRESS. No financial/application completion claim.

## Offset finality and exact owner-fund ceilings (migration13; GAP-008)
### COMPLETED
- Reproduced3 unsafe persisted transitions, then fixed at existing write authorities: no one-baisa over-offset/negative funds allowance; reverse active offsets before cancellation; no new offset reversal rewriting paid settlement evidence. Independent paid-row guard protects historical fields/deletion, allowing notes.
- Valid unpaid reversal→cancellation and original cached offset/reversal/payment identities remain supported. Explicit12→13 upgrades preserve original bad negative0.001 source/control and all history without backfill; authorized unpaid reversal remains compensating. Lock order is receivable→settlement, not a multi-session proof claim.
- Offset15 PASS; final full541/3845 PASS620.05s; types/gates/contracts PASS; unchanged built frontend with current SQL browser desktop/mobile2 PASS39.7s. Logs `/home/user/validation/offset-safety/`. Canonical traceability updated; no stage-credit change.
### IN PROGRESS / NEXT
- Settlement workspace/report amount presentation still ignores lawful offsets in some paths (e.g. owner-settlements-service maps net_payable without offset_applied; payout dialog says the pre-offset amount will be paid). Trace authoritative report and historical cash-source semantics before repair; do not clamp or conceal old source discrepancies.
- Governed post-payout adjustment, historical adoption/remediation and adjustment/recovery/offset management UI remain open. Source finality safety stops are not substitutes for those workflows. Continue remaining statement/cache/rebuild/classification work and eventual application-wide audit; no completion claim.

## Authoritative residual payout quote (migration14; GAP-008)
### COMPLETED — repository implementation and persisted proof
- APPROVED payment preview checks role, effective permission, company, freshness and allocated expense scope. Checked quote under the existing payout lock; no client amount override. Legacy unquoted fingerprints/replays preserved. Live pending cash is net entitlement minus applied offset; historical paid cash is deliberately NOT inferred from mutable old headers.
- Workspace displays entitlement, offset and residual separately; strict ACK requires the same settlement/request/amounts and cash journal (or zero-cash/null journal). Caller-owned retry identity and unchanged quote survive an uncertain response. Explicit refresh; financial invalidation also on error; current action closures and direct mobile action menu; all-owner scope labeled accurately.
- Real SQL18 PASS, client/workspace/report36 PASS. Standard full suite541 files/3842 PASS573.15s; separately excluded primitive accessibility suite1 file/15 PASS. Combined exercised coverage542 files/3857 tests, not a claim that the standard command includes the excluded file. Main/test types PASS; generated DB types, DB0, Guardian, Supabase suite, migration/GL/business gates and frontend contracts PASS. Guardian now checks the actual eight-argument maintenance RPC (retired six-argument entry was stale), and the quote permission.
- Built PWA PASS. Actual payout UI on both viewports shows979.875 after20.125 offset against1000 entitlement, loses the first committed response, retries identical request/hash, and persists one payment. Latest mobile completed the whole source/maintenance/report flow17.6s. Latest desktop passed the new payout flow but intermittently stalled on final report initialization: overall browser run1 PASS/1 FAIL, NOT green. Earlier desktop completed once. No weakened assertions/retries or speculative auth rewrite.
- Existing global ACL-lock migration already denies direct settlement/link DML; regression verifies actual authenticated UPDATE rejection and final INSERT/UPDATE/DELETE/TRUNCATE privileges. Broad baseline grants alone were not final-state evidence. REFERENCES/TRIGGER least-privilege review remains in the later security audit; no DML bypass is claimed.
### IN PROGRESS / NEXT
- Reproducible intermittent full-page bootstrap stall remains unresolved, predating14. Failed desktop trace lacks the final company-members request; callbacks inspected are synchronous, so an async auth-listener deadlock is not established. Keep traces; diagnose actual initialization rather than rerun for a lucky green.
- Historical paid-cash/statement/bank-reconciliation authority, governed historical adoption and post-payout adjustments, recovery/offset management UI, remaining financial source/cache/rebuild audit, then the requested application-wide audit remain open. In particular bank reconciliation still selects paid settlements by net_payable, not proven cash.
### BLOCKED externally / PRESERVED
- Hosted JWT/PostgREST/concurrency and production evidence are unverified; disposable SQL plus mocked auth is not hosted proof. Preserve paid history, legitimate legacy retries and original source discrepancies. No stage-credit or financial/application completion claim.
- Evidence: `/home/user/validation/offset-safety/quote-*`, `quoted-browser-rerun.log` and earlier failed browser logs. Resource failures and stale gate contracts were investigated; successful final checks above supersede them without deleting their evidence.

## Original owner cash / bank matching (migration15; GAP-008)
### COMPLETED — authoritative bank-cash path
- Reproduced the write defect with actual collection→offset25→payout975: the bank RPC accepted an incorrect−1000 entitlement match and rejected the actual−975 cash line. Both now use the same private original-cash reader as suggestions. Positive cash requires the canonical original pay batch with balanced2000 versus1111/1120 lines. No original positive posting means unknown, except a persisted original zero-cash acknowledgement proves a fully-offset closure. Never infer cash from today's offset header or absence of a batch alone.
- Bounded, permission-checked/company-scoped cash RPC; complete200-ID batches and strict response identity/amount shape. Coarse UTC envelope bounds reads, but the existing company-calendar converter remains the exact date authority. Unknown/missing/later-page error fails closed. Bank UI now exposes failed suggestions with retry instead of a successful empty list.
- Actual11→15 upgrade: historical payout975 survives a then-permitted post-payment offset reversal leaving header offset0. The old erroneous gross−1000 owner-funds event, other events and original retry identity remain unchanged. Reading correct cash does NOT repair that subledger discrepancy or silently grant adoption authority. A separate explicit malformed-import fixture proves missing history remains unknown.
- Focused cash SQL8/client10 PASS; complete bank reconciliation14 files/84 PASS. Full544 files/3876 PASS539.96s (includes primitive accessibility suite); main/test types, six repository gates, generated types and frontend contracts PASS. Build/PWA PASS.
- Latest rebuilt SQL-backed browser4 PASS57.0s, retries0: existing expense/maintenance/quoted-payout/report flow and new bank-cash/error-retry/confirmation flow, desktop+mobile. New bank test proves−979.875 match persisted once with no additional journal. Harness date serialization corrected to Postgres JSON date strings; mobile uses existing action overflow. Auth/ancillary reads mocked; no hosted proof claimed.
### IN PROGRESS / NEXT / PRESERVED
- Owner financial-position paid_net still represents settled entitlement, and its paid-cash presentation plus statements/document consumers need the same evidence-aware cash authority. Do not relabel guessed historical net−offset as cash. Governed historical adoption/remediation, post-payout adjustment and recovery/offset UI remain open, followed by remaining finance and final application-wide audit.
- Pre-existing intermittent full-page bootstrap issue is NOT proven fixed by the successful current run. Added observational failure attachments (Web Locks and auth/company request paths only; no tokens); no auth replacement, lock bypass or assertion relaxation.
- Preserve all original batches/headers/matches, source discrepancies and cached payout identities. Existing match command replay/status behavior and permissions were not broadened. Hosted JWT/PostgREST/concurrency and real evidence remediation remain externally unverified. No stage credit or completion claim.
- Evidence: `/home/user/validation/offset-safety/cash-*`. The first browser attempt lacked restored Chromium libraries; the next exposed date-serialization/mobile-selector harness errors. The corrected and final runs passed without weakening assertions.

## User-requested stop — migration16 preserved, NOT completed
The user explicitly stopped all development and requested only commit/push of local work plus a full handoff, without merge. The authoritative stop record is [HANDOFF_20260909_STOP.md](HANDOFF_20260909_STOP.md). Migration16 and its UI/service/document/tests are preserved as incomplete work: focused35/types/build PASS, first browser2 FAIL, corrected browser attempt interrupted with a desktop failure and no final group result. No final full-suite/gates/browser success is claimed for16. Last fully verified checkpoint is15 at9cbd15d730efa281edb0957e194fd27abd993ded. Do not resume autonomously without a new user instruction. Selected validation logs are preserved under `evidence/session-stop-20260909/`.

## Authorized resume — migration16 completed and verified (2026-09-09)
Resumed on user instruction from `81ee3671fd4edda6c719aab9b58211f7ea2584f2`, same branch, no reset/revert/stash. Branch, HEAD and remote SHA were verified identical before any edit; the tree was clean.

### COMPLETED — migration16 browser failure diagnosed to a real product defect
- The interrupted browser failure was NOT the `property_owners` fixture relation. That harness change (already committed in 81ee3671) is correct and works: with it the dossier renders and the financial tab opens.
- Reproduced the real failure from actual evidence (`error-context.md` DOM snapshot, not inference): the financial tab rendered **«تعذر تحميل الموقف المالي للمالك — استجابة الموقف المالي للمالك ناقصة المعرّف»**.
- Root cause is a genuine client/server **contract mismatch**, not a fixture artifact: `public.rpt_owner_financial_position` returns the owner identity under **`meta.owner_id`** (canonical baseline, confirmed by executing the real function), while `parsePosition` required a root-level `owner_id`. Every real response therefore failed the cross-owner identity guard before any figure could render. `basis`/`operating_model` are likewise absent at the root; the server states `meta.derivation_authority`.
- Why it was invisible: the service unit test mocked a root-level envelope the database never emits, and the hermetic browser fixture seeded that same wrong shape. Both were green while the real screen was broken.
- Repair is at the client boundary, which is the incorrect side. The identity guard is **preserved** (it prevents showing one owner's money under another) and now reads the field the server actually populates; a root-level variant is still accepted for forward compatibility; a response proving no owner is still rejected. No production `fallback`, no weakened assertion, no auth/Web-Locks change, no SQL rewrite.
- Fixture correction: `e2e/support/fake-supabase-backend.ts` now mirrors the real `meta` envelope, so the hermetic backend can no longer hide this class of drift.
- New regression `owner-position-response-contract.test.ts` feeds the **unmodified jsonb of the real function** into the real parser — the only layer that proves DB output and client parsing agree. It also pins the incomplete-evidence state (`paid_cash` null, proven subtotal 975, missing count 1, entitlement 1100) and that lifetime cash is not rescoped to the requested period.
- Verified: focused **46 PASS** (was 35); full regression **544 files / 3820 tests PASS, 0 failures** (sharded, see note below); main+test types PASS; six repository gates PASS; frontend–database contract gate PASS; accessibility primitives 15 PASS; build/PWA PASS; browser **6 PASS** desktop+mobile (migration16 spec plus both migration15 specs, no regression), retries 0.
- Resource note: a single-process full Vitest run is SIGKILLed by the 2 GB sandbox part-way through. That is an INFRA outcome and is never counted as a pass or a failure. `scripts/run-sharded-regression.mjs` runs the identical suite/config/exclusions in sequential fresh processes and reports signal-kills separately from test verdicts. Browser runs use the production build behind `scripts/e2e-static-preview.mjs`, matching the previously documented approach after the dev server exhausted memory.
- Two repository gates (`check:migration-hygiene`, `check:gl-write-boundary`) and Guardian initially failed only because a single-branch clone has no `origin/main` base ref. Fetching `origin/main` (fe2a5911…) resolved them; no gate logic or threshold was modified.

### IN PROGRESS — rpt_owner_statement settlement authority (evidenced, not yet repaired)
`owner-statement-settlement-authority.test.ts` proves three defects against real SQL, before any repair:
1. **Monetary** — settlement movements use legacy `s.amount` (frozen entitlement 1000), not the 975 cash proven by `app_private.owner_settlement_paid_cash`. The statement overstates the outflow by exactly the lawful offset.
2. **Temporal** — movements use legacy `s.date`, written once at draft creation as `period_end`. A statement window containing the true `paid_at` date omits the settlement entirely.
3. **Lifecycle** — a CANCELLED settlement retains its legacy `amount` and is still presented as a real −500 deduction.
These assertions document CURRENT REALITY so the defect is evidenced rather than asserted, and are to be updated in the same commit as the repair.

### NEXT
Repair the statement settlement authority at the source (cash/paid_at/lifecycle), then `_owner_statement_expenses`, deductions, historical ownership allocation, fees/tax, opening/closing/running balances and historical cutoff, governed historical adoption, owner-funds compensating events, post-payment adjustment workflow and adjustment/recovery/offset UI, remaining S08/S09 and cache/rebuild/permission items, then the application-wide audit.

### BLOCKED
- **GitHub credentials are not available in this environment.** `git ls-remote` over HTTPS works read-only and confirmed the remote tip matches `81ee3671…`, but no token/helper is present, so **push and remote-SHA verification cannot be performed**. Work is committed locally on the same branch so nothing is lost; the user must restore access for the checkpoint to be pushed and literally verified.
- Hosted JWT/GoTrue/PostgREST/RLS/Storage parity and multi-session concurrency remain unproven. Local SQL with mocked browser auth is not hosted proof. No stage credit and no application-completion claim.

## Owner statement authority — settlement cash, payment date, lifecycle and company isolation (migration17)
`supabase/migrations/20260909000017_owner_statement_settlement_authority.sql`. Four defects were proven against real SQL BEFORE the repair, then re-asserted as the fixed behaviour in the same commit.

### COMPLETED — company isolation of the statement expense source (security)
- `public._owner_statement_expenses` carried NO company predicate, while every other CTE in `rpt_owner_statement` filtered on `v_company_id`. Because the caller is SECURITY DEFINER, the invoker's RLS on `public.expenses` (`expenses_select_app_users`) does not apply inside the call, so the helper's only scoping was owner id plus a `property_owners` link — and both tables hold per-company rows for the same owner id.
- Reproduced, not inferred: a POSTED, OWNER-charged expense of 777 belonging to `OTHER_COMPANY`, on a foreign property linked to the same owner id, was rendered inside this company's statement as a real deduction and summed into its totals.
- Repair: the helper takes an explicit `p_company_id` and filters BOTH the expense and the `property_owners` link on it. The unsafe three-argument overload is DROPPED so no caller can reach a version that cannot scope. The body is derived with `pg_get_functiondef` and asserts the governed `owner_allocation_version is null` source filter from migration12 is present, so that adoption rule is preserved exactly as deployed rather than re-typed and silently reverted.
- `owner-statement-company-isolation.test.ts` (4 PASS) proves the foreign row genuinely matches every non-company condition (so the negative assertions are not vacuous), that it no longer appears, that the unscoped overload is gone, and that this company's own owner-charged expense still appears.

### COMPLETED — settlement movements now read proven cash, real date and real lifecycle
- Legacy `owner_settlements.date`/`amount` are written once at DRAFT creation (`date := period_end::text`, `amount := net_payable`, baseline 5273) and are never revised by the APPROVED, PAID, CANCELLED or offset paths. Verified by reading all four update sites.
- MONETARY: the statement showed the 1000 entitlement where only 975 cash left the bank. It now reports the cash proven by `app_private.owner_settlement_paid_cash` — the same original-journal evidence the bank reconciliation and owner position already use — and labels the difference «بعد مقاصة مستحقات على المالك» instead of silently showing a smaller number.
- TEMPORAL: movements were dated to `period_end`, so a window containing the true payment date returned nothing and a merely-closed period showed an outflow that had not happened. Movements are now dated `paid_at::date`.
- LIFECYCLE: `settlement_rows` had no status filter, so a CANCELLED settlement still appeared as a −500 deduction. Only `PAID` settlements with a non-null `paid_at` are movements now; DRAFT/APPROVED remain visible in the owner position as `remaining_payable`, not as disbursements.
- Cash is NEVER derived from `net_payable − offset_applied`. A test pins this structurally: today the naive derivation happens to equal 975, but the header is mutable and a lawful post-payment reversal can drive it to 0 while the original outflow is unchanged, so the authority remains the posted journal.
- Missing evidence is surfaced, not invented: a PAID settlement whose original cash cannot be proven is shown at its entitlement and labelled «صرف غير مثبت بالمستندات» rather than dropped or zeroed.
- Posted history is untouched: no backfill, no rewrite of `date`/`amount`. A test asserts the legacy pair is still intact after the repair.
- `owner-statement-settlement-authority.test.ts` rewritten from diagnostic to authority: 8 PASS.

### Verification (migration17)
Focused 12 PASS (isolation + authority); dependent contracts 40 PASS (`r2-owner-financial-position-execution` statement parity, `r12-final-acceptance`, `owner-paid-cash-position`, `owner-position-response-contract`, `owner-offset-lifecycle` incl. paid-evidence freeze); all reports 62 files / 493 PASS; `db0:gate` 7/7 PASS; Guardian 12/12 PASS; `test:supabase` PASS (rls-matrix 84, client-visibility 241, internal-gl-rpc-boundary 58); migration hygiene, GL write boundary, business rules PASS; main+test types PASS; frontend–database contract PASS.

Generated types were regenerated with `pnpm db0:gen-types`; the diff is exactly one added `p_company_id` parameter. The `db0` contract and schema-drift gates correctly FAILED before regeneration — recorded here because that failure is evidence the gates detect this class of change rather than a step that was skipped.

### Harness bugs found in my own tests (NOT product defects — controls left intact)
- `app_private.guard_paid_owner_settlement` (migration13) correctly rejects any UPDATE to a PAID settlement. The test was rewritten to prove the point structurally instead of mutating paid evidence.
- `owner_settlements_approval_state_check` correctly requires `approved_at`/`approved_by` for APPROVED and PAID rows.
- RLS on `public.expenses` correctly hides the foreign row from `authenticated`; the probe reads it with the elevated role rather than weakening the policy.

### Checkpoint pushed and verified (resume session)
Remote credential access was restored in-process only. Both accumulated commits are now on the sole permitted branch `reconstruction/checkpoint-20260909`:
- `8d1d5e75` — migration16: owner position identity read from the canonical `meta` envelope.
- `79fff701` — migration17: owner statement settlement authority (proven cash, `paid_at`, PAID-only lifecycle) and the company-isolation repair of `_owner_statement_expenses`.

Literal remote SHA verified by an independent anonymous read of the remote, not from push output:
`git ls-remote https://github.com/mohamedmasoud3030-tech/malek.git reconstruction/checkpoint-20260909`
→ `79fff701ab4e4be026abf2acc921ca3821a2dee6`, identical to local `HEAD`.

`origin/main` (`fe2a5911…`) and `redesign/dashboard-calm-command-center` are untouched. No branch created, no PR, no merge, no force-push. The credential was used only for the in-process push: it is not in `.git/config`, the remote URL, `~/.git-credentials`, `~/.netrc`, `~/.gitconfig`, or any repository file (verified by scan after the push).

## Co-owned property expense allocation — EVIDENCED, then RESOLVED (Option 2, migration18)
`rentrix-app/src/features/financials/reports/owner-statement-coownership-allocation.test.ts` (5 PASS).

### The defect (reporting only)
`property_owners` is a real many-to-many carrying `ownership_percentage`, and co-ownership is a first-class governed feature: `20260901000069_atomic_property_ownership_payload.sql` accepts an explicit ownership payload, requires the shares to total EXACTLY 100, rejects duplicates and requires one primary. The property form exposes it.

The legacy owner-expense selectors test ownership with a bare `EXISTS` against `property_owners` and never read the share. On a property owned 60/40, a single 100 OWNER expense is therefore charged in FULL to BOTH owners — **200 reported against 100 actually incurred**. Proven for `rpt_owner_statement` and for `calculate_owner_net_payout` (each co-owner shows `owner_expenses = 100`). A structural assertion pins that `ownership_percentage` is used by NO function to apportion an amount anywhere in the chain.

### Severity is bounded — established by execution, not assumption
- The MONEY path is already fail-closed: `create_owner_settlement_draft_atomic` refuses a co-owned legacy expense with `OWNER_SETTLEMENT_LEGACY_EXPENSE_REVIEW_REQUIRED` (migration12), and no `owner_settlement_expense_links` row is reserved. A double-counted deduction cannot reach a payout.
- The governed adoption path is already correct: `owner_allocation_version=1` requires an explicit per-owner allocation whose total equals the expense exactly (deferred constraint `OWNER_EXPENSE_ALLOCATION_INCOMPLETE`), and adopted sources are excluded from these legacy selectors.
- So this is a REPORTING overstatement on un-adopted legacy co-owned expenses, not a payment defect.

### Resolution — APPROVED Option 2 (owner decision, 2026-09-09)
`supabase/migrations/20260909000018_owner_expense_coownership_allocation_authority.sql`.

The owner directed: do NOT apportion historical co-owned expenses by the current `ownership_percentage`. An unallocated historical co-owned expense stays UNALLOCATED and enters the governed historical adoption/remediation workflow.

Implemented exactly that:
- New single-source predicate `public.owner_is_sole_property_owner_on(company, property, owner, on_date)` — true only when the owner is the ONLY owner of the property AS OF that date. It deliberately does NOT read `ownership_percentage`. Written once and reused by all three selectors so the read paths cannot drift apart again. Company-scoped explicitly because the callers are SECURITY DEFINER.
- Applied to `public._owner_statement_expenses`, `public.calculate_owner_net_payout` and `public.owner_settlement_reservable_expenses`, each via `pg_get_functiondef` with a fail-closed precondition on the exact anchor text.
- Ownership is evaluated AT THE EXPENSE DATE, never as of today, so historical cutoffs hold in BOTH directions: a cost incurred while the property had one owner still belongs to that owner even though the property is co-owned now; and a cost incurred after a co-owner departed resolves to the remaining sole owner.
- Reporting no longer double counts: the shared 100 expense is reported 0 times in total instead of twice.
- Nothing is hidden. New permission-checked, company-scoped read `public.owner_unallocated_shared_expenses(from,to,property)` lists every unallocated expense on a property that had more than one owner at the expense date, with `owners_at_expense_date` and `resolution='GOVERNED_ADOPTION_REQUIRED'`, plus a count and total. Suppressing a wrong number never silently drops the cost.
- No apportionment or accounting rule was invented; no expense row was modified, allocated, backfilled or soft-deleted; the repair is read-path only. A test asserts the rows are byte-for-byte intact and that no function anywhere apportions an amount by `ownership_percentage`.
- The fail-closed money path is preserved: `OWNER_SETTLEMENT_LEGACY_EXPENSE_REVIEW_REQUIRED` still fires for a genuinely attributable sole-owner legacy expense. A co-owned expense no longer belongs to any single owner, so it stops blocking an unrelated owner's settlement, and can only ever reach a settlement through governed adoption, which requires an explicit per-owner allocation totalling the expense exactly.

Regression: `owner-statement-coownership-allocation.test.ts` 10 PASS — 60/40 non-attribution, non-apportionment, both historical-cutoff directions, no-double-count, visibility surface, permission check, money-path guard, row immutability, and the structural no-apportionment assertion.

Verification: reports/owners/lifecycle 52 files / 392 PASS; full regression **547 files / 3902 tests, 0 test failures** (sharded run covered 508 files / 3589 tests with shard 2 SIGKILLed by the sandbox heap — an INFRA outcome, never counted as a pass or a failure; shard 2 was then re-run solo in two halves: 20 files / 130 PASS and 19 files / 183 PASS, closing the suite); db0 7/7; Guardian 12/12; `test:supabase` (rls-matrix 84, client-visibility 241, internal-gl-rpc 58); business rules, hygiene, GL boundary PASS; main+test types PASS; frontend-db contract PASS; build/PWA PASS; browser 6 PASS desktop+mobile (retries 0). Generated types regenerated (`db0:gen-types`), adding only the two new function signatures.

### Completion — `20260909000019_owner_balance_coownership_completion.sql` (same defect, fourth selector)
Migration18 was INCOMPLETE. `20260909000012_owner_expense_allocation_source.sql` had patched FIVE owner-expense selectors for adopted-source exclusion; migration18 moved only THREE of them onto the sole-owner predicate. Enumerating migration12's list against migration18's exposed the gap, and an empirical probe proved it was live, not theoretical:

- **`public.recalculate_owner_balance` — REPAIRED.** On the 60/40 property with one unallocated 100 OWNER expense, `owner_balances.total_expenses` read **100 for BOTH owners** (net_balance 900 / −100) *after* migration18. The persisted balance table therefore contradicted the statement and settlement paths migration18 had already fixed — the worst drift shape, because `owner_balances` is stored state that outlives the request and backs other reads. Repaired with the identical `public.owner_is_sole_property_owner_on(...)` predicate at the expense date, via `pg_get_functiondef` with TWO fail-closed preconditions: migration12's adopted-source filter must still be present, and the bare-EXISTS anchor must occur exactly once. Read-path only — no balance row is recomputed or backfilled, no expense is modified, no posted history is rewritten.
- **`public.wp05_subledger_due_from_owner` — DELIBERATELY UNCHANGED.** It is a COMPANY-level 1300 control total keyed only on `company_id`/`expense_date` with no owner argument, so it counts each expense exactly once and cannot double count. Since migration07 it sums legacy owner-charged expenses PLUS `app_private.owner_receivable_history_balance`. Making it owner-aware would alter a reconciliation control rather than fix a defect.

Regression: `owner-balance-coownership-consistency.test.ts` 8 PASS — the stored balance excludes the unallocated co-owned cost; balance == statement == `calculate_owner_net_payout`; no cross-owner double count; both historical-cutoff directions; the 1300 control still reconciles to legacy-expenses + receivable-history exactly once each; the cost stays visible via `owner_unallocated_shared_expenses`; expense rows unmodified.

Verification: focused 8/8; reports/owners/lifecycle 53 files / 400 PASS; full regression **548 files / 3910 tests, 0 test failures** (sharded run reported 508 files / 3601 tests with shard 2 SIGKILLed — INFRA, never counted as a result — plus one load-induced 5s-timeout flake in `paginatedRead.test.ts` (503 retry case); shard 13 re-run solo 39 files / 283 PASS and shard 2 re-run solo in chunks 20 + 5+5+5+5 files, all PASS, closing the suite); db0 7/7 with 94/94 migrations replayed from clean; Guardian PASS all layers; `test:supabase` 84 + 58 + 1 + 1 + 241; business rules hash unchanged `382a0b8c…`; hygiene PASS; typecheck PASS; **no generated-type drift** (body-only change); build/PWA 28 precache entries; browser 6 PASS desktop+mobile (retries 0).

### Still open (follow-on, not part of this milestone)
The governed adoption workflow itself — turning a listed unallocated co-owned expense into an authoritative per-owner allocation — still needs its user-facing surface. Until then these expenses are correctly visible-but-unattributed rather than silently split.

### `rpt_owner_financial_position` — INVESTIGATED, NO REPAIR NEEDED (baseline text is dead)
Canonical baseline lines 2183–2197 contain an inline owner-expense selector inside `rpt_owner_financial_position` with the identical bare-EXISTS `property_owners` shape. It was carried on the open list as a fifth unrepaired site. Dumping the LIVE definition after the full 94-migration replay showed that text is **no longer live**: `20260909000014` and `20260909000016` rewrote the function so its period economics come from `public.calculate_owner_net_payout`, which migration18 had already moved onto the sole-owner predicate. The live body contains no `charged_to` and no `property_owners` reference at all. **No migration was written — there was no live defect to repair, and inventing one would have been a parallel implementation of an already-correct path.**

Proved behaviourally rather than by reading the diff: `owner-position-coownership-inheritance.test.ts`, 10 PASS. The report charges the unallocated co-owned 100 to neither owner, attributes the sole-era 70 to its historical owner, agrees exactly with its declared authority `calculate_owner_net_payout`, and structurally asserts the inline selector cannot return. A dedicated TEETH test re-executes the exact baseline bare-EXISTS query against the same fixture and shows it yields 170 + 100 = 270 for a 170 real cost — so the suite demonstrably fails if the defect is reintroduced, rather than passing vacuously.

The same suite locks the two contract properties the report exists for: settled entitlement (`settled_pending_net`, `paid_net`) is reported separately from proven cash (`paid_cash`, `paid_cash_proven_total`); missing cash evidence yields `paid_cash = null` with a disclosed `paid_cash_evidence_missing_count`, never a coerced zero and never a partial total presented as complete; and `remaining_payable` equals the all-time outstanding net rather than a single period's entitlement minus lifetime disbursement. The professional Arabic document mirrors this: every figure is labelled with its scope ("كل الفترات" vs "للفترة"), unproven cash renders "غير مكتمل الإثبات", and no all-period disbursement total is subtracted from a period entitlement anywhere in the document.

### Full LIVE sweep of owner-expense selectors (closes the co-ownership defect class)
Rather than continue site-by-site, every LIVE function in `public`/`app_private` that reads owner-charged expenses or `due_from_owner` AND touches `property_owners` was enumerated from `pg_proc` after a clean replay. Four carry the repaired predicate — `_owner_statement_expenses`, `calculate_owner_net_payout`, `owner_settlement_reservable_expenses`, `recalculate_owner_balance`. Four retain a `property_owners` reference, each inspected and each correct by design:

- `app_private.expense_correction_source_snapshot` — captures the ownership roster AS OF the expense date as immutable review evidence, and takes `for share` locks. It must record every owner, not pick one.
- `public.create_expense_with_journal_atomic` — validates that each explicitly supplied allocation names an owner who genuinely held the property at the expense date (`OWNER_EXPENSE_ALLOCATION_OWNER_FORBIDDEN`). Membership validation, not attribution.
- `public.s08_analyze_expense_misclassification` — DETECTS `owner_count > 1`; that is its purpose.
- `public.owner_unallocated_shared_expenses` — the visibility surface added by migration18, which exists precisely to list multi-owner expenses.

No unrepaired instance of the defect remains live.

## OMR 3-decimal integrity — `owner_balances` was silently truncating baisa (2026-09-09)
Found by the final audit, not by a failing test: `pnpm db0:audit` reported 28 MAJOR `DB0-07` financial-precision findings, four of them on `public.owner_balances` (`total_income`, `total_expenses`, `commission`, `net_balance` all `numeric(14,2)`).

**Proved against real SQL before repairing.** OMR carries 3 decimals (1000 baisa). `recalculate_owner_balance` already applies `public._r3(...)` to every figure it writes, so the correct 3-decimal value was computed and then destroyed by the column type:

| surface | value |
|---|---|
| expense posted | `12.345` |
| `owner_balances.total_expenses` (stored) | **`12.35`** |
| `rpt_owner_statement` (authoritative) | `12.345` |

A 0.005 — 5 baisa — disagreement between the persisted balance and the statement it reconciles to. This is the same drift shape migration19 removed, arriving through the schema instead of the query. A 0.007 line item is worse: it rounds to 0.01, a 43% error on that line.

`20260909000020_owner_balances_omr_precision.sql` widens the four columns to `numeric(18,3)`, matching `owner_funds_events`, `due_from_owners` and the settlement tables. Widening is lossless, so **no stored value changes and no history is rewritten**; existing rows keep their current (possibly already-truncated) figures until their owner's next lawful recalculation, exactly as migration19 did. Correcting a stored figure is a governed accounting action, not a side effect of a type change. Precedent: migration12 widened `maintenance_records.cost` the same way.

**A dependent-view hazard was caught by the migration's own precondition rather than by a broken deployment.** The first draft asserted no view depended on these columns; replay failed closed with `OWNER_BALANCE_PRECISION_PRECONDITION`, revealing that `public.s08_liability_balances_by_period` and `public.s08_subledger_gl_reconciliation` (layered on it) both read `net_balance`. The migration now captures each view verbatim — definition, `security_invoker`, owner, every ACL entry — drops them in dependency order, widens, and recreates them from the captured text, with a postcondition that both exist afterwards and a guard that aborts if any view other than those two appears. Verified after replay: both `security_invoker=true`, owner `postgres`, ACLs identical (`postgres`/`authenticated`/`service_role`), and both queryable (6 and 5 rows). Nothing about the views was retyped or redesigned.

Regression: `owner-balance-omr-precision.test.ts` 7 PASS — all four columns are `numeric(18,3)`; the third decimal survives the round trip (20.243, not 20.24); a 0.007-only amount is not rounded away; the stored balance equals the statement AND `calculate_owner_net_payout` to the baisa; `net_balance` stays consistent with `income − expenses − commission`; and no balance row was invented by the widen.

Audit effect: `db0:audit` financial-precision findings **28 → 24**, `owner_balances` findings **4 → 0**, BLOCKERS 0. The remaining 24 are on other tables and are recorded as open audit findings below, not silently accepted.

Verification: focused 7/7; full regression **550 files / 3927 tests, 0 failures** (sharded run 516 files / 3724 with shard 7 SIGKILLed — INFRA, never counted — re-run solo in 5 chunks, 34 files / 203 PASS, closing the suite); db0 7/7 with **95/95** migrations replayed from clean and idempotency PASS; Guardian PASS all layers; `test:supabase` 84 + 58 + 1 + 1 + 241; business-rules hash unchanged; hygiene PASS; typecheck PASS; no generated-type drift; build/PWA 28 precache entries; browser 6/6 desktop+mobile, retries 0.

### OMR precision, second pass — 7 genuinely lossy columns widened, 17 findings analysed as false positives
`20260909000021_money_columns_omr_precision.sql`. The audit rule flags any money column that is not exactly 3 decimals, which conflates three different situations. Each remaining finding was classified against its LIVE type instead of being swept:

- **UNCONSTRAINED `numeric` (no typmod) — NOT changed, deliberately.** All five `owner_settlements` money columns, `tenant_balances.balance_due`, `commissions.*` and `lands.*`. A bare `numeric` keeps every decimal it is given, so it cannot truncate baisa — verified by round-tripping 12.345 through each. Imposing `numeric(18,3)` here would be a NARROWING that could round POSTED settlement history, the precise thing that must never happen.
- **Deliberately wider scale — NOT changed.** `owner_agreements.commission_value`, `owner_agreement_versions.commission_value` and `fixed_monthly_daily_accruals.monthly_contract_amount` are `numeric(14,4)`; the contract-registration fee columns are `numeric(18,6)`. These are RATES and fee snapshots, not OMR amounts; narrowing them to 3 decimals would change agreed commercial terms.
- **Genuinely lossy `numeric(14,2)` — WIDENED (7 columns).** `contract_balances.total_paid/total_invoiced/balance_due`, `bank_accounts.opening_balance`, `units.rent_amount`, `utility_bills.paid_amount`, `properties.purchase_value`. Proved at the storage layer first: writing 12.345 into each returned 12.35, losing 5 baisa. `contract_balances` is the same defect shape as `owner_balances` — a persisted DERIVED table maintained by `recalculate_all_balances` and the invoice/allocation updaters, so the stored balance could disagree with the invoices and receipts backing it.

The same S08 view chain blocks `contract_balances.balance_due`; the capture/restore approach from migration20 is reused, but scoped to the exact `(table, column)` pairs being widened — an initial table-level capture wrongly pulled in `current_property_ownership`, `s08_master_lease_readiness` and `s08_retroactive_version_differences`, which depend on OTHER columns of the same tables and are unaffected by these ALTERs. No row is recomputed or backfilled.

Regression: `money-columns-omr-precision.test.ts` 6 PASS, which also PINS the classification so a future "fix all audit findings" sweep cannot narrow a settlement column or a commission rate by mistake.

Audit effect: DB0-07 findings **28 → 17**, BLOCKERS 0. The remaining 17 are the analysed false positives above, each safe by construction and now covered by an explicit test.

### Browser: a latent midnight date-boundary defect in `owner-payout-bank-cash.spec.ts` (found, diagnosed, fixed)
After migration21 this spec failed on desktop AND mobile, having passed two hours earlier. It was NOT caused by the migration, and a bisect-style check confirmed it: the spec and the whole `reconciliation/` service are untouched by every commit in this session.

Root cause, proved rather than assumed: the spec created its bank statement line with `new Date().toISOString().slice(0,10)` — the **UTC** day — while the settlement's `paid_at` is `now()` and `bankReconciliationService` matches it with `toCompanyDateKey(..., 'Asia/Muscat')`, the company timezone hardcoded in the fake backend. Between 20:00 and 24:00 UTC, Muscat has already rolled over, so the bank line said `2026-09-09` while the settlement resolved to `2026-09-10`. `datedSettlements` came back empty, the cash-evidence RPC was therefore never called, the injected 503 never happened, and the error state under test could not render — the UI correctly showed "no suggestions" instead. Running with `TZ=UTC` did not help, which confirms the company calendar (not the runner clock) owns the comparison.

Fixed in the SPEC, not the product: the bank day is now derived from the company calendar via `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Muscat' })`, matching exactly what the service compares against. The assertion was not weakened. Verified in the same failing window: 2/2 PASS, then the full owner set 6/6 PASS desktop+mobile at retries 0. **This defect made the suite unreliable for 4 hours of every day and would have recurred indefinitely.**

### OPEN AUDIT FINDING — remaining OMR precision drifts (recorded, not accepted)
`db0:audit` reports 17 MAJOR `DB0-07` findings after both precision migrations. Every one has been classified above and none is a live truncation defect: they are unconstrained `numeric` columns (lossless, and narrowing them would risk rounding posted history) or intentionally higher-scale rate/fee columns. They are listed for traceability, and `money-columns-omr-precision.test.ts` pins the classification so they cannot be "fixed" into a regression.

| column | current type |
|---|---|
| `commissions.amount` | `numeric` |
| `commissions.deal_value` | `numeric` |
| `contract_registration_records.fee_value_snapshot` | `numeric(18,6)` |
| `contract_registration_requirement_profiles.fee_value` | `numeric(18,6)` |
| `fixed_monthly_daily_accruals.monthly_contract_amount` | `numeric(14,4)` |
| `lands.purchase_price` | `numeric` |
| `lands.owner_price` | `numeric` |
| `lands.commission` | `numeric` |
| `owner_agreement_versions.commission_value` | `numeric(14,4)` |
| `owner_agreements.commission_value` | `numeric(14,4)` |
| `owner_settlements.amount` | `numeric` |
| `owner_settlements.gross_collected` | `numeric` |
| `owner_settlements.office_fee` | `numeric` |
| `owner_settlements.tax_amount` | `numeric` |
| `owner_settlements.net_payable` | `numeric` |
| `properties.current_value` | `numeric(14,2)` |
| `tenant_balances.balance_due` | `numeric` |

## SEC-003 / SEC-004 — two proven cross-company read leaks, found and closed (2026-09-10)

Migration `20260910000000_audit_log_and_users_company_isolation.sql`. Both defects were **reproduced with real SQL** under the `authenticated` role with real JWT claims before any fix was written, and the reproduction is preserved as `rentrix-app/src/features/auth/company-unscoped-tables-isolation.pglite.test.ts`.

### Why no existing gate caught them
The WP-DB0 isolation gate builds its worklist as `tables.filter(t => columns(t).has('company_id'))`. **A table with no `company_id` column was therefore never checked for cross-company reachability at all.** Ten tables sat in that blind spot. Eight are genuinely global reference data; two were leaking.

### SEC-003 — `public.users`
Policy `users_read_self_or_admin` was `id = auth.uid() OR is_admin()`. `is_admin()` proves the caller is an ADMIN **of their own current company** — it says nothing about the row being read. So an ADMIN of company A could enumerate **every user row in the database**, including users belonging only to company B: email, name, role, status, last_login. Fixed by fencing the admin branch through a new `public.user_is_member_of_active_company(uuid)` predicate (SECURITY DEFINER, pinned `search_path`, reads `company_members` only so it cannot recurse through the policy that uses it). Self-read is preserved verbatim, including the `(select auth.uid())` initplan form from `20260901000063`.

### SEC-004 — `public.audit_log`
Policy `admin_read_audit_log` was bare `is_admin()` on a table with **no `company_id` column at all** — so an ADMIN of company A could read the entire audit history of every company: actions, entity ids, notes, `old_value`/`new_value`. Only **1 of the 48 audit writers** recorded company attribution (in `details`). Fixed by adding `company_id` with an FK to `companies`, defaulting it from `current_company_id()` so all 48 existing writers become attributed without touching one of them, and fencing the read.

**Historical attribution was recovered only from evidence already in the row** (`details->>'company_id'`). Rows with no such evidence keep `company_id IS NULL` and are invisible to every company admin, because the fence yields NULL rather than true. Withholding unproven history is the fail-closed choice; assigning it to a guessed company would fabricate an audit trail. Nothing was deleted or rewritten — additive attribution over an append-only log.

Also made the log **physically** append-only for browser roles. `20260901000001` grants insert/update/delete on `audit_log` to `authenticated`; no permissive UPDATE/DELETE policy exists today so RLS already denied those verbs, but that safety was implicit and one future permissive policy would have silently unlocked history rewriting. Explicit RESTRICTIVE deny policies now make it gate-visible. Definer-owned writers are unaffected.

### The gate blind spot itself is closed
`scripts/db0/lib/isolation.mjs` now iterates tables that lack `company_id` and requires each to be declared in an `UNSCOPED_TABLES` allow-list with a written justification, emitting `UNSCOPED_TABLE_UNDECLARED` otherwise. **A new unscoped table now fails the gate by default instead of inheriting a silent exemption.** Verified by negative control: removing one entry reproduces the failure.

### Evidence
- Reproduction is real: with the migration temporarily moved aside, **6 of 10 tests fail**; with it in place, **10/10 pass**. Not a vacuous suite.
- `pnpm db0:gate` **7/7** (isolation now covers 107 tenant tables / 254 policies, up from 106/252 — `audit_log` joined the checked set).
- Independent sweep of all 252 policies: **0** mention `company_id` without binding it to the caller, **0** tautological fences (`company_id IS NOT NULL` / `company_id = company_id`).
- `pnpm typecheck` clean · `check:migration-hygiene` OK · `check:business-rules` verified · `db:guardian` PASS.
- Auth/audit/governance/admin-support suites **283/283**. Full sharded regression **552 files / 3,943 tests, 0 assertion failures** (one suite-level 60s hook timeout in `owner-statement-company-isolation.test.ts` under 6-way parallel load; passes 4/4 in 5.8s standalone — a load artifact, not a regression).
- `password_hash` on `public.users` is vestigial: never written by any migration or application path (Supabase Auth owns credentials). The test asserts the column is empty for **every** row rather than that one read returned null, which would have been an unfalsifiable assertion.

## Final audit — UI/UX, RTL, responsiveness, accessibility, PWA cache privacy, dead code (2026-09-10)

### The browser suite needs TWO different builds — running the wrong one produces 26 false failures
A whole-spec browser failure was traced to build configuration, not to the product. `e2e/maintenance-workspace-polish.spec.ts` reported **26 failed** against the production preview, with every page stuck on a login screen carrying disabled inputs. The cause: 12 specs drive the app through the harness route `/login?e2e-<name>=1`, which is served by `src/routes/_auth.login.e2e-fixture.tsx` and its feature fixtures. Those fixtures are **deliberately stripped from a production build** — verified by grepping the emitted bundle — which is the correct security posture, since an e2e bypass route must never ship. Rebuilding with `VITE_E2E=true` (matching `playwright.config.ts`'s `webServer.env`) put the fixtures back and the same spec returned **26/26 PASS**.

Practical rule for this repository, so the trap is not re-entered: **`pnpm build` + preview proves the production shell (PWA/SW/offline); `VITE_E2E=true` build + preview proves the fixture-driven UI specs.** Neither build can prove the other's specs, and a login screen with disabled inputs is the signature of running a fixture spec against a production bundle — an INFRASTRUCTURE signature, never a product verdict. Affected specs: `capture-evidence`, `contracts-entity-table`, `design-system-verification`, `maintenance-workspace-polish`, `new-modules-workspace`, `owners-workspace`, `round1-evidence-capture`, `round1-screenshot-validity`, `service-providers-workspace`, `ui-operational-real-redesign`, `ux-foundation`, `wave4-design-system-390`.

### Results
- **UI/UX + RTL + responsiveness + touch targets — PASS.** `maintenance-workspace-polish` 26/26 (5 viewports 360/390/430/768/1440 × light+dark: no horizontal overflow, filter bar contained, ≥44px card actions). `ux-foundation` + `wave4-design-system-390` + `owners-workspace` + `contracts-entity-table` 31/32 (1 skipped). `new-modules-workspace` + `service-providers-workspace` + `ui-operational-real-redesign` + `design-system-verification` 56 passed desktop+mobile (8 skipped). Covers `dir="rtl"`, the canonical dark background token, unified `PageHeader`, and mobile Dialog scroll/action visibility.
- **Accessibility — PASS.** `src/components/ui/primitives.axe.test.tsx` 15/15. This file is on the sharded runner's `EXCLUDED` list, so it never runs in the regular regression; it was run explicitly here and is clean. Plus `readiness-smoke` keyboard-focus traversal of the unauthenticated login form.
- **PWA / offline / cache privacy — PASS, proven at runtime not by config.** `pwa-production-contract` was skipped in every previous run because it is gated on `E2E_PRODUCTION=true`; it was executed properly here against a real production build: **2/2 PASS** desktop+mobile. It asserts the worker installs and takes control, `/offline.html` is precached, **no `/rest/v1/`, `/auth/v1/` or `/storage/v1/` response is present in ANY cache store**, and going offline serves the Arabic `dir="rtl"` offline page with zero forms. Independently confirmed by grepping the emitted `dist/public/sw.js` precache manifest for private/API entries — none. Config review agrees: `navigateFallback: null` with an explicit `NetworkOnly` navigation rule, and `StaleWhileRevalidate` scoped to `style|script|worker|font` destinations only. `pwa-safety-contract` + `platform-security-contract` + `brand-contract` 31/31.
- **Dead code and unused dependencies — NONE FOUND.** All 8 runtime dependencies are referenced from `src/` or config. Across **683 non-test source files, 0 have no inbound reference** (alias and relative import forms both checked, including `e2e/` and `index.html` as entry surfaces). Nothing was deleted, because there was nothing unreferenced to delete.

## Intermittent bootstrap stall — diagnosis advanced, root cause NOT yet provable locally (2026-09-09)
The standing hypothesis was an async auth-callback deadlock: a Supabase `onAuthStateChange` handler that `await`s a PostgREST call re-enters the GoTrue Web Lock and stalls the last `company_members` request on full-page navigation. **That hypothesis is now structurally excluded, by inspection rather than by guessing.** Both registered listeners — `src/hooks/use-auth.tsx:88` and `src/features/onboarding/useOnboarding.ts:66` — contain ZERO `await`/`async` tokens in their callback bodies (`grep -c` = 0 for each). They only call `setState`. A callback that never awaits cannot hold the auth lock across an I/O round trip, so the deadlock class cannot occur on these paths. No auth or Web Locks code was changed to reach this conclusion.

A fail-closed mitigation is already deployed and is NOT a fallback that hides a wrong answer: `withCompanyResolutionTimeout` (`src/hooks/use-company.tsx:17`) rejects with `ACTIVE_COMPANY_ERROR` after a bounded wait and routes the operator to a recovery screen instead of an indefinite blank workspace. It wraps the `company_members` read, the `refreshSession` retry and the server claim sync. It converts a hang into a visible, recoverable error; it never substitutes a fabricated company or a partial result. Covered by `use-company.test.tsx` 10 PASS, including a deliberately stalled operation.

**Reproduction attempt (negative result, honestly reported):** `login-flow` + `readiness-smoke` were run for 2 complete rounds across chromium-desktop/tablet/mobile with `--retries=0` — 12 passed per round, 13.7 min per round, no stall observed. A third round was started but cut off by the harness time limit, so it is reported as INCOMPLETE, not as a pass. **Two clean rounds do not prove the defect is fixed**; the defect is intermittent and was originally seen on full-page navigation in an authenticated session.

**The real blocker is now identified and is a COVERAGE gap, not a code defect.** Of 29 e2e specs, the only ones that authenticate are guarded by `test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, …)` — those are exactly the 3 skipped tests in every run above. **No local browser test ever reaches the authenticated app shell, so the code path where the stall was observed is not exercised at all locally.** Root-causing this requires either seeded staging credentials (`E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`) or the hosted QA environment recorded as an external blocker. Until then: hypothesis excluded, mitigation proven, root cause OPEN and explicitly unproven.

## Owner financial chain — verification status of the remaining links (2026-09-09)
Each link below was checked against the LIVE post-replay definition, not against baseline text, because migrations 12–19 have rewritten several of these bodies and the baseline is stale in places.

- **`rpt_owner_statement` authority and movements — CLOSED by `20260909000017`, re-verified live.** The four defects it documents are genuinely gone from the deployed body: settlement movements key on `s.paid_at` (not the legacy `s.date`), value on `app_private.owner_settlement_paid_cash` with `net_payable` as the fallback (not the legacy frozen `s.amount`), filter `status='PAID' AND paid_at IS NOT NULL` (so a CANCELLED settlement is no longer shown as a deduction), and the expense source is the company-scoped 4-argument `_owner_statement_expenses(owner, from, to, company)`. Cash is never inferred from `net_payable - offset_applied`. Unproven history is disclosed in the movement label ("صرف غير مثبت بالمستندات") and an offset-reduced disbursement is labelled ("بعد مقاصة مستحقات على المالك") rather than silently netted. Movement taxonomy is exactly `payment` / `expense` / `settlement`.
- **Opening/closing balance and historical cutoff — ALREADY CORRECT, governed, and fail-closed.** `public.owner_funds_event_cutovers` carries an APPROVED, S08-review-backed `opening_balance` with maker/checker enforced in a CHECK constraint (`approved_by <> created_by`, `approval_request_id` required, 3-decimal rounding). `wp05_subledger_owner_payables` uses `opening_balance + Σ post-cutover deltas`; asking for a position BEFORE the cutover raises `OWNER_FUNDS_PRE_CUTOVER_REPORT_REVIEW_REQUIRED` (23514) instead of inventing or zeroing a missing balance. With no cutover but existing events it sums events only; with neither it falls back to positive `owner_balances` — no implicit blend. Regression: `owner-agency-invoice-accounting.test.ts` 17 PASS, including "fails closed for a historical 2000 position until an S08-backed cutover exists".
- **Correcting wrong owner-funds events append-only — ALREADY ENFORCED IN THE DATABASE.** `trg_owner_funds_event_immutable` fires BEFORE DELETE OR UPDATE on `public.owner_funds_events`. Probed live: both UPDATE and DELETE raise `OWNER_FUNDS_EVENT_IMMUTABLE: owner-funds control events are append-only; use a compensating entry`. The compensating direction is a first-class part of the model, not a convention — `source_type` admits `INVOICE_CREDIT_REVERSAL`, `RECEIPT_VOID_REVERSAL` and `OWNER_OFFSET_REVERSAL`, each written as a NEW event referencing the original's id. The original is never rewritten.
- **Post-payment adjustment / S08–S09 correction workflow — VERIFIED, original source preserved.** `s09_apply_correction` posts a NEW journal batch via `post_journal_event` and records it as `correction_journal_batch_id` alongside the retained `original_journal_batch_id`; it never updates or deletes the original posting. The correction row carries `before_evidence`/`after_evidence`, an idempotency unique index, and a period FK, and writes are gated by the `malik.s09_correction_change_authorized` flag. `s09_create_correction_draft` refuses an expense source already adopted into the receivable subledger (`OWNER_EXPENSE_USE_RECEIVABLE_ADJUSTMENT`, 23514, added by migration12) so an adopted expense is corrected through the receivable adjustment path rather than a second competing mechanism. Regression: 53 PASS across `expense-correction-source-control` (16), `expense-history-diagnostic` (12), `owner-expense-source` and `collections-payments-period-close`, including "applies an independently approved and validated pre12 S09 plan after upgrade without changing its source" and "preserves old posted corrections and refuses to trust pre-upgrade caller snapshot JSON".

## G6 — governed historical adoption (owner-funds cutover): CLOSED

**Verification first, build second.** The prior ledger listed "governed adoption/allocation workflow UI" as NEXT but unconfirmed. Inspection result:

- **ALLOCATION UI ALREADY EXISTS — resolved with evidence, nothing built.**
  `rentrix-app/src/features/financials/expenses/owner-expense-allocation-fields.tsx`, hosted in
  `rentrix-app/src/features/financials/components/expenses-section.tsx` (when `charged_to=OWNER`) and
  `rentrix-app/src/features/maintenance/components/maintenance-detail-resolve-overlays.tsx`, with browser coverage
  `rentrix-app/e2e/owner-expense-source.spec.ts`. No parallel surface was created.
- **GOVERNED ADOPTION SURFACE WAS GENUINELY ABSENT — one canonical surface built.**
  `public.create_owner_funds_cutover_atomic` / `public.approve_owner_funds_cutover_atomic` are GRANTED to
  `authenticated` and enforce role + S08-approval + maker/checker + stale-baseline refusal + idempotency, but had
  **zero application call sites** (only PGlite suites and generated types).

### Files (single capability = single implementation)
| File | Role |
|---|---|
| `rentrix-app/src/features/owners/services/owner-funds-cutover-service.ts` | fail-closed evidence parser, `p_payload` RPC envelope, Arabic guard translation, disclosure authority |
| `rentrix-app/src/features/owners/components/OwnerFundsCutoverPanel.tsx` | the surface: derived baseline + evidence, maker/checker, stale/immutability disclosure, role-scoped rendering |
| `rentrix-app/src/features/owners/components/OwnerSettlementWorkspace.tsx` | hosts the panel once (no second route, no parallel tree) |
| `rentrix-app/src/features/owners/services/owner-funds-cutover-service.test.ts` | 22 unit assertions (pure) |
| `rentrix-app/src/features/owners/services/owner-funds-cutover-adoption.pglite.test.ts` | 12 real-PostgreSQL assertions against the deployed function bodies |

### Defects found by building the surface against real SQL (both fixed)
1. **False failure on a legitimate idempotent re-submission.** The deployed idempotent branch returns the EXISTING row nested under a `cutover` key (`{success, idempotent:true, cutover:{...}}`) with NO top-level `status`; a flat-shape-only parser reports `OWNER_FUNDS_CUTOVER_STATUS_UNKNOWN` for a lawful response. Parser now reads both envelopes; the lawful-status requirement is unchanged (regression-locked in the unit suite).
2. **Incorrect guidance, then corrected.** An initial message told the approver to "create a fresh draft from a new S08 review" after a stale-baseline refusal. Real SQL disproved it: there is exactly ONE baseline row per company (`PRIMARY KEY (company_id)`) and re-create returns the existing row idempotently, so the app CANNOT re-baseline over a drifted draft. Message and test now state that truthfully; a regression test proves re-create neither adds a row nor re-derives the balance.

### Not proven here (state plainly)
- `OWNER_FUNDS_CUTOVER_STALE_REVIEW_REQUIRED` now has real-SQL coverage **locally/in replay** (it had none before). Hosted behaviour under concurrent traffic (G3/G4) is still not exercised.
- No browser/E2E spec was executed for this panel in this session (see HANDOFF §E for what was measured).
- Hosted repo↔production parity was **not** re-measured in this session; only local gates/replay were.
