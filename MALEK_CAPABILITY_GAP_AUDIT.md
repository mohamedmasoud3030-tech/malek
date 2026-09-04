# MALEK — Capability Discovery & Product Gap Audit

**Type:** Backend → frontend capability census. **Documentation only.** No application source was modified by this audit.
**Authoritative baseline:** `main @ 87c55fc1f245a8726256826e669422a54f249314` (verified `git rev-parse origin/main`).
**Relationship to PR #1785:** complementary, not a replacement. PR #1785 (`MALEK_ARCHITECTURE_CENSUS_REPORT.md`, branch `arena/01a0690e-malek`, head `da6a9b87`) is a *frontend architecture* census whose own §15 states: *"Actual schema object-level enumeration (every table/view/function) was **not** performed row-by-row here → mark `UNKNOWN_NEEDS_REVIEW` for a full per-object owner map."* This document closes exactly that gap and adds the product-gap layer. §14 below lists where the earlier census was incomplete.
**Branch note:** this audit session is pinned to branch `arena/01a06a8a-malek` and may not push to `arena/01a0690e-malek`, so the report is delivered as a separate documentation-only PR rather than being appended to #1785.

**Method.** Every claim below is derived from a repeatable scan, not from folder names:

| Scan | What it did |
|---|---|
| DB contract parse | Parsed `rentrix-app/src/types/database.ts` section boundaries (`Tables`/`Views`/`Functions`/`Enums`/`CompositeTypes`) and enumerated every key |
| Reference census | For **all 306 functions and all 125 tables/views**, searched every `.ts`/`.tsx` file for the bare quoted identifier — this catches cast-wrapped calls such as `(supabase.rpc as unknown as Rpc)('rpt_tenant_statement', …)` that a `.rpc('…')` regex misses |
| Internal-SQL census | For every frontend-unreferenced table, counted references inside SQL *function/trigger bodies* (DDL/grant/policy/comment lines excluded) to separate governed internals from true orphans |
| Grant census | Read `GRANT/REVOKE … ON FUNCTION` for every candidate RPC to distinguish *browser-callable* (`authenticated`) from *server-only* (`service_role`) |
| Route census | Extracted every `createRoute` node from `app/router/route-tree.ts`, resolved full paths, separated VIEW from REDIRECT |
| Discoverability census | For every route, searched the whole app for in-product links (`Link to`, `navigate`, command palette, hub tabs, dashboard signals, AI-assistant navigation) excluding tests, `route-tree.ts`, `route-contract.ts`, `app-nav-items.ts`, `command-registry.ts` |
| Permission census | Parsed the `appPermissions` array (deduped), then resolved each through the `financialOperationPermissions` alias map **and** raw-string guards |

Two independent evidence edges are cited for every hidden/missing classification.

---

## 1. Executive summary

### 1.1 Re-derived DB contract (verified, not inherited)

Parsed directly from `rentrix-app/src/types/database.ts` (10,277 lines):

| Object class | Count | Prior claim | Verdict |
|---|---|---|---|
| Tables | **114** | ~114 | ✅ confirmed |
| Views | **11** | ~11 | ✅ confirmed |
| Functions / RPCs | **306** | ~306 | ✅ confirmed |
| Enums | 4 (`charged_to_type`, `entity_status`, `user_role`, `utility_status`) | not stated | new |
| Composite types | 0 | not stated | new |
| `.sql` migrations | **70** | 70 | ✅ confirmed |

The 11 views: `current_property_ownership`, `journal_entries`, `party_directory`, `s08_analysis_scope`, `s08_liability_balances_by_period`, `s08_master_lease_readiness`, `s08_retroactive_version_differences`, `s08_subledger_gl_reconciliation`, `v_balance_reconciliation`, `v_balance_reconciliation_drift`, `vw_active_owner_agreements`. **Zero of the 11 views has any frontend reference** — all are server-side analysis/projection surfaces.

### 1.2 Reference reach (measured)

| | Total | Prod-referenced | Test-only | Zero-reference |
|---|---|---|---|---|
| Functions/RPCs | 306 | **128** (41.8%) | 22 | 156 |
| Tables + views | 125 | **59** (47.2%) | 2 | 64 |

"A zero-reference table" is **not** automatically a gap — 54 of the 125 are governed internals reached only through SECURITY DEFINER RPCs. The classification below resolves each one.

### 1.3 Meaningful business capabilities and classification counts

Grouping the 125 tables/views into business capabilities and classifying every object (125/125 assigned, zero conflicts, zero unknown):

| Classification | Tables/views | Named RPCs | Meaning |
|---|---|---|---|
| `IMPLEMENTED_VISIBLE` | 46 | (majority of the 128 prod RPCs) | Wired and discoverable in normal use |
| `IMPLEMENTED_HIDDEN_INTENTIONAL` | — | — | See §6; documented in the Target Architecture Lock |
| `IMPLEMENTED_HIDDEN_ACCIDENTAL` | — | 10 routes | Functional surface, no realistic discovery path (§8) |
| `BACKEND_ONLY_CAPABILITY` | 5 | 18 | Real operator workflow, browser-callable RPC, no UI (§3) |
| `SERVICE_WITHOUT_SURFACE` | 3 | 20 | Production service layer, no route/action (§8) |
| `ROUTE_WITHOUT_DISCOVERY` | — | 10 routes | Real route, no navigation reveals it (§8) |
| `PERMISSION_WITHOUT_SURFACE` | — | 1 | `tenant.portal.link` (§7) |
| `PARTIAL_IMPLEMENTATION` | 5 | 2 | Workflow incomplete end-to-end (§5) |
| `INTERNAL_INFRASTRUCTURE` | 54 | — | Correctly must **not** become product UI (§6) |
| `COMPATIBILITY_ONLY` | 4 | 25 | Deliberate legacy aliases (§6) |
| `ORPHAN_CONFIRMED` | 8 | — | No runtime/internal/compatibility consumer (§6) |
| `MISSING_PRODUCT_CAPABILITY` | — | — | 4 items (§12) |
| `UNKNOWN_NEEDS_REVIEW` | 0 | 0 | — |

**Headline:** MALEK's backend is materially *ahead* of its product surface. The single largest concentration of value is a complete, RC1-grade, **browser-callable** financial-correction and owner-debt stack — credit notes, due-from-owner recovery/offset/reversal, settlement cancellation, owner-funds opening balance — that has **no UI at all**. Separately, a systemic UI pattern (`showInPrimaryNavigation: false`) hides 10 real registers and 3 settings workspaces behind URLs no user can reach, including the **entire VAT/tax configuration surface** on which correct billing depends.

---

## 2. The systemic mechanism behind most hidden surfaces

One pattern produces the majority of `ROUTE_WITHOUT_DISCOVERY` findings, and it is worth naming precisely because it is *not* a permission gate and *not* a missing page.

Every hub declares sections with a `showInPrimaryNavigation` flag, then renders tabs from the **filtered** subset while still mounting any section named in the URL:

| Hub | Declaration | Tab render |
|---|---|---|
| Portfolio | `features/portfolio-hub/portfolio-hub-sections.ts` | `portfolio-hub-workspace.tsx`: `<SectionTabs items={visibleSections} …/>` |
| Leasing | `features/relationships-hub/leasing-hub-sections.ts` | `leasing-hub-workspace.tsx`: `visibleSections = accessibleSections.filter(s => s.showInPrimaryNavigation)` |
| Operations | `features/operations-hub/operations-hub.sections.ts` | `operations-hub-workspace.tsx:105`: `items={visibleSections}` |
| Governance | `features/governance-hub/governance-hub-sections.ts` | `GovernanceHubWorkspace.tsx:48`: `getVisibleGovernanceHubSections(canAccess)` |
| Company settings | `features/settings/registry/sectionRegistry.ts` | `settings-page.tsx:103`: `routineDefinitions = accessibleDefinitions.filter(s => s.showInPrimaryNavigation)` |
| Money | `features/finance/shell/financeShellModel.ts` | `getPermittedSections` + `showInSectionNavigation !== false` |

