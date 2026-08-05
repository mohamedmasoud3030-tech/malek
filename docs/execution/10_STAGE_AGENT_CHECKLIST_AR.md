# MALEK — قائمة تنفيذ المراحل العشر للوكيل

> **الملف الذي يحق للوكيل تعديله:** هذا الملف فقط لتعليم تنفيذ البنود.
>
> **ممنوع قطعًا:** تعديل `10_STAGE_REVIEW_LEDGER_AR.md`، تعديل القرارات، توسيع المرحلة، استخدام فرع قديم، أو ادعاء نجاح دون Evidence.

## بروتوكول العمل الإلزامي

1. قبل كل مرحلة: `git fetch --all --prune` ثم إثبات أن الفرع بدأ من أحدث `origin/main`.
2. مرحلة واحدة فقط لكل PR. لا تخلط Migration من مرحلة لاحقة.
3. اقرأ ADR 0011 وسجل القرارات والخطة الآلية قبل كتابة الكود.
4. لا تستخدم `business/domain-contract-foundation` أو أي فرع مغلق كمصدر كود. أعد التنفيذ من `main`.
5. لا تغيّر Migration تاريخية؛ استخدم Forward Migration جديدة وRollback في المسار المعتمد.
6. لا تعلم `[x]` إلا بعد إرفاق Evidence قابل لإعادة التشغيل.
7. لا تعلم أي بند Review. المراجع وحده يملك ذلك.
8. عند اكتشاف فجوة: أضف Finding في وصف PR، ولا تنفذها خفية خارج المرحلة.
9. أي فشل أمني/عزل/توازن/Idempotency يوقف الدمج، لكنه لا يغيّر القرار.
10. لا تعتبر المرحلة مكتملة حتى تكون كل بنود Agent وReviewer مكتملة وPR مدمج و`main` أخضر.

## معنى Evidence

Evidence ليس جملة «تم». يجب أن يكون واحدًا أو أكثر من: رابط Commit/PR، Migration محددة، اختبار باسم واضح، CI run، Query Output، Before/After report، أو Screenshot/Artifact عند الحاجة.

---

## S01 — Baseline, governance and workspace cleanup

**الحالة:** مكتملة ومراجعة على `main@ae645d15e3cdcdf0310e694941f72b7fcd1b5eb7`

- [x] **S01-T01** — Verify latest main SHA and record it as the only implementation base.
  - Evidence المطلوب: GitHub main commit URL and compare showing branch starts exactly from it.
- [x] **S01-T02** — Close or merge every open PR; no parallel accounting/business PR remains.
  - Evidence المطلوب: GitHub query showing zero open PRs.
- [x] **S01-T03** — Lock canonical business and contract rules with owner protection and checksum.
  - Evidence المطلوب: PR #1344, canonical guard success, files on main.
- [x] **S01-T04** — Close every BLOCKED/PROVISIONAL decision in ADR 0011 and final decision register.
  - Evidence المطلوب: Decision register reports blocked_decisions=0 and provisional_decisions=0.
- [x] **S01-T05** — Publish immutable 10-stage master plan plus separate agent and reviewer ledgers.
  - Evidence المطلوب: Plan JSON, checksum, both ledgers and validation script on main.
- [x] **S01-T06** — Mark stale experimental business branch as superseded and forbid reuse in agent instructions.
  - Evidence المطلوب: Plan and PR text explicitly prohibit cherry-picking or merging the stale branch.
- [x] **S01-T07** — Run documentation, integrity and secret checks for governance-only changes.
  - Evidence: PR #1345 — Canonical Business Rules Guard, Execution Plan Guard, CI, SonarCloud, Browser Readiness and Release Blocker Gate all succeeded on `b741328385569ff7927e1ee5f26a0f5fbf057689`.
- [x] **S01-T08** — Merge governance PR and verify main contains the exact protected files.
  - Evidence: PR #1345 merged as `ae645d15e3cdcdf0310e694941f72b7fcd1b5eb7`; post-merge fetch from `main` verified the decision register and zero open PRs.

---

## S02 — Tenant isolation, settlement integrity and safe operational imports

**الحالة عند إنشاء الخطة:** تنفيذ قديم/جزئي يحتاج استكمالًا وتحققًا

- [ ] **S02-T01** — Inventory every SECURITY DEFINER financial/contract RPC and classify company-scope, grants and search_path.
  - Evidence المطلوب: Generated inventory with function signature, owner, grants, search_path and company predicate.