Consequence: a user with the correct permission who lands on `/properties` sees **Properties · Units · Owners** and never sees a **Lands** tab — but `/properties?section=lands` renders the full Lands register. The capability is *accessible* and *undiscoverable* at the same time. This is different from an intentional permission gate, and it is the reason several rows below are classified `IMPLEMENTED_HIDDEN_ACCIDENTAL` rather than `IMPLEMENTED_HIDDEN_INTENTIONAL`.

Primary navigation is confirmed at 7 destinations (`app/navigation/app-nav-items.ts` → `navGroups`): Today, Portfolio, Leasing, Money, Services, Reports, Settings. `workspaceChildNavItems` adds 10 sub-entries. `mobileNavItems` is intentionally `[]`. The command palette carries 16 static commands (`features/command-palette/command-registry.ts`).

---

## 3. Backend-only capabilities (highest product value)

### 3.1 Invoice Credits / Credit Notes — **BACKEND_ONLY_CAPABILITY**, P0

**What exists — a complete, production-grade, RC1-correct implementation:**

| Layer | Evidence |
|---|---|
| Table | `invoice_credits` — `canonical_baseline.sql:26566`; `amount numeric(18,3)`; `credit_type ∈ {PARTIAL,FULL}`; `status ∈ {POSTED,REVERSED}`; immutable net/tax components; `invoice_credits_components_omr_check` enforces `net + tax = amount` at 3dp; `invoice_credits_reversal_shape_chk` enforces reversal completeness |
| Create RPC | `create_invoice_credit_atomic(p_payload jsonb)` — `canonical_baseline.sql:3984`. Comment: *"RC1 controlled credit. Reverses the original invoice source economics and original tax snapshot; callers never choose accounts or current tax rates."* |
| Reverse RPC | `reverse_invoice_credit_atomic(p_payload jsonb)` — `canonical_baseline.sql:17502` |
| **Browser-callable** | `canonical_baseline.sql:33217` `GRANT ALL … create_invoice_credit_atomic … TO "authenticated"`; `:34189` same for the reversal |
| Role gate | `canonical_baseline.sql:4036` `CREDIT_ROLE_REQUIRED: ADMIN, MANAGER or ACCOUNTANT`; reversal at `:17527` |
| Idempotency | `financial_operation_idempotency` + SHA-256 payload fingerprint + `pg_advisory_xact_lock`; reused request id for a different payload raises `CREDIT_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST` |
| Safety | `CREDIT_SERVER_OWNED_ACCOUNTING_FIELDS_FORBIDDEN` rejects client-supplied `account_id`/`tax_rate`/`journal_lines`; `CREDIT_INVOICE_NOT_POSTED` gates on `document_status = 'POSTED'` |
| Integrity triggers | `guard_invoice_credit_immutability()`, `guard_receipt_allocation_invoice_credit_ceiling()` (`…020_revoke_internal_and_trigger_rpc_execute.sql:176,230`) |
| Test coverage | Exercised in `features/financials/owner-agency-invoice-accounting.test.ts` (7 call sites) and `collections-payments-period-close.pglite.test.ts` (3) |

**What is missing — the entire frontend layer.** A repo-wide search for `create_invoice_credit_atomic` / `reverse_invoice_credit_atomic` returns **only test files and `types/database.ts`**. A search for `credit` across `features/financials`, `features/finance` and `features/reports` (non-test, excluding the accounting word "creditor") returns only trial-balance/ledger debit-credit columns — **no credit-note concept anywhere in the UI**.

| Check | Result |
|---|---|
| Production service | ❌ none |
| Invoice action / button | ❌ none |
| Credit-note document/print spec | ❌ none |
| Route or dialog | ❌ none |
| Permission | ❌ none (RPC uses a *role* check, not an `AppPermission`) |
| Deliberately server-only? | ❌ **No** — granted to `authenticated`, i.e. designed for browser calls |

**Two independent evidence edges:** (1) `GRANT … TO authenticated` proves browser intent; (2) the role gate `is_admin_or_manager() or is_accountant()` is a *user-facing* delegation check, not a worker identity check (`is_background_service_worker()` exists separately and is not used here).

**Classification:** `BACKEND_ONLY_CAPABILITY`. This is also a `MISSING_PRODUCT_CAPABILITY` at the product layer: `OPS-010` (`docs/source-of-truth/02_OPERATING_MODELS_AND_JOURNEYS.md:29`) states *"Collection, receipt, void, credit-note and refund actions are controlled lifecycle events"*, and GAP-011 records credit notes as **included in RC1** — yet an operator cannot issue one.

### 3.2 Due-from-Owner / Owner Receivables — **BACKEND_ONLY_CAPABILITY**, P0

A complete six-function lifecycle, all six granted to `authenticated`, all six with zero frontend references:

| RPC | Grant (line) | Purpose |
|---|---|---|
| `create_owner_receivable_atomic` | `:33269` | Raise the receivable (owner owes office) |
| `offset_owner_receivable_atomic` | `:33908` | *"GAP-008 lawful Dr 2000 / Cr 1300 offset with RC1 append-only Owner Funds Payable control"* (`:13030`) |
| `recover_owner_receivable_atomic` | `:34064` | Cash recovery from owner |
| `reverse_owner_receivable_atomic` | `:34200` | Reverse the receivable |
| `reverse_owner_receivable_offset_atomic` | `:34206` | *"Compensating reversal of a lawful owner offset; restores 2000 control through an append-only owner-funds event"* (`:17929`) |
| `reverse_owner_receivable_recovery_atomic` | `:34212` | Reverse a recovery |

Role gate (`create_owner_receivable_atomic`, `:4998`): `DUE_FROM_OWNER_ROLE_REQUIRED` = `is_admin_or_manager() or is_accountant()`. Server-owned fields rejected via `DUE_FROM_OWNER_SERVER_OWNED_FIELDS_FORBIDDEN`; cash account validated; owner scope enforced (`DUE_FROM_OWNER_OWNER_NOT_FOUND_OR_FORBIDDEN`).

Supporting tables — all zero frontend references: `due_from_owners`, `due_from_owner_offsets`, `due_from_owner_recoveries`. The subledger report `wp05_subledger_due_from_owner` is likewise unreferenced, although `wp05_reconcile_all` **is** wired (`features/accounting/reports/reconciliation/reconciliationService.ts`), so the 1300 control is reconciled in the reconciliation panel while the underlying receivables are invisible and unactionable.

**Is this the same as owner settlements?** No. `owner_settlements` (paying the owner) is fully wired through `features/owners/services/owner-settlements-service.ts`. Due-from-Owner is the **opposite direction** — money the office must recover *from* the owner, arising when the office pays an owner-borne expense or refunds after payout. The source of truth is explicit: Journey E — *"Owner expense paid by office: Due from Owner"*; Journey G — *"a refund after owner payout creates Due from Owner instead of forcing Owner Funds Payable negative."*

**Operator workflow status:**

| Step | Status |
|---|---|
| Owner owes office (raise receivable) | ❌ no UI |
| Recovery (take cash) | ❌ no UI |
| Offset against settlement | ❌ no UI |
| Reversal of any of the above | ❌ no UI |
| Settlement visibility (1300 balance) | ⚠️ indirect only — appears inside `wp05_reconcile_all` variance output, no drill-through |

**Classification:** `BACKEND_ONLY_CAPABILITY`. The docs already flag this: `FIN-007` → *"incomplete recovery UI"*; Journey E → *"full Due-from-Owner recovery open; `GAP-008/011`"*.

### 3.3 Owner Settlement **cancellation** — **BACKEND_ONLY_CAPABILITY**, P1

`cancel_owner_settlement_atomic` is granted to `authenticated` (`:33081-33082`) and is required by `OPS-011` (*"atomic create/approve/pay/cancel RPCs"*; *"cancellation releases only reservations that are legally/operationally releasable"*). The frontend service `features/owners/services/owner-settlements-service.ts` exposes `createOwnerSettlementDraft`, `approveOwnerSettlement`, `processOwnerPayout` — **but no cancel**. `OwnerSettlementWorkspace.tsx:90` renders a `cancelled` status badge, so the UI can *display* a state it can never *produce*. Two edges: DB grant + a status branch with no action path.

### 3.4 Owner Funds cutover (opening balance) — **BACKEND_ONLY_CAPABILITY**, P1

`create_owner_funds_cutover_atomic` (`:33263`) and `approve_owner_funds_cutover_atomic` (`:32980`) are granted to `authenticated` and referenced **only in tests**. Table `owner_funds_event_cutovers` has zero frontend references. GAP-013 states: *"Existing-company 2000 adoption requires approved S08 cutover opening balance"* and *"Historical 2000 event cutover fails closed without S08 approval."* So an **existing** office migrating to MALEK cannot seed its owner-funds opening balance through the product. Note the deliberate coupling to S08 sign-off — see §6.4 before treating this as a simple UI add.

---

## 4. Partial workflows — what exists and the exact missing step

| # | Capability | What exists | **Exact missing step** | Class |
|---|---|---|---|---|
| 1 | **Communication governance** | DB: `communication_preferences`, `communication_delivery_outbox`, `notification_templates`; RPCs `prepare_communication_preview_atomic` and `set_my_communication_preference_atomic`, **both granted to `authenticated`** (`20260901000004_communication_preview_foundation.sql:149,239`). Function comment (`:314`): *"Company-authorized, preference/consent/review/quiet-hour/rate-limit/idempotency enforcement."* Frontend: a full policy model in `features/communication/communication-system.ts` (9 event types with consent/review/quiet-hour/rate-limit fields) | `features/communication/services/outbound-communication-service.ts` calls a **local** `PreviewCommunicationAdapter` and passes a hard-coded preference `{ enabled: true, quietHoursStart: 0, quietHoursEnd: 0, timezone: 'Asia/Muscat' }` instead of the recipient's stored preference. It never calls either RPC and never writes the outbox. **Users cannot set communication preferences at all**, and consent/human-review state is a local boolean rather than a governed fact | `PARTIAL_IMPLEMENTATION` |
| 2 | **Contract registration** | Full lifecycle wired: `get_contract_evidence_state`, `submit_contract_registration_atomic`, `decide_contract_registration_atomic` via `features/contracts/evidence/contract-evidence-service.ts`, rendered by `ContractEvidenceSection.tsx` inside `ContractDetailWorkspace.tsx:104`. Distinct maker/checker roles (`contract_evidence_actor_can_operate` / `_can_verify`) | `contract_registration_requirement_profiles` is written **only in a test** (`contract-evidence-authority.test.ts:48`). There is **no admin surface to create a profile**, so `registration_configuration_status` resolves to `NOT_CONFIGURED` for every company and the workflow can never start. `contract_inspection_templates` is seeded `SYSTEM_MOVE_IN`/`SYSTEM_MOVE_OUT` only, with no editor | `PARTIAL_IMPLEMENTATION` (deliberately gated — GAP-019 requires Omani legal review before enabling a profile) |
| 3 | **Onboarding lifecycle admin** | `OnboardingChecklist` on `/dashboard` (`dashboard-page.tsx:272`) with server-driven requirements, per-step audited waivers, NON_WAIVABLE gates. Service exports `getCompanyOnboardingState`, `waiveOnboardingRequirement`, `revokeOnboardingWaiver`, `completeCompanyOnboarding`, `resetCompanyOnboarding` — all five RPCs prod-referenced | `OnboardingChecklist.tsx` uses only `isVisible`, `requirements`, `waive`, `dismissLater`, `complete` (lines 46, 59, 105, 140, 215). **`reset` is wired in `useOnboarding.ts:103` but never called by any component; `revokeOnboardingWaiver` is exported at `onboardingService.ts:63` and has zero consumers** — so a granted waiver can never be revoked and onboarding can never be reset from the product | `PARTIAL_IMPLEMENTATION` |
| 4 | **Portal link management** | Create is fully wired and discoverable: `OwnerPortalLinkAction` in `owner-detail-view.tsx:108`, `TenantPortalLinkAction` in `TenantPreviewDialog.tsx:243`. Links are 30-day, single-active (creating revokes the previous — `20260901000044_external_portal_read_links.sql:44` (tenant) and `:131` (owner)) | `revokeOwnerPortalLink` / `revokeTenantPortalLink` are exported but have **zero consumers**; the Action components import only `create*`. An office cannot kill an active link without minting a replacement, and cannot see expiry or `last_used_at` (the link tables are RLS-revoked from `authenticated` by design) | `PARTIAL_IMPLEMENTATION` |
| 5 | **Automation run recovery** | `automation_rules` toggle, `automation_runs` log and `automation_notifications` are all wired through `features/automation/automation-service.ts`; jobs dispatched by `enqueue_automation_rule_job_atomic` | `retry_automation_run` is **test-only**. A failed run can be viewed but not retried. `cancel_background_job_atomic` and `get_background_job_status` are also test-only | `PARTIAL_IMPLEMENTATION` |

---

## 5. Intentionally hidden / internal — do **not** build UI for these

### 5.1 Governed internals (54 tables/views)

Reached exclusively through SECURITY DEFINER RPCs or triggers. Correctly absent from the UI:

`financial_operation_idempotency` (75 SQL body refs), `journal_batches` (98), `journal_lines` (64), `accounts` (87), `accounting_periods`, `gl_cash_flow_classifications`, `audit_log`, `admin_support_audit_events`, `background_jobs` / `background_job_events` / `background_job_schedules`, `automation_jobs` / `automation_run_logs`, `ai_assistant_budget_reservations` / `ai_assistant_rate_limits`, `app_permission_catalog`, `user_permission_overrides`, `taxable_line_tax_snapshots`, `management_fee_tax_snapshots`, `invoice_payment_tax_allocations`, `owner_settlement_payment_links` / `owner_settlement_expense_links`, `document_reference_sequences`, `company_onboarding_events` / `_waivers` / `_completion`, `onboarding_requirement_templates`, `contract_evidence_events`, `contract_inspection_templates`, `support_request_events`, `fixed_monthly_daily_accruals` / `_reversals`, `bank_statement_imports`, `bank_reconciliation_matches`, `deposit_transactions`, `admin_user_access_change_proposals`, `automation_notifications`, `receipt_void_requests`, `receipt_allocations`, `vault_documents`, `attachments`, plus **all 11 views**.

**Journal authoring must stay server-only.** `docs/security/FINANCIAL_WRITE_TRUST_MODEL_AR.md` and SEC-009/GAP-018 record *"0 direct INSERT/UPDATE/DELETE paths to the 12 sensitive financial tables"* with a `check-sensitive-financial-write-boundary.mjs` regression guard, and migration `…056_revoke_browser_execute_internal_gl_rpcs` revokes browser execute on internal GL RPCs. **Do not expose raw journal authoring.**

### 5.2 Master Lease — `INTERNAL_INFRASTRUCTURE`, deliberately excluded from RC1