- [ ] **S02-T02** — Harden update_owner_agreement_atomic with company-scoped SELECT FOR UPDATE and UPDATE; owner_id immutable.
  - Evidence المطلوب: Migration, rollback, cross-company denial test and commission range tests.
- [ ] **S02-T03** — Create owner_settlement_payment_links and owner_settlement_expense_links with active partial unique reservations.
  - Evidence المطلوب: Migration, indexes, RLS, RPC integration and duplicate-reservation tests.
- [ ] **S02-T04** — Reserve settlement inputs atomically at draft; release on cancel; keep reservation after payment.
  - Evidence المطلوب: Concurrent PGLite/pgTAP tests and state-transition tests.
- [ ] **S02-T05** — Re-derive settlement totals at approval and payment and reject stale or changed inputs.
  - Evidence المطلوب: Tamper/stale-input tests with deterministic error codes.
- [ ] **S02-T06** — Remove direct browser writes for commissions and protected financial mutations; use RPC-only paths.
  - Evidence المطلوب: RLS/grant diff, frontend service diff, anon/user negative tests.
- [ ] **S02-T07** — Rebuild bank CSV import fail-closed: any invalid/ambiguous row blocks batch; no silent partial success.
  - Evidence المطلوب: Parser/service/RPC tests, server authoritative counts, OMR 3dp and both debit+credit rejection.
- [ ] **S02-T08** — Add server file/row limits, deterministic fingerprint, idempotent retry and exact duplicate behavior.
  - Evidence المطلوب: Migration contract tests and retry/concurrency tests.
- [ ] **S02-T09** — Move rollback files to canonical rollback path and pass migration hygiene/round-trip gates.
  - Evidence المطلوب: Migration hygiene output and rollback evidence.
- [ ] **S02-T10** — Complete security review with zero cross-company writes and no unauthorized EXECUTE grants.
  - Evidence المطلوب: Release-blocker database/auth runs and reviewer matrix.

---

## S03 — Canonical GL, chart of accounts and accounting periods

**الحالة عند إنشاء الخطة:** تنفيذ قديم/جزئي يحتاج استكمالًا وتحققًا

- [ ] **S03-T01** — Audit existing GL schema against ADR 0010 and ADR 0011; produce gap matrix before SQL.
  - Evidence المطلوب: Object-by-object matrix with keep/change/add and no unsupported claims.
- [ ] **S03-T02** — Make account identity company-scoped with account_type, normal_balance, currency and precision.
  - Evidence المطلوب: Forward migration, rollback and uniqueness tests for (company_id, account_no).
- [ ] **S03-T03** — Seed required control/revenue/expense/master-lease accounts idempotently per company.
  - Evidence المطلوب: Seed migration and repeated-run idempotency tests.
- [ ] **S03-T04** — Enforce batch states DRAFT/POSTED/REVERSED and immutable posted entries.
  - Evidence المطلوب: Constraints/triggers/RPCs and update/delete denial tests.
- [ ] **S03-T05** — Require company_id, source_type, source_id, event_id, effective_date, posting_date and reversal linkage.
  - Evidence المطلوب: Schema contract and posting tests.
- [ ] **S03-T06** — Enforce debit=credit at OMR 0.001 before posting and prohibit free-form browser journals.
  - Evidence المطلوب: Balanced/unbalanced rounding tests and frontend boundary tests.
- [ ] **S03-T07** — Implement monthly OPEN/SOFT_CLOSED/HARD_CLOSED periods with irreversible hard close.
  - Evidence المطلوب: Period lifecycle tests and permission tests.
- [ ] **S03-T08** — Post late events to first open period while preserving original effective date and late flag.
  - Evidence المطلوب: Closed-period acceptance scenarios.
- [ ] **S03-T09** — Make every posting RPC idempotent by event_id and safe under concurrent retries.
  - Evidence المطلوب: Concurrency tests showing one batch only.
- [ ] **S03-T10** — Publish GL posting API contract and account-resolution runbook.
  - Evidence المطلوب: Docs linked to tested RPC signatures and error codes.

---

## S04 — Owner-agency contracts, billing, collections and settlements

**الحالة عند إنشاء الخطة:** لم يبدأ التنفيذ المعتمد

- [ ] **S04-T01** — Add versioned owner agreements with operating_model, collection_role and all required commercial terms.
  - Evidence المطلوب: Migration, RLS, RPCs, rollback and version coverage tests.
- [ ] **S04-T02** — Snapshot agreement version and collection_role into each activated tenant contract.
  - Evidence المطلوب: Activation RPC and historical immutability tests.
- [ ] **S04-T03** — Implement full contract lifecycle, maker-checker approval and signature evidence gates.
  - Evidence المطلوب: State-machine tests and activation denial tests.
- [ ] **S04-T04** — Materialize contractual billing schedules at activation; preview in draft and freeze on activation.
  - Evidence المطلوب: Schedule generation tests for all payment cycles and partial periods.
- [ ] **S04-T05** — Generate invoices from schedule without treating schedule rows as invoices or GL entries.
  - Evidence المطلوب: Traceability tests schedule→invoice→allocation.
- [ ] **S04-T06** — Implement OWNER_IS_CREDITOR postings: collection to Owner Funds Payable; rent remains operational KPI.
  - Evidence المطلوب: 1,000 OMR / 10% acceptance scenario and partial payment tests.
- [ ] **S04-T07** — Implement OFFICE_IS_CREDITOR postings: invoice Tenant Receivable and owner obligation; collection clears AR.
  - Evidence المطلوب: Full and partial payment/reversal tests.
- [ ] **S04-T08** — Recognize RATE on collection and FIXED_MONTHLY by daily accrual, server-side only.
  - Evidence المطلوب: Month-boundary, leap-year, partial-service and rounding tests.
- [ ] **S04-T09** — Implement documented offset order and reserve behavior in owner settlement.
  - Evidence المطلوب: Settlement calculation tests and insufficient-payable Due from Owner tests.
- [ ] **S04-T10** — Complete owner statement with source drill-down and no DRAFT-as-paid misclassification.
  - Evidence المطلوب: Report reconciliation and UI tests.

---

## S05 — Expenses, deposits, fees, tax, termination and refunds

**الحالة عند إنشاء الخطة:** تنفيذ قديم/جزئي يحتاج استكمالًا وتحققًا

- [ ] **S05-T01** — Separate office, owner and tenant-recoverable expenses with one canonical posting path each.
  - Evidence المطلوب: Posting matrix tests and no duplicate Tenant Receivable tests.
- [ ] **S05-T02** — Implement deposit liability receipt, refund, application and compensating reversal workflows.
  - Evidence المطلوب: Allocation tests for arrears, owner damage and office damage.
- [ ] **S05-T03** — Require beneficiary, evidence and approved claim before deposit application.
  - Evidence المطلوب: Permission/validation tests and audit evidence.
- [ ] **S05-T04** — Implement brokerage, renewal and setup fee recognition plus deferred revenue before milestones.
  - Evidence المطلوب: Activation/cancellation/refund scenarios.
- [ ] **S05-T05** — Implement staff/external broker commission payable, payment, cancellation and reversal.
  - Evidence المطلوب: Eligibility, contingent-on-collection and double-payment tests.
- [ ] **S05-T06** — Implement versioned company tax profile/tax codes and line-level tax snapshots; no hard-coded rate.
  - Evidence المطلوب: Effective-date and incomplete-profile posting-block tests.
- [ ] **S05-T07** — Implement late-fee engine disabled by default, no compounding, grace period, cap and waiver audit.
  - Evidence المطلوب: Boundary, cap, waiver and tax-code tests.
- [ ] **S05-T08** — Implement early termination workflow; cancel future schedule rows without deleting history.
  - Evidence المطلوب: Termination-date, accrued preservation, optional charge and final inspection tests.
- [ ] **S05-T09** — Implement credit notes, voids and cash refunds before/after owner settlement/payment.
  - Evidence المطلوب: Before settlement, approved-not-paid and post-payment Due from Owner tests.
- [ ] **S05-T10** — Prove all financial records are append-only and every reversal links to original source.
  - Evidence المطلوب: Mutation-denial and audit-chain tests.

---

## S06 — Independent master-lease accounting module

**الحالة عند إنشاء الخطة:** لم يبدأ التنفيذ المعتمد

- [ ] **S06-T01** — Create head-lease contracts and payment schedules separate from owner agreements/settlements.
  - Evidence المطلوب: Schema boundaries and forbidden FK/account tests.
- [ ] **S06-T02** — Capture commencement, lease term, options, incentives, direct costs, restoration and discount-rate snapshot.
  - Evidence المطلوب: Validation and calculation fixture tests.
- [ ] **S06-T03** — Recognize initial ROU asset and lease liability atomically.
  - Evidence المطلوب: Initial-measurement acceptance scenarios.