`master_lease_measurements`, `master_lease_schedule_rows` and the ten `gl_ml_*` functions. Decisive evidence: **every `gl_ml_*` function is `REVOKE ALL … FROM PUBLIC` + `GRANT … TO service_role` only** (`canonical_baseline.sql:33494-33533`) — none is granted to `authenticated`. Contrast with §3.1/§3.2, where the gap candidates *are* granted to `authenticated`. This is the single cleanest discriminator in the audit.

The source of truth is unambiguous: `FIN-002` → *"MASTER_LEASE principal accounting … **excluded from RC1**; no full UI/reports … PARTIAL (excluded RC1 capability) … GAP-012"*; `OPS-002` → *"no complete product journey"*; Journey H → *"Until this is fully wired through UI/service/database/reporting/reconciliation, MASTER_LEASE reporting must not be described as complete IFRS reporting."* GAP-012 is a **BLOCKER** requiring professional accounting review.

**Verdict:** Master Lease is a *deferred product mode*, not a hidden feature. It is not `BACKEND_ONLY_CAPABILITY` and must not be surfaced piecemeal. Any future work is a WP-04 module decision, not a UI gap fix.

### 5.3 Compatibility-only (deliberate)

| Object | Evidence of intent |
|---|---|
| `properties.write`, `contracts.write`, `maintenance.write` | `20260901000051_granular_employee_action_permissions.sql:37-39` sets `requestable = false` and states: *"Broad writes stay resolvable for old roles/grants but disappear from the routine owner-facing permission editor. They are compatibility parents only."* The same migration's `current_user_has_effective_app_permission` resolves granular → parent as a fallback chain |
| `settings.manage` | Labelled in `permissions.ts:116` as `'إدارة الإعدادات (توافق قديم)'` — "legacy compatibility" |
| `contract_balances`, `owner_balances`, `tenant_balances`, `tenant_profiles` | Legacy denormalised balance projections; superseded by server-derived `rpt_*` positions and `recalculate_*` functions |
| `create_contract_atomic` / `update_contract_atomic` | Superseded by the `_v2` variants, which are the prod-referenced ones |
| `deduct_deposit_atomic`, `refund_deposit_atomic`, `*_phase3a1a_impl`, `approve/pay_owner_settlement_atomic_s02_base` | GAP-009 records *"legacy deposit/deduct SDK writes revoked"* and *"S04 application/refund kernels revoked from authenticated/service_role"* |
| `rpt_dashboard_overview`, `rpt_financial_summary`, `rpt_overdue_invoices`, `rpt_aged_receivables`, `rpt_general_ledger` | GAP-014: *"legacy `rpt_*` wrappers delegate to GL"* — the `wp05_rpt_*_gl` functions are the canonical ones |
| `void_receipt_atomic`, `execute_receipt_void_internal`, `post_receipt_atomic`, `record_invoice_payment_atomic_engine` | Internal engines called by the governed entry points (`request_receipt_void_atomic` → `approve_receipt_void_atomic`, both prod-wired in `receiptService.ts`) |
| 20 redirect routes | `REDIRECT_ROUTES` in `route-contract.ts` — 21 entries; `/landing`, `/units`, `/utilities`, `/automation`, `/documents-vault`, `/finance/*` (4), `/expenses`, `/invoices`, `/receipts`, `/arrears`, `/deposits`, `/owner-settlements`, `/bank-reconciliation`, `/accounting`, `/change-password`, `/audit-log`, `/data-integrity`, `/system` |

### 5.4 Orphans confirmed (8 tables)

No frontend reference, no SQL function/trigger body reference, no Edge Function reference — only their own DDL/RLS/grant lines:

| Table | Occurrences | Verdict |
|---|---|---|
| `contract_documents` | 13, all in `canonical_baseline.sql` DDL/RLS | ORPHAN — superseded by `vault_documents` + `attachments` |
| `serials` | 10, same | ORPHAN — superseded by `document_reference_sequences` |
| `status_history` | 12, same | ORPHAN |
| `status_transition_rules` | 11, same | ORPHAN — `transition_maintenance_status_atomic` is prod-wired but validates transitions in code, not against this table |
| `notification_templates` | legacy shape (`id text`) | ORPHAN — superseded by in-code `communicationTemplates` |
| `outgoing_notifications` | legacy shape (`id text`, `sent_at bigint`) | ORPHAN — superseded by `communication_delivery_outbox` |
| `notifications` | uuid shape but unused | ORPHAN — superseded by `app_notifications` (prod-wired in `app-notifications-service.ts`) |
| `governance` | singleton `(read_only, locked_periods)` | ORPHAN — superseded by `accounting_periods` |

Verified by: `grep` for each name across all migrations returns hits in **one file only** (`canonical_baseline.sql`), all in DDL/policy/grant/comment lines; `grep` across `rentrix-app/src` returns nothing but `types/database.ts`. No Edge Function references them (`supabase/functions/**` calls only 4 RPCs, all background-job related).

> These are **removal candidates, not UI candidates**. This audit does not recommend deleting them — that is a separate governed migration decision.

### 5.5 Governance-gated (deliberately not surfaced yet)

**S08 frozen review / S09 corrections.** A complete service layer exists in `features/accounting/wp05Services.ts` — `listFrozenReviews`, `createFrozenReview`, `analyzeFrozenReview`, `approveFrozenReview`, `listCorrections`, `createCorrectionDraft`, `validateCorrection`, `applyCorrection`, `reverseCorrection`, `listCorrectionProposals`, `generateCorrectionProposals`, `approveCorrectionProposal`, `rejectCorrectionProposal` — and **none has a consumer outside that file**. The `accountingReportsFacade.ts` (the documented "SINGLE import path for all accounting report consumers") deliberately does not re-export them.

This is intentional, not accidental. `REL-004`: *"Historical correction/backfill cannot start merely because S08 code exists; the read-only analysis must be governed/approved first."* GAP-015: *"Production activation: **BLOCKED BY ACCOUNTING SIGN-OFF**."* GAP-016: *"activation BLOCKED BY ACCOUNTING SIGN-OFF for S08 approval."* Roadmap: *"S09 migrations are prohibited until GAP-015 closes."*

**Classification:** `IMPLEMENTED_HIDDEN_INTENTIONAL` (governance-gated). Do not build UI ahead of accounting sign-off.

---

## 6. Permission-without-surface findings