- [ ] **S06-T04** — Generate effective-interest liability schedule and straight-line ROU depreciation.
  - Evidence المطلوب: Independent recomputation fixtures and 0.001 balance tests.
- [ ] **S06-T05** — Implement index/rate remeasurement and variable payment treatment.
  - Evidence المطلوب: Remeasurement and expense-when-incurred tests.
- [ ] **S06-T06** — Implement short-term policy election by asset class with 12-month and no-purchase-option gates.
  - Evidence المطلوب: Election consistency and disqualification tests.
- [ ] **S06-T07** — Implement lease modification, separate-lease and partial-termination rules.
  - Evidence المطلوب: Modification fixtures with ROU/liability/gain-loss outputs.
- [ ] **S06-T08** — Post sublease rent separately and expose vacancy loss to office results.
  - Evidence المطلوب: Occupied/vacant period scenarios.
- [ ] **S06-T09** — Block owner-settlement accounts from every master-lease posting template.
  - Evidence المطلوب: Account allowlist tests.
- [ ] **S06-T10** — Publish operational vs full-accounting report labels and disclosure until all acceptance tests pass.
  - Evidence المطلوب: UI/report wording tests.

---

## S07 — Financial reports, subledger reconciliation and close controls

**الحالة عند إنشاء الخطة:** تنفيذ قديم/جزئي يحتاج استكمالًا وتحققًا

- [ ] **S07-T01** — Build trial balance, income statement, balance sheet, GL and cash flow from posted GL only.
  - Evidence المطلوب: Report queries and balance/reversal tests.
- [ ] **S07-T02** — Build tenant AR, owner funds, deposits, due-from-owner and broker commission subledgers.
  - Evidence المطلوب: Source-level drill-down tests.
- [ ] **S07-T03** — Implement mandatory control-account reconciliation for every financial subledger.
  - Evidence المطلوب: Zero-difference fixtures and deliberate-mismatch alerts.
- [ ] **S07-T04** — Exclude VOID/CANCELLED and prevent DRAFT settlement from appearing paid.
  - Evidence المطلوب: Status-filter regression tests.
- [ ] **S07-T05** — Keep rent roll and managed-rent totals operational, never office revenue.
  - Evidence المطلوب: Label/query tests and GL comparison.
- [ ] **S07-T06** — Complete cash-flow coverage for deposits, owner payouts, commissions and all bank/cash accounts.
  - Evidence المطلوب: Cash-flow tie-out tests.
- [ ] **S07-T07** — Implement bank reconciliation statuses with truthful language and manual-review audit.
  - Evidence المطلوب: Imported/suggested/reviewed/matched state tests.
- [ ] **S07-T08** — Add period-close checklist and prevent hard close when reconciliations differ.
  - Evidence المطلوب: Close-block tests and signed close evidence.
- [ ] **S07-T09** — Add owner/tenant/property/agreement dimensions to financial drill-down where applicable.
  - Evidence المطلوب: Dimension completeness tests.
- [ ] **S07-T10** — Publish reconciliation dashboard with actionable differences, not silent totals.
  - Evidence المطلوب: UI/E2E tests.

---

## S08 — Read-only historical analysis

**الحالة عند إنشاء الخطة:** لم يبدأ التنفيذ المعتمد

- [ ] **S08-T01** — Create read-only analysis script/migration that writes no financial data.
  - Evidence المطلوب: Static and runtime proof of no INSERT/UPDATE/DELETE to financial tables.
- [ ] **S08-T02** — Inventory paid settlements and duplicate payments/expenses across settlements.
  - Evidence المطلوب: Company/owner/property/agreement/source detail extract.
- [ ] **S08-T03** — Calculate Owner Funds Payable, Due from Owner, deposits and broker liabilities by period.
  - Evidence المطلوب: Reproducible CSV/JSON output and checksums.
- [ ] **S08-T04** — Find owner/tenant expenses misposted to company expense and duplicate tenant receivables.
  - Evidence المطلوب: Source-linked exception report.
- [ ] **S08-T05** — Find deposit deductions, refunds and damage allocations lacking valid evidence/allocation.
  - Evidence المطلوب: Exception report with contract and beneficiary.
- [ ] **S08-T06** — Find deleted/voided invoices with surviving postings and orphaned postings.
  - Evidence المطلوب: Bidirectional orphan report.
- [ ] **S08-T07** — Find retroactively changed agreements/contracts and classify required catch-up treatment.
  - Evidence المطلوب: Version-diff report.