61 unique `AppPermission` values (independently re-derived from the `appPermissions` array — matches PR #1785's corrected figure). Eleven have no raw-string guard; three of those resolve through the `financialOperationPermissions` alias map (`permissions.ts:164-176`), and three more are enforced server-side. Resolving all of them leaves **one genuine finding**:

### `tenant.portal.link` — PERMISSION_WITHOUT_SURFACE (confirmed, P2)

| Evidence edge | Detail |
|---|---|
| Declared as a product permission | `features/auth/permissions.ts` — present in `appPermissions` |
| Catalogued as delegatable | `20260901000044_external_portal_read_links.sql:10` — `('tenant.portal.link', 'تصدير رابط عرض بوابة المستأجر', false, true)` → `admin_only = false`, **`requestable = true`** |
| Enforced by the DB | `create_tenant_portal_link` (permission check at `:28`) and `revoke_tenant_portal_link` (defined `:56`, check at `:66`) both raise `TENANT_PORTAL_LINK_PERMISSION_REQUIRED` unless `current_user_has_effective_app_permission('tenant.portal.link')` |
| **UI checks a different permission** | `features/tenants/components/TenantPortalLinkAction.tsx:26` → `if (!canAccess('users.manage')) return null;` |

Consequences: an employee granted `tenant.portal.link` (which the catalog explicitly allows them to request) **never sees the button**; an admin holding `users.manage` without `tenant.portal.link` sees it and receives a server rejection. The owner equivalent is implemented correctly — `OwnerPortalLinkAction.tsx:24` checks `owner.portal.link`. The tenant side is inconsistent with its own sibling.

### Correctly *not* findings (false positives avoided)

| Permission | Why it is fine |
|---|---|
| `support.requests.triage`, `support.user_lookup.view` | Enforced **server-side** and surfaced through server-computed capabilities: `admin-support-service.ts:123-124` reads `value.capabilities.triage` / `.userLookup` from `get_admin_support_operations_snapshot`; `admin-support-page.tsx:263` gates the action on `snapshot.capabilities.triage` |
| `financial.invoices.export`, `financial.receipts.void`, `financial.bank_reconciliation.match` | Used via the alias map: `useInvoiceWorkspaceController.ts:160`, `receipts-page.tsx:55`, `useBankReconciliationController.ts:96` |
| `properties.write`, `contracts.write`, `maintenance.write`, `settings.manage` | `COMPATIBILITY_ONLY` (§5.3) |
| `app.dashboard.view` | Role-map input only (`canonical_baseline.sql:18092,18104,18113,18119,18122`); `/dashboard` is intentionally ungated for authenticated users |
| Granular action permissions (`contracts.approve`, `maintenance.cancel`, `financial.owner_settlements.approve/pay`, `financial.fixed_monthly_accruals.execute/reverse`, `expenses.write`, `financial.reports.export`, `documents.write`, `cost_centers.manage`) | Correctly guard buttons/workflows, not screens — each has a real consumer |

---

## 7. Route-without-discovery findings

69 `path:` definitions → **67 unique paths** (independently re-derived; `/units` and `/` each appear twice). Partition: **20 redirect-only + 1 conditional (`/receipts`) + 46 rendering**.

For each rendering route I searched the whole app for in-product links. Results for the non-primary-nav routes:

| Route | Renders | Primary nav | Hub tab | Command palette | Contextual link | Verdict |
|---|---|---|---|---|---|---|
| `/leads` | `LeadsPage` | ❌ | ❌ hidden (`showInPrimaryNavigation: false`) | ❌ | **0 links** — only `active-register-inventory.ts` (a test manifest) | **ROUTE_WITHOUT_DISCOVERY** |
| `/lands` | `LandsWorkspace` | ❌ | ❌ hidden | entity search reaches `/lands/$landId` only | 0 links to the register | **ROUTE_WITHOUT_DISCOVERY** |
| `/communication` | `CommunicationWorkspace` | ❌ | ❌ hidden | ❌ | **only `ai-assistant-navigation.ts:44,83`** — the AI Assistant is the sole in-product path | **ROUTE_WITHOUT_DISCOVERY** |
| `/admin-support` | `AdminSupportOperationsPage` | ❌ | n/a | ❌ | only `system-page.tsx:21`, and `system-page` renders at `settings?section=system-settings` which is **itself a hidden tab** | **ROUTE_WITHOUT_DISCOVERY** |
| `/people` | `PeopleListPage` | ❌ | ❌ hidden | ❌ | entity search → `/people/$personId` | **ROUTE_WITHOUT_DISCOVERY** (register) |
| `/service-providers` | `ServiceProvidersPage` | ❌ | ❌ hidden | ❌ | only its own detail/edit pages | **ROUTE_WITHOUT_DISCOVERY** (register) |
| `/commissions` | `CommissionsWorkspace` | ❌ | n/a | ❌ | 0 links to the route — **but the capability is visible** as Money → `fees` → `commissions` (`financeShellModel.ts:82`, `showInSectionNavigation` unset = visible) | Capability VISIBLE; standalone route redundant |
| `/owners`, `/tenants` | workspaces | ❌ | ✅ visible tabs (`/properties?section=owners`, `/contracts?workspace=tenants`) + palette commands | ✅ | — | Visible via hub; standalone routes redundant |
| `/receipts` | `ReceiptsPage` | ❌ | ✅ Money → collections → receipts | ✅ (preview) | print deep-link `/receipts?receiptId=` | Visible; standalone route is the print surface |
| `/dev/design-system` | showcase | — | — | — | DEV-only guard (`import.meta.env.DEV`) | Intentional |

**Excluded as intentional with explicit evidence:** `/system`, `/audit-log`, `/data-integrity`, `/change-password`, `/automation` (governance-hub specialist sections, `showInPrimaryNavigation: false`, documented in the Target Architecture Lock); the 20 redirect routes; `/reset-password`, `/privacy`, `/terms`, `/support`, `/tenant-portal`, `/owner-portal` (external/auth flows).

**Caveat on `/reset-password`:** it is registered in `route-tree.ts` but is **absent from `ROUTE_CONTRACT`** (60 entries vs 67 unique paths). Not a product gap — a contract-coverage gap worth noting for the route-contract test.

---

## 8. Service-without-surface findings

Symbol-level analysis (not filename inference). Each row was confirmed by searching for the exported symbol name across all non-test source.

| Service module | Exported operations with **zero** consumers | Class |
|---|---|---|
| `features/accounting/wp05Services.ts` | `listFrozenReviews`, `createFrozenReview`, `analyzeFrozenReview`, `approveFrozenReview`, `listCorrections`, `createCorrectionDraft`, `validateCorrection`, `applyCorrection`, `reverseCorrection`, `listCorrectionProposals`, `generateCorrectionProposals`, `approveCorrectionProposal`, `rejectCorrectionProposal` | `IMPLEMENTED_HIDDEN_INTENTIONAL` (governance-gated, §5.5) |
| `features/accounting/wp05Services.ts` | **`getCashFlowDrillthrough`** (→ `wp05_cash_flow_drillthrough`), **`getVarianceDiagnostics`** (→ `wp05_variance_diagnostics`) | **`SERVICE_WITHOUT_SURFACE`** — see below |
| `features/onboarding/onboardingService.ts` | **`revokeOnboardingWaiver`** (→ `revoke_onboarding_waiver_atomic`) | **`SERVICE_WITHOUT_SURFACE`** |
| `features/onboarding/useOnboarding.ts` | **`reset`** (→ `resetCompanyOnboarding`) — wired in the hook, called by no component | **`SERVICE_WITHOUT_SURFACE`** |
| `features/owners/owner-portal-admin-service.ts`, `features/tenants/tenant-portal-admin-service.ts` | **`revokeOwnerPortalLink`**, **`revokeTenantPortalLink`** | **`SERVICE_WITHOUT_SURFACE`** |

### Cash-flow drill-through and variance diagnostics — real value, P1

GAP-014's own acceptance criteria require it: *"drillthrough `wp05_cash_flow_drillthrough` + `wp05_gl_drillthrough` exposing classification, account, batch, lines, source, date, amount"*. Both RPCs exist. `wp05_cash_flow_drillthrough` is called only by `getCashFlowDrillthrough`, which nothing consumes; `getVarianceDiagnostics` is consumed only by its own test; **`wp05_gl_drillthrough` has zero references outside its own generated type entry in `types/database.ts`**. Meanwhile `getCashFlowReport` *is* wired, so accountants see cash-flow totals they cannot interrogate. Two edges: GAP-014 acceptance text + the unreachable service export.

### Correctly *not* service gaps

| Candidate | Why |
|---|---|
| `supabase/functions/background-worker/index.ts` | Backend orchestration — calls only `dispatch_due_background_schedules_atomic`, `list_background_job_companies_atomic`, `claim_background_jobs_atomic`, `process_background_job_atomic` |
| `services/mock-role-simulator.ts` | Test/dev contract |
| `features/communication/services/outbound-communication-service.ts` | Consumed (`communication-page.tsx:72` renders `CommunicationOutboundPanel`) — its problem is *bypassing* the governed RPC (§4.1), not being unconsumed |
| `features/settings/settings-page.tsx` | Not dead — lazily mounted by `GovernanceHubWorkspace.tsx:21` |

---

## 9. Portal / Communication / Notification status

### 9.1 Portals — substantially better than the docs claim

The traceability doc's P4 note (2026-08-27) states the Tenant Portal is *"deferred at the data layer … returns `TENANT_PORTAL_READ_MODEL_UNAVAILABLE`"*. **That is now stale.** Verified: the string `TENANT_PORTAL_READ_MODEL_UNAVAILABLE` no longer exists anywhere in `rentrix-app/src`. `tenant-portal-service.ts` calls `get_tenant_portal_snapshot` and handles a real `{status:'ready', snapshot}` payload; the allowed projection sources are declared (`people`, `units`, `properties`, `contracts`, `invoices`, `receipts`). The Owner Portal mirrors it via `get_owner_portal_snapshot`.

| Aspect | Tenant Portal | Owner Portal |
|---|---|---|
| External route outside office shell | ✅ `/tenant-portal` | ✅ `/owner-portal` |
| Server-side scope resolution | ✅ `get_tenant_portal_snapshot(p_token)` | ✅ `get_owner_portal_snapshot` |
| Admin entry point | ✅ `TenantPreviewDialog.tsx:243` | ✅ `owner-detail-view.tsx:108` |
| Permission gate | ⚠️ `users.manage` (should be `tenant.portal.link`) | ✅ `owner.portal.link` |
| Link revocation from UI | ❌ | ❌ |
| Link state / expiry visibility | ❌ (tables RLS-revoked by design) | ❌ |

**Not hidden because external** — both are discoverable from the record detail pages, which is the correct placement. `IMPLEMENTED_VISIBLE` for issue; `PARTIAL_IMPLEMENTATION` for lifecycle management.

### 9.2 Communication — the largest single "half-built" area

| Capability | Status |
|---|---|
| Log a communication manually | ✅ **Usable** — `/communication` → `communication_records` (create/edit/archive via `use-communication.ts`) |
| Event policy model (9 event types, consent/review/quiet-hours/rate limits) | ✅ Defined in `communication-system.ts` |
| Preview a communication | ⚠️ **Preview-only, client-side** — local adapter, no server governance |
| **Set communication preferences** | ❌ **Not possible.** `set_my_communication_preference_atomic` is granted to `authenticated` but has zero production callers |
| Approve / send | ❌ By design — *"External channels are preview-only … A live adapter requires a separately approved server-side implementation"* (`outbound-communication-service.ts` header); `outboundProviderCapabilities` marks all channels `live: false`, SMS `disabled` |
| Inspect delivery state / history | ❌ `communication_delivery_outbox` has zero production references |
| Route discoverability | ❌ Hidden leasing-hub section; only the AI Assistant links to it |

### 9.3 Notifications

| Object | Status | Class |
|---|---|---|
| `app_notifications` | ✅ Live — bell menu, `app-notifications-service.ts`, read state via the governed `mark_app_notification_read` RPC | `IMPLEMENTED_VISIBLE` |
| `automation_notifications` | ✅ Live — automation centre run log (`automation-service.ts:83,91`) | `IMPLEMENTED_VISIBLE` (inside the hidden automation section) |
| `notification_templates` | ❌ Zero consumers; legacy `id text` shape | `ORPHAN_CONFIRMED` |
| `outgoing_notifications` | ❌ Zero consumers; legacy shape | `ORPHAN_CONFIRMED` |
| `notifications` | ❌ Zero consumers | `ORPHAN_CONFIRMED` |
| Push / PWA notifications | No push subscription path found; PWA is install/update lifecycle only | — |

**Answer to the brief's question:** `notification_templates` / `outgoing_notifications` are **neither active infrastructure nor an incomplete product capability — they are dead legacy scaffolding**, superseded by `app_notifications` + `communication_delivery_outbox`. The genuinely incomplete capability is the *communication preference + outbox* layer (§9.2), not the notification tables.

---

## 10. Financial / accounting hidden-capability status

### 10.1 User-facing accounting surfaces — correct

| Capability | Surface | Status |
|---|---|---|
| Accounting periods | `accountingPeriodsService.ts` → `list/create/update_accounting_period_status` | ✅ Service complete; consumed by `use-general-ledger-core.ts` inside Reports → financial review |
| Chart of accounts | `chartOfAccountsService.ts` → `list_chart_of_accounts`, `ensure_company_chart_of_accounts` | ✅ Same |
| Journal batches / lines | `journalService.ts` → `list_journal_batches`, `list_journal_lines` | ✅ **Read-only by design** |
| Trial balance / P&L / balance sheet / cash flow | `rpt_trial_balance`, `rpt_income_statement`, `rpt_balance_sheet`, `rpt_cash_flow` + `wp05_rpt_*_gl` | ✅ Reports workspace |
| Subledger reconciliation | `wp05_reconcile_all`, `wp05_assert_reconciliation` | ✅ `accounting-reconciliation-readiness.tsx` |
| **Cash-flow / GL drill-through** | `wp05_cash_flow_drillthrough`, `wp05_gl_drillthrough` | ❌ **No UI** (§8) |
| **Variance diagnostics** | `wp05_variance_diagnostics` | ❌ **No UI** (§8) |
| Period close / reopen | `update_accounting_period_status` with `OPEN / SOFT_CLOSED / HARD_CLOSED` | ✅ RPC + service wired; no dedicated close/reopen *workflow* screen (action lives in the periods list) |
| Raw journal authoring | — | 🚫 **Must stay server-only** (SEC-009, GAP-018, migration `…056`) |

### 10.2 Tax / VAT — **the most consequential hidden surface**

`features/financials/tax-authority/` contains a **complete, functional, maker-checker tax configuration workspace**:

| Capability | Implementation |
|---|---|
| Tax code catalog | `tax-authority-service.ts:71` → `tax_code_catalog` |
| Rent tax profiles (effective-dated) | `:78` read, `:138` `create_tax_profile_atomic`, `:150` `approve_tax_profile_atomic` |
| Fee tax treatments (RATE_MANAGEMENT_FEE / FIXED_MONTHLY) | `:158` read, `:204` `create_fee_tax_treatment_atomic`, `:216` `approve_fee_tax_treatment_atomic` |
| Active-profile resolution | `:88,:109,:172` `resolve_active_tax_profile`, `resolve_active_fee_tax_treatment` |
| Maker-checker UI | `tax-profile-workspace.tsx:129,149` — approve button shown only when `status === 'DRAFT' && created_by !== currentUserId` |
| VAT readiness | `finance-readiness-section.tsx` — three readiness cards (rent tax, rate fee tax, fixed fee tax) each linking to its corrective surface |
| VAT return | `rpt_vat_return` — prod-wired in `financial-statements-service.ts` |

**And it is undiscoverable.** `features/settings/registry/sectionRegistry.ts:68-75` declares `finance-readiness` with `showInPrimaryNavigation: false`. `settings-page.tsx:103` builds tabs from `routineDefinitions` only. A repo-wide search for `finance-readiness` finds the deep link **only inside the section itself** (`finance-readiness-section.tsx:68`) — a self-referential loop with no external entry point.

Why this matters more than its size suggests: GAP-006 lists *"configured rent/fee tax policies"* as a dependency, GAP-007 requires *"configured fee treatment"*, and `FIN-005`/`FIN-006` state that a **missing fee treatment fails closed**. An office that cannot find this screen cannot configure tax, and billing then fails closed. Two edges: registry flag + absence of any external link.

**Classification:** `IMPLEMENTED_HIDDEN_ACCIDENTAL` — **P0**.

---

## 11. Missing product capabilities

Only items supported by domain/business evidence already in the canonical pack:

| # | Capability | Domain evidence | Why it is genuinely missing (not merely hidden) |
|---|---|---|---|
| 1 | **Issue a credit note** | `OPS-010`: *"Collection, receipt, void, credit-note and refund actions are controlled lifecycle events."* GAP-011: credit notes are **included in RC1** | The RPC pair is complete and browser-callable, but no service, action, document or route exists. Nothing is hidden — nothing was built |
| 2 | **Recover money from an owner** | Journey E: *"Owner expense paid by office: Due from Owner."* Journey G: *"a refund after owner payout creates Due from Owner."* `FIN-007`: *"incomplete recovery UI."* `FIN-008` (`VERIFIED_IMPLEMENTED` at DB level, `GAP-008`) | Six-function lifecycle exists; no operator workflow at any step |
| 3 | **Cancel a draft/approved owner settlement** | `OPS-011`: *"atomic create/approve/pay/cancel RPCs … cancellation releases only reservations that are legally/operationally releasable"* | RPC granted to `authenticated`; no service function; UI renders a `cancelled` badge it cannot produce |
| 4 | **Configure communication preferences / governed preview** | `communication_preferences` + `communication_delivery_outbox` + two `authenticated`-granted RPCs; function comment promises *"preference/consent/review/quiet-hour/rate-limit/idempotency enforcement"* | The UI substitutes a hard-coded local preference, so the governance layer is bypassed rather than unwired. (Actual *sending* is correctly out of scope) |

**Explicitly not proposed** (out of MALEK's declared scope or deliberately deferred): Master Lease UI (GAP-012, WP-04, needs accounting review), S08/S09 UI (blocked by accounting sign-off), raw journal authoring (forbidden by the security model), late fees / non-cash adjustments (GAP-011, excluded pending DP-4), SMS sending (explicitly `disabled`).

---

## 12. Recommended product roadmap

| # | Capability | Current state | Missing layer | Expected user value | Risk | DB change? | Permission change? | UI effort | Priority |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Tax & VAT configuration** — surface the existing Tax Authority workspace | Complete maker-checker workspace at `features/financials/tax-authority/`, hidden by `showInPrimaryNavigation: false` | Navigation only | Unblocks correct billing; the RPCs **fail closed** without an active treatment | **Low** — code exists and is tested | No | No | **S** | **P0** |
| 2 | **Credit notes** — issue & reverse | Complete RC1 RPC pair, `authenticated`-granted, idempotent, tax-correct | Service + invoice action + credit-note document + list view | Corrects billing errors without voiding posted invoices; required by `OPS-010` | **Medium** — financial posting; maker-checker advisable | No | Yes (add e.g. `financial.invoice_credits.create/reverse`) | **M** | **P0** |
| 3 | **Due-from-Owner operator workflow** | Six `authenticated`-granted RPCs; three subledger tables; 1300 already reconciled by `wp05_reconcile_all` | Register + raise/offset/recover/reverse actions + owner-statement visibility | Recovers office money currently stranded; closes `FIN-007` "incomplete recovery UI" | **Medium-High** — touches 2000/1300 controls; `offset_allowed` gating must be respected | No | Yes (new permissions) | **L** | **P0** |
| 4 | **Cancel owner settlement** | RPC granted to `authenticated`; UI already renders a `cancelled` badge | One service function + one guarded action | Releases reservations on abandoned settlements | **Low** | No | No (reuse `financial.owner_settlements.*`) | **S** | **P1** |
| 5 | **Cash-flow & GL drill-through + variance diagnostics** | Both RPCs exist; service functions written but unconsumed; `wp05_gl_drillthrough` has no caller at all | Wire `getCashFlowDrillthrough`/`getVarianceDiagnostics` into the Reports accounting panels | Lets accountants interrogate the statements GAP-014 requires them to sign off | **Low** — read-only | No | No | **S/M** | **P1** |
| 6 | **Register discoverability** — Lands, Leads, People, Service Providers, Communication | Full workspaces exist; hidden hub sections; 0–1 in-product links | Add tabs or hub entries (single flag each), or an explicit "specialist registers" index | Four real registers become usable; removes reliance on URL knowledge | **Low** — but is an IA decision the owner should make | No | No | **S** | **P1** |
| 7 | **Admin Support operations entry point** | Page complete; only link sits inside another hidden section | One link from a visible settings surface | Support triage + access-change review become reachable | **Low** | No | No | **S** | **P1** |
| 8 | **Onboarding admin controls** — revoke waiver, reset | Service + hook wired; no component calls them | Two guarded buttons in `OnboardingChecklist` | Fixes an un-revocable audited waiver; closes the GAP-005 "UI authority" claim | **Low** | No | No | **S** | **P2** |
| 9 | **`tenant.portal.link` correctness** | Catalogued `requestable`, enforced by the DB, but the UI checks `users.manage` | One-line gate change to match `OwnerPortalLinkAction` | Delegated tenant-portal issuing works as the catalog promises | **Low** | No | No | **S** | **P2** |
| 10 | **Portal link revocation + state** | Create wired; revoke exported but unconsumed; expiry/last-use invisible | Revoke action + link status read (needs a governed read RPC — tables are RLS-revoked by design) | Kills a leaked link without minting a replacement | **Low-Medium** | **Yes** (a read RPC for link status) | No | **S/M** | **P2** |
| 11 | **Communication preferences + governed preview** | DB + two `authenticated`-granted RPCs; UI uses a hard-coded local preference | Preferences screen + route `sendOutboundMessage` through `prepare_communication_preview_atomic` + outbox history view | Real consent/quiet-hour/rate-limit enforcement instead of a local approximation | **Medium** — changes preview semantics | No | Possibly | **M** | **P2** |
| 12 | **Automation run retry** | `retry_automation_run` test-only; run log is visible | One guarded action on a failed run | Recovers failed automation without DB access | **Low** | No | No | **S** | **P3** |
| 13 | **Contract registration profile admin** | Full lifecycle wired; profiles only creatable by SQL | Admin config surface for `contract_registration_requirement_profiles` | Activates the registration/handover workflow | **High** — **gated on GAP-019 Omani legal review** | No | Yes | **M** | **P3** (blocked) |
| 14 | **Owner Funds opening-balance cutover** | Two `authenticated`-granted RPCs, test-only | Wizard for existing-company 2000 adoption | Enables migration of existing offices | **High** — coupled to S08 sign-off | No | Yes | **M** | **P3** (blocked) |
| 15 | **Orphan cleanup** (8 tables) | No consumer of any kind | Governed removal migration | Reduces schema surface | **Low** but irreversible | **Yes** | No | **S** | **P3** |

**Sequencing note.** Items 1, 4, 5, 8, 9, 12 are low-risk and mostly wiring. Items 2 and 3 are the high-value financial builds and should follow the same maker-checker + idempotency + server-owned-accounting patterns the RPCs already enforce. Items 13 and 14 are blocked by external sign-off and must not be started to "complete" a workflow.

---

## 13. Intentionally-hidden summary (so nobody builds UI later)

Do **not** create product surfaces for: all 54 governed-internal tables/views listed in §5.1 · the ten `gl_ml_*` Master Lease functions and their two tables (service-role only, GAP-012 deferred) · `financial_operation_idempotency` · the S08/S09 frozen-review and correction engines until accounting sign-off (GAP-015/016) · raw journal authoring (SEC-009 / GAP-018 / migration `…056`) · `owner_portal_links` / `tenant_portal_links` direct reads (private bearer credentials) · the four compatibility-parent `*.write` permissions · the 20 redirect routes · `/dev/design-system` (DEV-only) · the eight orphan tables in §5.4 (removal candidates, not UI candidates).

---

## 14. What the earlier Architecture Census (PR #1785) got wrong or left incomplete

Verified against `da6a9b87` (the current #1785 head). Its frontend findings were checked independently and are **largely accurate** — the corrections below are about *scope*, not accuracy.

### 14.1 Confirmed correct by independent re-derivation

| #1785 claim | My independent count | Verdict |
|---|---|---|
| 61 `AppPermission` capabilities | 61 unique in `appPermissions` | ✅ |
| 70 `.sql` migrations (72 dir entries) | 70 `.sql` + `README.md` + `rls_per_table/` | ✅ |
| 67 unique route paths | 69 `path:` defs → 67 unique (`/units`, `/` each twice) | ✅ |
| 21 `REDIRECT_ROUTES`, 11 Money aliases | 21 | ✅ |
| 7 primary nav destinations | 7 in `navGroups` | ✅ |
| Governance hub 8 = 2 routine + 6 specialist; company registry 8 = 5 routine + 3 specialist | matches `governance-hub-sections.ts` / `sectionRegistry.ts` | ✅ |

### 14.2 Incomplete — self-declared

**§15 DB Contract Map** ends with: *"Actual schema object-level enumeration (every table/view/function) was **not** performed row-by-row here → mark `UNKNOWN_NEEDS_REVIEW` for a full per-object owner map."* Its table lists 13 *areas* inferred from migration filenames. The brief for this audit explicitly warns against that method (*"Do not infer capability solely from migration names"*). This audit enumerates all 114 + 11 + 306 objects with per-object reference and grant evidence, and resolves all 125 tables/views to a single classification with zero `UNKNOWN_NEEDS_REVIEW` remaining.

### 14.3 Missing findings — capabilities #1785 does not mention at all

Its §22 "Hidden / Unreachable Capability Report" has 14 rows, all derived from the frontend route/nav layer. Absent from it:

| Missing from #1785 | Where it is here |
|---|---|
| Invoice Credits / credit notes (complete `authenticated`-granted RPC pair, no UI) | §3.1 |
| Due-from-Owner six-function lifecycle (no UI at any step) | §3.2 |
| Owner settlement **cancellation** (RPC granted, UI shows a badge it can't produce) | §3.3 |
| Owner Funds cutover / opening balance | §3.4 |
| Cash-flow & GL drill-through, variance diagnostics | §8 |
| **Tax Authority / VAT configuration workspace** (hidden by a single flag) | §10.2 |
| Communication preferences + governed preview + outbox | §4.1, §9.2 |
| Portal link revocation | §4.4, §9.1 |
| Onboarding revoke-waiver / reset | §4.3 |
| Automation run retry | §4.5 |
| Contract registration profile configuration | §4.2 |
| S08/S09 service layer with 13 unconsumed operations | §5.5 |
| `tenant.portal.link` permission mismatch | §6 |
| The 8 orphan tables | §5.4 |
| The `showInPrimaryNavigation` mechanism as the *cause* of most hidden surfaces | §2 |

### 14.4 Specific claims that need qualifying

| #1785 statement | Correction / qualification |
|---|---|
| §22: *"Generic People … `/people` … Intended? **YES** … lock: identity canonical, people not a pillar"* | The **intent** is documented, but `/people`, `/leads`, `/lands`, `/communication` and `/service-providers` are not listed as hidden anywhere in §22, and `/leads` has **zero** in-product links. "Intended" and "discoverable" are conflated — §7 separates them |
| §22: *"Admin support ops … Intended? YES … route only"* | True but understated: the **only** in-product link to `/admin-support` is `system-page.tsx:21`, which renders at `settings?section=system-settings` — itself a hidden tab. The route is effectively unreachable without URL knowledge |
| §22: *"Onboarding … ACTIVE (dashboard checklist)"* | Correct as far as it goes, but `revokeOnboardingWaiver` has zero consumers and `reset` is wired in the hook yet called by no component. GAP-005's claim that *"revoke/reset … UI authority are implemented and tested"* is **incomplete** |
| §4 Domain Matrix: *"Commissions … ACTIVE (nav under Money? deep link)"* — with a literal question mark | Resolved: `commissions` is a **visible** view in Money → `fees` (`financeShellModel.ts:82`, `showInSectionNavigation` unset). The standalone `/commissions` route is redundant, not hidden |
| §4 Domain Matrix: *"Lands … ACTIVE (Phase2 standalone)"* | Needs qualifying: `lands` has `showInPrimaryNavigation: false` in `portfolioHubSections` **and** no in-product link, so the register is undiscoverable even though the route is active |
| §18 / §15: Tenant Portal *"deferred at the data layer … `TENANT_PORTAL_READ_MODEL_UNAVAILABLE`"* (quoted from the 2026-08-27 P4 note in doc 07) | **Stale.** That string no longer exists in `rentrix-app/src`; `get_tenant_portal_snapshot` is live and returns a real snapshot |
| §24A: *"No file was confirmed dead."* | Correct **for frontend files** — this audit does not contradict it. But at the DB layer, 8 tables have no consumer of any kind (§5.4). The two statements cover different layers |
| §32 accuracy table: route partition *"20 redirect-only + 1 partial + 46 active = 67"* | ✅ Re-verified as correct |

---

## 15. Explicit uncertainty

| Item | Uncertainty |
|---|---|
| Runtime behaviour | This is a **static** audit. No route was loaded in a browser and no RPC was executed against a live database. "Discoverable" means "an in-product link or tab exists in the merged source", not "verified clickable in a deployed build" |
| `app_permission_catalog` completeness | I read the catalog `INSERT` statements across five migrations (`…005`, `…039`, `…044`, `…051`, `…065`). A catalog row inserted by a path I did not read could exist. The 61-value frontend list and the catalog inserts I found are consistent |
| Hosted grants/RLS | Grants were read from migration source. GAP-003/GAP-021 record that hosted Auth/RLS/grant state is unverified, so a deployed database could differ |
| Orphan verdicts | "No consumer" was proven for the repository at `87c55fc`. An external integration writing through `service_role` outside this repo would not be visible here |
| `communication_delivery_outbox` intent | The `prepare_communication_preview_atomic` comment says *"No external send and no recipient address/content storage"*, which may mean the outbox is deliberately write-only-on-preview. I could not determine from source whether an outbox *history view* was ever intended |
| Master Lease future | Classified per current RC1 scope. If WP-04 is authorised, §5.2 changes from `INTERNAL_INFRASTRUCTURE` to a product module |

---

## 16. Reproduction

All findings are reproducible from the baseline without installing dependencies:

```bash
git rev-parse origin/main                       # 87c55fc1f245a8726256826e669422a54f249314
node scripts/check-doc-links.mjs                # documentation link check (see below)

# DB contract counts — parse the Tables/Views/Functions sections of the generated types
grep -c "^      [a-z0-9_]*: {" rentrix-app/src/types/database.ts

# Route census
grep -o "path: '[^']*'" rentrix-app/src/app/router/route-tree.ts | sort -u | wc -l   # 67

# Reachability of any candidate object (catches cast-wrapped RPC calls)
grep -rn "create_invoice_credit_atomic" rentrix-app/src supabase/functions scripts
grep -n "GRANT ALL ON FUNCTION \"public\".\"create_invoice_credit_atomic\"" \
  supabase/migrations/20260901000000_canonical_baseline.sql                        # -> authenticated
```

**Documentation check actually run for this change:** `node scripts/check-doc-links.mjs` → exits with **1 pre-existing issue**, `skills/academy-guide/SKILL.md:82 missing target: URL`. That file is vendored Anthropic skill content (PR #1779), is untouched by this audit, and fails identically on the clean baseline. This audit adds one new markdown file containing no relative links, so it introduces no new failures. No application source, schema, migration, or test was modified.