- [ ] **S08-T08** — Inventory master leases and measure missing ROU/liability data readiness.
  - Evidence المطلوب: Lease readiness report.
- [ ] **S08-T09** — Compute every subledger-to-GL difference by company and accounting period.
  - Evidence المطلوب: Signed reconciliation report.
- [ ] **S08-T10** — Freeze analysis outputs with checksums and obtain explicit approval before correction.
  - Evidence المطلوب: Approval record and immutable artifact links.

---

## S09 — Append-only historical correction

**الحالة عند إنشاء الخطة:** لم يبدأ التنفيذ المعتمد

- [ ] **S09-T01** — Create approved correction plan per company, period and source class from frozen analysis.
  - Evidence المطلوب: Mapping from each exception to planned correction batch.
- [ ] **S09-T02** — Generate append-only correction batches; never update/delete posted history.
  - Evidence المطلوب: SQL/RPC static checks and reversal-only rollback.
- [ ] **S09-T03** — Correct duplicate owner payouts as Due from Owner or explicit recovery claims.
  - Evidence المطلوب: Before/after owner balances and source links.
- [ ] **S09-T04** — Reclassify owner expenses and correct Owner Funds Payable.
  - Evidence المطلوب: Before/after GL and subledger tie-out.
- [ ] **S09-T05** — Correct historical office revenue, deferred fees and tax using approved event mapping.
  - Evidence المطلوب: Period-by-period impact report.
- [ ] **S09-T06** — Correct deposits and tenant receivables without duplicate claims.
  - Evidence المطلوب: Deposit/AR reconciliation.
- [ ] **S09-T07** — Handle master-lease corrections in separate batches and disclosures.
  - Evidence المطلوب: Lease-specific before/after schedules.
- [ ] **S09-T08** — Attach source_type/source_id/event_id and approval to every correction batch.
  - Evidence المطلوب: 100% metadata completeness query.
- [ ] **S09-T09** — Produce signed before/after statements and reconciliations for each company/period.
  - Evidence المطلوب: Immutable report artifacts.
- [ ] **S09-T10** — Prove full rollback by reversal batches in staging.
  - Evidence المطلوب: Round-trip totals and audit chain.

---

## S10 — Test, pilot, deployment and controlled release

**الحالة عند إنشاء الخطة:** لم يبدأ التنفيذ المعتمد

- [ ] **S10-T01** — Build mandatory acceptance suite for isolation, idempotency, periods, reversals, VAT, OMR 3dp and all four operating models.
  - Evidence المطلوب: Named test matrix with green run links.
- [ ] **S10-T02** — Add owner-agency 1,000/10%, partial payment, fixed-fee and refund scenarios.
  - Evidence المطلوب: Deterministic expected journal and subledger outputs.
- [ ] **S10-T03** — Add expense, deposit, damage, brokerage, termination and master-lease scenarios.
  - Evidence المطلوب: Green acceptance fixtures.
- [ ] **S10-T04** — Run full migration up/down/round-trip and live staging pgTAP/PGLite suites.
  - Evidence المطلوب: Artifacts and logs.
- [ ] **S10-T05** — Run typecheck, lint, build, unit, integration, financial, E2E mobile/desktop and accessibility gates.
  - Evidence المطلوب: Green CI with exact SHAs.
- [ ] **S10-T06** — Create anonymized production-like pilot database and dual-run comparison without double-posting.
  - Evidence المطلوب: Data sanitization proof and comparison reports.
- [ ] **S10-T07** — Pilot one company for a full accounting period with daily reconciliation.
  - Evidence المطلوب: Daily signed checklist and zero unexplained differences.
- [ ] **S10-T08** — Obtain accountant/product-owner sign-off and document unresolved non-blocking risks.
  - Evidence المطلوب: Approval record.
- [ ] **S10-T09** — Deploy progressively with monitoring, rollback-by-reversal and incident runbook.
  - Evidence المطلوب: Deployment records and monitoring screenshots/logs.
- [ ] **S10-T10** — Perform post-release verification on main/production and mark reviewer ledger complete.
  - Evidence المطلوب: Production smoke, reconciliation and final release SHA.

## قاعدة الإغلاق

لا يغيّر الوكيل حالة أي مرحلة إلى COMPLETE. بعد تعليم كل بنود Agent يكتب في PR: `READY_FOR_INDEPENDENT_REVIEW` وينتظر مراجعة منفصلة.
