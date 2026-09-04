# MALEK — Capability Discovery & Product Gap Audit

**Repo:** `mohamedmasoud3030-tech/malek` · **Baseline:** `main` @ `87c55fc1f245a8726256826e669422a54f249314`
**Method:** authoritative DB0 census (real PostgreSQL replay of all 72 migrations under PGlite 18) joined to a symbol-level frontend reachability graph.
**Scope of claim:** documentation only. No application code was changed by this audit.
**Date:** 2026-09-04

---

## 0. Method and why this is not another grep

Most "capability audit" documents fail because they infer capability from folder names and file
greps. This audit is built on **executed database state**:

| Layer | Source of truth | How derived |
|---|---|---|
| Schema objects | `scripts/db0/audit.mjs` → `db0/inventory.json` | Full replay of `supabase/migrations/**` in PGlite; not filename reading |
| Live function ACLs | `/home/user/audit/live_fn_acl.json` | `pg_proc` + `has_function_privilege()` + `aclexplode(proacl)` **after** every migration has run — i.e. final state, not per-migration text |
| Contract surface | `rentrix-app/src/types/database.ts` | Generated (re-derived here; never hand-read as truth without replay) |
| Real consumers | `fe_rpc_prod.json`, `table_any_refs.tsv` | `\.rpc\b … ['"]name['"]` rescan (recovers 14 call-sites the stock `frontend-scan.mjs` regex misses) + per-table `.from()` scan, prod vs test separated |
| Reachability | `route-tree.ts`, `app-nav-items.ts`, `route-contract.ts`, 5 hub section registries, `command-registry.ts` | Brace-matched route parsing (71 routes), 61 route→sidebarRoot bindings, inbound-link graph per route/hub tab |
| RLS posture | `table_rows.json` | 251 policies classified per table into READ_ONLY / READ_WRITE / DENY_ALL / NO_POLICY |

**False-positive rule applied throughout:** a table that no browser queries is *not* a gap by
itself. 72 of 115 tables are `READ_ONLY`-by-design and 16 are `DENY_ALL`; those are governed-RPC
internals, not missing features. `BACKEND_ONLY_CAPABILITY` is reserved only for real operator or
business workflows that a human is supposed to drive.

---

## 1. Executive summary

### Database contract (live replay, 70/70 migrations applied, 0 replay blockers)

| Object | Count |
|---|---|
| Tables | **115** |
| Columns | 1,790 |
| Views | **11** |
| Functions (live) | **400** — 306 exposed through the PostgREST contract, **93 internal** (`auth_exec=false`, reached only via triggers/definer chains) |
| Enums | 4 |
| Foreign keys | 265 |
| Table constraints | 1,748 |
| Policies (RLS) | 251 |
| Triggers | 131 |
| Indexes | 420 |

Contract drift: **29 MAJOR `DB0-07` findings, 0 blockers** — all drift is in the generated-type
vs live-ACL boundary, none in schema shape.

### Frontend surface

71 routes · 61 permission keys (`appPermissions`) · **21** server-authoritative permission codes
(`app_permission_catalog`) · 5 hub workspaces · 15 command-palette commands · 123 RPC names called
from prod code.

### Capability census — 96 assessed capabilities

| Classification | # | What it means here |
|---|---:|---|
| `IMPLEMENTED_VISIBLE` | 41 | Wired DB→RPC→service→UI and reachable by a human |
| `IMPLEMENTED_HIDDEN_INTENTIONAL` | 17 | Deliberately off the routine path; policy- or doc-justified. **Do not add UI.** |
| `INTERNAL_INFRASTRUCTURE` | 12 | Idempotency, audit, GL internals, job internals, portal-link stores. **Must not get UI.** |
| `SERVICE_WITHOUT_SURFACE` | 9 | Complete service/hook layer, no route/nav affordance |
| `BACKEND_ONLY_CAPABILITY` | 5 | Governed mutation RPCs for a real business workflow, zero UI |
| `PARTIAL_IMPLEMENTATION` | 5 | Read path exists, the closing action does not |
| `ROUTE_WITHOUT_DISCOVERY` | 3 | Live route, no primary nav entry and no inbound link |
| `PERMISSION_WITHOUT_SURFACE` | 2 | Genuine `PERMISSION_WITHOUT_SURFACE` cases (see §6) |
| `COMPATIBILITY_ONLY` | 2 | Superseded `_impl` / `_v2` / broad-parent pairs awaiting removal |
| `ORPHAN_CONFIRMED` | 0 | The three previously-suspected orphans were reclassified (see §10) |
| `MISSING_PRODUCT_CAPABILITY` | 0 | No *absent* business concept was found — the DB already models everything audited; gaps are **surface**, not **schema** |
| `UNKNOWN_NEEDS_REVIEW` | 0 | — |

### The one-sentence answer

**The backend of this product is significantly more capable than the frontend exposes, and the
single largest gap — larger than any missing feature — is that 40 of 61 frontend permission codes
do not exist in the server permission catalog, which silently locks non-`ADMIN` roles out of most
of the application.** Fixing that unlocks the existing surfaces; everything else in this document
is additive.

### Ranked headline

| # | Finding | Severity |
|---|---|---|
| 1 | 40/61 FE permission codes are absent from `app_permission_catalog`; `current_user_has_effective_app_permission()` fails closed on them → 14 routes unreachable for every non-ADMIN role | **P0 / CRITICAL** |
| 2 | `resolve_active_tax_profile` + `resolve_active_fee_tax_treatment` are `service_role`-only but are called from the browser → readiness pages throw 42501 | **P0** |
| 3 | Entire accounting governance stack (WP05 reconciliation, S08 frozen reviews, S09 corrections, period close) is a finished client service with no surface | **P1 / HIGH** |
| 4 | Credit notes (`invoice_credits`) fully governed, fully granted, zero UI, and required by the source-of-truth docs | **P1 / HIGH** |
| 5 | `due_from_owner` (GAP-008) declared VERIFIED_IMPLEMENTED in docs, SQL-complete, pgTAP-covered, but no finance surface exists | **P1 / HIGH** |
| 6 | Outbound communication is preview-only and never touches its own `communication_delivery_outbox` backend | **P1 / HIGH** |
| 7 | 111 browser-executable RPCs have no production caller (incl. portal-link revocation, onboarding reset, support-status) | **P2** |
| 8 | 3 contract RPCs are unreachable from every path — true orphans | **P2** |
| 9 | 8 granular governance/permission mutation RPCs are browser-granted with no UI (owner overrides, grant history, atomic approve/reject) | **P2** |
| 10 | 11 views are granted to `authenticated` and read by nobody; 8 report RPCs granted and unused | **P3** |

---

## 2. Hidden capabilities — ranked

Ranking rubric: **business value × distance from done × blast radius of not having it.**

### HIGH

#### H1 — Accounting governance: WP05 reconciliation assertions, S08 frozen reviews, S09 corrections
*The biggest SERVICE_WITHOUT_SURFACE in the codebase.*

- **Evidence (DB):** `accounting_periods`, `accounts`, `journal_batches`, `journal_lines`,
  `s08_frozen_reviews`, `s09_corrections`, `wp05_correction_proposals`,
  `fixed_monthly_daily_accruals` — all `READ_ONLY` RLS with **zero** frontend `.from()` queries
  (by design). 15 live functions attach to `accounting_periods` alone.
- **Evidence (RPC):** all browser-`EXECUTE`-granted, all with **no production caller** outside one
  file: `wp05_get_reconciliation`, `wp05_assert_reconciliation`, `wp05_list_reconciliation`,
  `wp05_generate_variance_diagnostics`, `wp05_propose_correction`, `wp05_approve_correction_proposal`,
  `wp05_reject_correction_proposal`, `wp05_assert_no_unapproved_correction_postings`,
  `s08_list_frozen_reviews`, `s08_create_frozen_review`, `s08_analyze_frozen_review`,
  `s08_approve_frozen_review`, `s09_create_correction_draft`, `s09_validate_correction`,
  `s09_apply_correction`, `s09_reverse_correction`, `create_accounting_period`,
  `update_accounting_period_status`.
- **Evidence (service):** `rentrix-app/src/features/accounting/wp05Services.ts` (~520 lines) is a
  **complete, typed, governed client** for all of the above — reconciliation, cash-flow +
  drill-through, frozen reviews (list/create/analyze/approve), correction lifecycle
  (draft→validate→apply→reverse). Symbol-level scan: **16 of its 19 exports have no importer
  outside the file and its tests.** Its only outside import in the entire app is
  `import type { ReconciliationRow }` at
  `features/reports/components/accounting/accounting-reconciliation-readiness.tsx:8`.
  `accountingPeriodsService.ts` exports `createAccountingPeriod` / `updateAccountingPeriodStatus`
  with **zero production importers** (tests only).
- **What the user actually sees today:** `GeneralLedgerCoreSection.tsx` renders read-only
  accounts / periods / batches tables and a single refetch `Button`, then the empty state
  *"راجع مسؤول النظام لفتح الفترات المحاسبية"* — i.e. the UI tells the accountant to go ask an
  admin, while the product already contains the RPC that opens the period.
- **Missing layer:** route + nav + permission gate + mutation wiring. The service and RPCs exist.

#### H2 — Credit notes / invoice reversal
- **DB:** `invoice_credits` (READ_ONLY RLS, 0 FE queries).
- **RPC:** `create_invoice_credit_atomic`, `reverse_invoice_credit_atomic` — browser-granted.
- **Consumers:** 3 references, **all in tests**. No prod service, no route, no nav entry, no
  internal/trigger caller.
- **UI:** `invoice-actions.ts` implements **print/export only**. `documentRegistry.ts` knows only
  `invoice` and `receipt`. There is **no credit / refund / void action anywhere** in the app.
- **Docs demand it:** `docs/source-of-truth/02:29` (OPS-010), `03:80`, `04`.
- Classification: `BACKEND_ONLY_CAPABILITY` **and** `PARTIAL_IMPLEMENTATION`.

#### H3 — Due-from-owner ledger (GAP-008)
- **DB:** `due_from_owners`, `due_from_owner_offsets`, `due_from_owner_recoveries` — all READ_ONLY
  RLS that **grants SELECT to ADMIN/MANAGER/ACCOUNTANT by design**, and all are queried by nobody.
- **RPC:** `create_owner_receivable_atomic`, `offset_owner_receivable_atomic`,
  `recover_owner_receivable_atomic`, `reverse_owner_receivable_atomic` — browser-granted,
  **zero prod / test / Edge-Function / internal consumers**.
- **Only SQL consumer:** `gl_pm_post_owner_expense ← create_owner_receivable_atomic` — and that
  whole `gl_pm_post_*` family (8 functions) is itself caller-less.
- **Docs contradiction:** `docs/source-of-truth/07:151` / Doc-7 mark OPS-012 / FIN-008 / GAP-008 as
  **VERIFIED_IMPLEMENTED**, backed by pgTAP `wp02_gap008_due_from_owner.sql` (23 PASS). The SQL is
  genuinely done; **the product surface is not.**
- **Nearest existing UI:** `OwnerAgreementsManager.tsx:270` renders the `offset_allowed` gate —
  the config switch with nothing behind it.
- Classification: `BACKEND_ONLY_CAPABILITY` + `PARTIAL_IMPLEMENTATION`.
- **Audit consequence:** any doc that treats GAP-008 as shipped is overstating delivery.

#### H4 — Permission model: catalog vs frontend divergence (also finding #1 overall)
See §6 — classified as a P0 defect, not a "hidden capability", but it is what makes every other
hidden capability *unklickable* for normal staff.

#### H5 — Outbound communication is a preview that never meets its own backend
- `features/communication/services/outbound-communication-service.ts` declares
  `outboundProviderCapabilities` = whatsapp `{mode:"preview", configured:true, live:false}`,
  email `{mode:"preview", live:false}`, sms `{provider:"none", live:false}`.
- `sendOutboundMessage` → `PreviewCommunicationAdapter` (`communication-system.ts:418`) →
  `prepareCommunicationPreview` (`:340`) — a **pure local function**. Returns
  *"تم تجهيز معاينة محلية فقط…"*.
- It **never** calls `prepare_communication_preview_atomic`, **never** reads
  `communication_preferences` (DENY_ALL) and **never** writes `communication_delivery_outbox`
  (DENY_ALL). Templates are hardcoded `compatibilityTemplates` (4 × ar/en).
- `communication_records` **is** genuinely wired — so the *record* half is real and the *send*
  half is theatre. Classification: `SERVICE_WITHOUT_SURFACE` (the atomic preview RPC) +
  `PARTIAL_IMPLEMENTATION` (outbound).
- **Note:** this is honest preview (the mode is declared to the user), not a lie. The gap is that
  the governed backend already exists and is unwired.

### MEDIUM

#### M1 — Portal links: creation wired, revocation orphaned
`createOwnerPortalLink` is used (`owner-detail-view.tsx:108`); `TenantPortalLinkAction` renders in
`TenantPreviewDialog.tsx:243`. But `revoke_owner_portal_link` and `revoke_tenant_portal_link` are
browser-granted with **no caller at all**. A link, once minted, cannot be withdrawn from the UI
(`owner_portal_links` / `tenant_portal_links` are DENY_ALL tables, so there is no escape hatch).
Security-relevant, small to fix.

#### M2 — Onboarding: waive/complete wired, reset and waiver-revocation are not
`useOnboarding.ts` wires the waive mutation; `OnboardingChecklist.tsx` calls `onboarding.waive` +
`onboarding.complete`; the only production importer of `features/onboarding` is
`dashboard-page.tsx:11`, gated `canManageSetup = ADMIN|MANAGER`. But
`reset_company_onboarding_atomic` and `revoke_onboarding_waiver_atomic` have **no non-test
caller**. Tables `company_onboarding_completion`, `company_onboarding_events`,
`company_onboarding_waivers`, `onboarding_requirement_templates` are READ_ONLY with 0 FE queries
(correctly — they are RPC-backed). Missing layer: two buttons.

#### M3 — Eight granular governance/permission mutation RPCs with no UI
`set_employee_permission_override_atomic`, `bulk_set_employee_permission_overrides_atomic`,
`clear_employee_permission_override_atomic`, `list_employee_permission_history`,
`approve_permission_request_atomic`, `reject_permission_request_atomic`,
`set_employee_app_permission_grant_atomic`, `list_user_permission_grants`,
`revoke_user_permission_grant` — all browser-granted, all zero prod callers, while the *legacy*
pair `set_employee_permission` / `decide_permission_request` **is** wired
(`features/auth/permission-request-service.ts`, consumed by
`governance-hub/use-employee-permission-management.ts`). The modern atomic layer was built and
the UI was never moved onto it.

#### M4 — Company profile mutation RPCs
`update_company_legal_info_atomic`, `update_company_financial_profile_atomic`,
`update_company_communication_channels_atomic` — browser-granted, no prod caller. The settings
company tab reads via an adapter (`companySettingsContractAdapter.ts`) but does not use the
governed atomic writers.

#### M5 — Support request lifecycle, second half
`create_support_request_atomic`, `list_my_support_requests`, `triage_support_request_atomic`,
`get_admin_support_operations_snapshot`, `propose_user_access_change_atomic` are **all genuinely
wired** (admin-support page + `useMutation`). But
`update_support_request_status_atomic` has no caller — and is one of the three true orphans (§8).

#### M6 — Chart of accounts bootstrap & journal listing
`chartOfAccountsService.ensureRequiredAccounts` and `journalService.listJournalLines`
(5/6 exports unconsumed) — real service code, no caller. Low risk; they are the read/bootstrap
halves of H1.

### LOW

- **L1 — Reports granted but unused.** Live report RPCs in use: `rpt_trial_balance`,
  `rpt_income_statement`, `rpt_balance_sheet`, `rpt_cash_flow_gl`, `rpt_daily_collection`,
  `rpt_dashboard_snapshot`, `rpt_vat_return`, `rpt_tenant_statement`, `rpt_owner_statement`,
  `rpt_owner_financial_position`. **Browser-granted and unused:** `rpt_aged_receivables`,
  `rpt_cash_flow`, `rpt_dashboard_overview`, `rpt_financial_summary`, `rpt_general_ledger`,
  `rpt_overdue_invoices`, `rpt_rent_roll`, `rpt_rc1_owner_agency_invoice_mapping_diagnostics`.
  Note the near-duplicate pairs (`rpt_cash_flow` vs `rpt_cash_flow_gl`,
  `rpt_dashboard_overview` vs `rpt_dashboard_snapshot`) — these are `COMPATIBILITY_ONLY`
  candidates, not features to surface.
- **L2 — All 11 views are unread by the frontend.** `journal_entries`, `party_directory`,
  `vw_active_owner_agreements`, `current_property_ownership`, `v_balance_reconciliation`,
  `v_balance_reconciliation_drift`, `s08_analysis_scope`, `s08_liability_balances_by_period`,
  `s08_master_lease_readiness`, `s08_retroactive_version_differences`,
  `s08_subledger_gl_reconciliation` — each `security_invoker=true` and granted to
  `authenticated, service_role`; **0 of 11 appear in any `.from()` call.** Most are RPC-internal
  joins (the `s08_*` set is the frozen-review engine's own scaffolding) and should **not** be
  surfaced; `party_directory`, `vw_active_owner_agreements` and `journal_entries` are the ones
  worth a decision (expose or revoke the grant).
- **L3 — Contract templates are seed-only.** `contract_inspection_templates` and
  `contract_registration_requirement_profiles` are READ_ONLY RLS **and have no write RPC at all**
  — they can only be changed by a migration. Every *record* RPC in the evidence chain exists; the
  *configuration* does not. This is a real product constraint, not a frontend gap.

---

## 3. Backend-only capabilities (real workflows, no surface)

Exact DB + RPC evidence, and precisely which layer is absent.

| # | Capability | DB objects | Governed RPCs (all browser-granted unless noted) | Missing layer |
|---|---|---|---|---|
| B1 | Credit notes / invoice reversal | `invoice_credits` (READ_ONLY, 0 FE) | `create_invoice_credit_atomic`, `reverse_invoice_credit_atomic` | action in `invoice-actions.ts` + route + `financial.invoices.*` gate + GL link |
| B2 | Due-from-owner receivables | `due_from_owners`, `_offsets`, `_recoveries` (READ_ONLY, 0 FE) | `create_owner_receivable_atomic`, `offset_owner_receivable_atomic`, `recover_owner_receivable_atomic`, `reverse_owner_receivable_atomic` | owner-finance view under `/financials`; downstream `gl_pm_post_owner_expense` also unwired |
| B3 | Period close / reopen | `accounting_periods` (READ_ONLY, 0 FE, 15 attached fns) | `create_accounting_period`, `update_accounting_period_status`, `list_accounting_periods` | mutation UI in `GeneralLedgerCoreSection.tsx`; HARD_CLOSED immutability + reason capture already enforced server-side |
| B4 | Frozen review + correction lifecycle | `s08_frozen_reviews`, `s09_corrections`, `wp05_correction_proposals` | 4 × `s08_*`, 4 × `s09_*`, 7 × `wp05_*` | none needed in service — `wp05Services.ts` already implements it; needs route only |
| B5 | Portal-link revocation | `owner_portal_links`, `tenant_portal_links` (DENY_ALL) | `revoke_owner_portal_link`, `revoke_tenant_portal_link` | one destructive button per existing link action |
| B6 | Onboarding reset / waiver revocation | `company_onboarding_*` (READ_ONLY, 0 FE) | `reset_company_onboarding_atomic`, `revoke_onboarding_waiver_atomic` | admin-only affordance next to `OnboardingChecklist` |
| B7 | Employee permission overrides (modern API) | `user_permission_overrides` (DENY_ALL), `user_permission_grants` | 8 × `*_atomic` / history / grant RPCs | migrate `UserRolesWorkspace` off the legacy pair onto these |
| B8 | Company legal/financial/channel profile writes | `companies` (READ_ONLY, 0 FE) | 3 × `update_company_*_atomic` | point `companySettingsContractAdapter` writes at these |

**Correctly internal — no UI wanted, and none should be added** (RLS `DENY_ALL` + no browser
`SELECT`, confirmed against live policies): `admin_support_audit_events`,
`admin_user_access_change_proposals`, `ai_assistant_budget_reservations`,
`ai_assistant_rate_limits`, `background_jobs` / `_events` / `_schedules`,
`communication_delivery_outbox`, `communication_preferences`, `owner_portal_links`,
`tenant_portal_links`, `support_requests` / `_events`, `user_permission_overrides`,
`financial_operation_idempotency`, `automation_run_logs`, `automation_jobs`.

---

## 4. Partial workflows — what exists, and the exact missing step

| Workflow | Exists today | Exact missing step |
|---|---|---|
| **Reconciliation variance → resolution** | `accounting-reconciliation-readiness.tsx` renders the variance table and a refetch, importing **only the type** `ReconciliationRow` | the **assert / propose-correction** action. `wp05_assert_reconciliation`, `wp05_generate_variance_diagnostics`, `wp05_propose_correction` and their service wrappers already exist. It shows the problem and stops. |
| **GL journal posting lifecycle** | `journalService.ts` reads batches; GL section lists them read-only; period guard `gl_ensure_initial_open_period` / `guard_accounting_period_no_overlap` enforced in DB | **nothing is missing by design** — the missing piece is *period open/close*, and adding direct journal authoring is forbidden (§5). |
| **Owner agreement → offset execution** | `OwnerAgreementsManager.tsx:270` toggles/renders `offset_allowed` | the execution side: `offset_owner_receivable_atomic` has no caller. The permission is declared and never acted upon. |
| **Communication record → delivery** | `communication_records` fully wired; templates preview correctly | persistence: `prepare_communication_preview_atomic` → `communication_delivery_outbox` write path. The outbox table, its DENY_ALL policy and the atomic RPC all exist; the service never calls them. |
| **Contract lifecycle actions** | Contract detail workspace wires the full **evidence / registration / inspection** atomic chain (6 atomic RPCs via `contract-evidence-service.ts` → `ContractDetailWorkspace.tsx`) | `contract_cancel_atomic`, `contract_extension_atomic`, `contract_reactivation_atomic`, and `ensure_tenant_lease_snapshot_atomic` (auto at approval) have no prod UI action. Read + evidence yes; state transitions no. |
| **Support request lifecycle** | create / list / triage / snapshot / access-change-propose all wired end-to-end | `update_support_request_status_atomic` (and the `support_requests` status column it drives) — no UI path beyond triage. |
| **Documents vault** | `documents-vault-workspace.tsx` lists + opens documents, reachable at `/maintenance?section=documents_vault`; `/documents-vault` legacy alias redirects correctly to it | **upload and delete** (`uploadVaultDocument`, `validateVaultFile`, `softDeleteVaultDocument` → 0 importers). **This is intentional**: the component documents it at line 67 — *"Cross-entity document index only. Upload/replace/archive operations belong to [the owning entity]."* `canUpload={false}` is deliberate. Classified `IMPLEMENTED_HIDDEN_INTENTIONAL`, **not** a gap. |

---

## 5. Intentionally hidden / internal — do NOT add UI

This is the guardrail section. Every item below was checked for a deliberate decision, not just for
absence of usage.

| Capability | Why it is internal | Evidence |
|---|---|---|
| **Raw GL journal authoring** (`gl_create_journal_batch`, `gl_post_journal_batch`, `gl_reverse_journal_batch`, `post_journal_event`) | Security architecture forbids browser journal writes. These are `service_role`-only by policy. | `supabase/migrations/20260901000028_secure_function_default_privileges.sql` (revokes default EXECUTE; the `__default_function_acl_probe` assertion **hard-fails migration replay** on regression) + `docs/source-of-truth/04` FIN-015 + CI guard `scripts/check-no-new-legacy-journal-writes.mjs`. → `IMPLEMENTED_HIDDEN_INTENTIONAL`. **No recommendation in this audit adds a journal-authoring UI.** |
| Deposits, Automation, Data Integrity, Audit/System, advanced GL surfaces, MASTER_LEASE specialist UI | Explicit product simplification decision: hidden from *routine* UX, retained in governed core, not deleted. | `docs/source-of-truth/01:79` ("HIDE from routine UX…"), `00_INDEX:56` |
| Generic People view, aggregate Documents Vault | Not product pillars. | `docs/source-of-truth/00_INDEX:58` |
| `financial_operation_idempotency`, `background_jobs*`, `automation_run_logs`, `*_events`, audit tables | Job/workflow internals and write-path bookkeeping; consumed by RPCs and triggers, never by clients. | DENY_ALL policies in live `pg_policies`; classified `INTERNAL_INFRASTRUCTURE` |
| `s08_*` views (`s08_analysis_scope`, `s08_liability_balances_by_period`, `s08_master_lease_readiness`, `s08_retroactive_version_differences`, `s08_subledger_gl_reconciliation`) | Internal scaffolding of the frozen-review engine that backs the `s08_*` RPCs; exposing them would bypass the governance boundary | granted but unread by FE; used only inside definer functions |
| `journal_batches` / `journal_lines` | Read only through `list_journal_*` RPCs; direct select intentionally withheld | READ_ONLY/NO_POLICY + 0 FE queries + doc 04 |
| Mobile bottom navigation intentionally empty | `mobileNavItems` deliberately `[]` | `app-nav-items.ts` |

**Rule applied:** the 93 internal functions (`auth_exec=false`) and the 16 `DENY_ALL` tables were
*never* offered as UI candidates. Hiding is a decision here, not an oversight.

---

## 6. Permission-without-surface

### 6.1 The P0: the frontend has 61 permissions, the server has 21

- `app_permission_catalog` contains exactly **21 rows** (verified by live query, not by regex):
  `contracts.{view,create,edit,approve,cancel}`, `properties.{view,create,edit,archive}`,
  `maintenance.{create,edit,approve,cancel,write}`, `financial.workspace.view`,
  `financial.reports.view`, `owner.portal.link`, `tenant.portal.link`, `support.operations.view`,
  `support.requests.triage`, `support.user_lookup.view`.
  Populated only by migrations `…000005`, `…000039`, `…000044`, `…000051`, `…000065`.
- `rentrix-app/src/features/auth/permissions.ts` declares **61** `appPermissions`.
- **40 codes exist only in the frontend.**
- `current_user_has_effective_app_permission(p)` opens with a hard catalog gate **before any
  admin/role logic**:
  ```sql
  if not exists(select 1 from public.app_permission_catalog c where c.permission = p_permission)
  then return false; end if;
  ```
  and `list_my_effective_app_permissions()` selects `FROM public.app_permission_catalog`.
- The client resolution chain makes this fatal: `use-auth.tsx` sets
  `effectivePermissionsResolved = true`, `canAccess()` (permissions.ts:346) then
  `return effective` **without falling back to the role map**, and
  `loadGrantedPermissions()` can only ever return codes present in the catalog.

**Measured consequence** (executed against the replayed DB):

| Role | Permissions the role map grants | Server-resolvable | Unreachable forever |
|---|---:|---:|---:|
| ADMIN | 61 | 21 (short-circuited to all 61 in the client) | — |
| MANAGER | 50 | **18** | **32** |
| OPERATIONS | 22 | **8** | 14 |
| ACCOUNTANT | 17 | **2** | 15 |
| VIEWER | 20 | **4** | 16 |
| USER | 2 | **0** | 2 |

`ADMIN` is immune only because `effective-permissions.ts:39` hard-codes
`if (base.role === 'ADMIN') return { grantedPermissions: appPermissions, … }` — and there is a test
(`effective-permissions-admin.test.ts`) asserting exactly that. **The admin-only escape hatch is
why this has never been noticed.**

**14 routes are gated on a code the server can never grant**, so their `requirePermission(...)`
beforeLoad fails closed for every non-ADMIN user, and `canShowNavigationItem` hides them from nav:
`arrears.view`, `automation.view`, `commissions.view`, `communication.view`, `expenses.view`,
`financial.bank_reconciliation.view`, `financial.deposits.view`, `financial.owner_settlements.view`,
`lands.view`, `leads.view`, `owners.detail.view`, `owners.hub.view`, `service_providers.view`,
`service_providers.write`.

> **Scope caveat / uncertainty:** this is derived from migration-replayed DB state + the current
> client resolver. It is a *fail-closed* defect: it under-grants rather than over-grants, so it is
> not a security breach — it is an availability gap. It presumes the deployed
> `app_permission_catalog` matches the migrations; if rows were added out-of-band in the hosted
> project, the count changes. Re-verify with
> `select count(*) from public.app_permission_catalog;` before acting.

### 6.2 Genuine `PERMISSION_WITHOUT_SURFACE` (declared, catalog-backed, nothing uses them)

| Permission | Only references | Note |
|---|---|---|
| `support.requests.triage` | `permissions.ts` (const + label + ADMIN map) | The triage RPC **is** production-called (`triage_support_request_atomic`) — and the button in `admin-support-page.tsx:263` is gated by `snapshot.capabilities.triage`, computed **server-side**, not by the FE permission. The FE code is decorative. |
| `support.user_lookup.view` | `permissions.ts` | Same: ADMIN-ONLY + not-requestable in the catalog; enforcement lives in `current_user_has_support_capability`. Correct as internal. |
| `tenant.portal.link` | `permissions.ts` + tests | **Mismatch:** `TenantPortalLinkAction.tsx:26` gates on `users.manage`, while the RPC (`create_tenant_portal_link`) enforces `tenant.portal.link`. The owner twin does it right (`OwnerPortalLinkAction.tsx:24` → `owner.portal.link`). One-line fix, and it is the only place where the FE gate and the server gate disagree on a *catalog* permission. |

The other 13 codes previously suspected here
(`settings.manage`, `properties.write`, `contracts.write`, `maintenance.write`,
`permission_requests.review`, `cost_centers.manage`, `expenses.write`, `financial.*.export/void`,
`documents.write`, `users.manage`, `system.view`, `audit.view`, `integrity.view`) are **not**
independent findings — they are all symptoms of §6.1 plus the documented legacy
broad-parent compatibility layer (`properties.write`/`contracts.write`/`maintenance.write` are
explicitly `requestable=false` compatibility parents, `…000051:34-38`). `settings.manage` is
labelled "(توافق قديم)" in the FE itself. Classified `COMPATIBILITY_ONLY`, not
`PERMISSION_WITHOUT_SURFACE`.

> **Explicitly not claimed:** I did **not** attempt to assert a frontend↔`app_permission_catalog`
> code mismatch from regex-parsed migration INSERTs. My first regex pass captured only 3 codes and
> was discarded; §6.1's numbers come from the live catalog query instead.

---

## 7. Routes without discovery

71 routes were brace-matched from `route-tree.ts`; discoverability was measured as an inbound-link
graph over `app-nav-items.ts` (primary nav + `workspaceChildNavItems`), `route-contract.ts`
(61 route→sidebarRoot bindings), the 5 hub section registries, and `command-registry.ts`
(15 static commands).

Discovery vocabulary used: **primary nav · secondary hub nav · contextual action · command palette ·
deep-link only · external portal · DEV-only**.

| Route | Current discovery | Classification |
|---|---|---|
| `/automation` | secondary hub nav only (`/settings?section=automation`, and that section has `showInPrimaryNavigation:false`) | `ROUTE_WITHOUT_DISCOVERY` |
| `/audit-log` | hub tab `audit-log`, `showInPrimaryNavigation:false` | `ROUTE_WITHOUT_DISCOVERY` |
| `/data-integrity` | hub tab `data-integrity`, `showInPrimaryNavigation:false` | `ROUTE_WITHOUT_DISCOVERY` |
| `/system` | hub tab `system-settings`, `showInPrimaryNavigation:false` | deep-link only — but this is the *only* prod UI that links audit-log / data-integrity / security / company / admin-support, so it is load-bearing, not dead |
| leasing hub `?workspace=people` / `=leads` / `=communication` | three of five `leasing-hub-sections.tsx` tabs have **no production setter** — only tests set them | `ROUTE_WITHOUT_DISCOVERY` (deep-link only) |
| `/documents-vault` | correctly redirects to `/maintenance?section=documents_vault` | **not a gap** — deliberate COMPATIBILITY alias, verified reachable |
| `/arrears`, `/overview` | hidden | by design (`01:79`) — **not** findings |
| `/settings` | shows **2 of 8** sections in primary nav | intended product simplification |

Note the discovery math: **15 command-palette commands vs 71 routes**, and
`hub-navigation-contract.test.ts` guards only **3 of 5** hubs — so the hub-nav drift that produced
the leasing tabs above is not caught by CI. `mobileNavItems` is empty by design.

---

## 8. Services without surface

Symbol-level reference census over 142 production service/hook files. 30 files expose ≥50%
unconsumed exports. Material ones:

| Service | Unconsumed exports | Verdict |
|---|---|---|
| `features/accounting/wp05Services.ts` | **16 / 19** | H1 — the flagship gap |
| `features/accounting/journalService.ts` | 5 / 6 (`listJournalLines`) | read helper for H1; journal *writes* stay hidden (§5) |
| `features/accounting/accountingPeriodsService.ts` | 3 / 4 (`createAccountingPeriod`, `updateAccountingPeriodStatus`) | B3 |
| `features/accounting/chartOfAccountsService.ts` | `ensureRequiredAccounts` | M6 |
| `features/communication/services/outbound-communication-service.ts` | 3 / 5 | H5 — preview-only by construction |
| `features/documents-vault/documents-vault-service.ts` | 5 / 10 (`uploadVaultDocument`, `validateVaultFile`, `softDeleteVaultDocument`, `getVaultDocumentDownloadUrl`, `getVaultDocumentsWithSignedUrls`) | **intentional** read-only index (§4) — `listVaultDocuments` / `getVaultDocumentSignedUrl` *are* consumed. Not a gap. |
| `features/owners/owner-portal-admin-service.ts` | revocation half | M1 |
| `features/onboarding/onboardingService.ts` | reset + waiver-revoke | M2 |
| `features/auth/permission-request-service.ts` | 6 of 8 governed RPCs in that domain | M3 |

### True orphans (not "intentionally internal")

Three contract-exposed RPCs fail **every** reachability test simultaneously — ACL, callers,
triggers, internal use:

| Function | Live ACL | Conclusion |
|---|---|---|
| `retry_automation_run` | `{postgres=X/postgres}` | `ORPHAN_CONFIRMED` — granted to no role, zero callers, no trigger, not used inside any definer function |
| `update_support_request_status_atomic` | `{postgres=X/postgres}` | `ORPHAN_CONFIRMED` |
| `execute_automation_rule_internal` | `{postgres=X/postgres}` | `ORPHAN_CONFIRMED` |

The ACL shape `{postgres=X/postgres}` means ownership-only execute. This is the *opposite* of the
tax-RPC defect in §9: there the function is callable and nobody calls it; here the function is
uncallable and nobody calls it. Either delete them or grant + wire them; leaving them in the
contract is the worst option because `database.ts` advertises them.

Worth stating so the census is honest: **232 of 306 contract functions are browser-executable and
123 RPC names are called from prod — leaving 111 browser-executable functions with no production
caller** (full list: `/home/user/audit/browser_never_called.txt`). The large majority of those are
*correctly* unreferenced (trigger-backing, alternate-role entry points, superseded variants). The
tables above list only the ones that map to a human workflow.

---

## 9. Portal, communication and notification status

| Area | Verdict | Detail |
|---|---|---|
| **App notifications** | **Genuinely wired** | `app-notifications-service.ts` selects `app_notifications` directly (allowed — READ_ONLY RLS) and calls `mark_app_notification_read`. `notifications-menu.tsx` renders `Link`s only — navigation to entities works, but there is **no per-notification action** (acknowledge/snooze/resolve), so it is a mailbox, not a worklist. |
| **Owner portal** | Creation wired, revocation missing | `createOwnerPortalLink` from `owner-detail-view.tsx:108`; `revoke_owner_portal_link` orphaned. Portal store is DENY_ALL by design (correct — token-based external access). |
| **Tenant portal** | Creation wired, revocation missing, gate mismatched | `TenantPortalLinkAction` in `TenantPreviewDialog.tsx:243`, gated on `users.manage` instead of `tenant.portal.link` (§6.2). |
| **Outbound communication** | **Preview-only and disconnected** | §H5. `communication_records` real; provider send path absent; `communication_delivery_outbox` + `communication_preferences` DENY_ALL; `prepare_communication_preview_atomic` unused. |
| **Inbound communication / leads / people tabs** | Deep-link only | §7. |
| **Support** | **Wired** | create / list / triage / snapshot / propose-access-change all live in `admin-support-page.tsx`. Status-transition RPC orphaned (§8). |

---

## 10. Financial & accounting hidden-capability status

This is the densest area, so it gets its own verdict table.

| Capability | DB | Governed RPC | Service client | UI | Verdict |
|---|---|---|---|---|---|
| Trial balance / IS / BS / cash-flow-GL / VAT return | ✅ | `rpt_*` | facade + hooks | ✅ `/reports?workspace=financial_review` | `IMPLEMENTED_VISIBLE` |
| Tenant + owner statements | ✅ | `rpt_tenant_statement`, `rpt_owner_statement` | ✅ | ✅ | `IMPLEMENTED_VISIBLE` |
| Fixed-monthly accruals | ✅ | `execute_fixed_monthly_accruals_atomic` (new) vs `gl_run_fixed_monthly_accruals` (old) | ✅ | ✅ visible tab | `IMPLEMENTED_VISIBLE` + `COMPATIBILITY_ONLY` pair |
| Bank reconciliation / deposits / commissions / owner settlements | ✅ | ✅ | ✅ | ✅ tabs visible | `IMPLEMENTED_VISIBLE` — **not** findings |
| Reconciliation **assertion** | ✅ `wp05_correction_proposals` | ✅ granted | ✅ `wp05Services.ts` | ❌ | `SERVICE_WITHOUT_SURFACE` (H1) |
| **Frozen reviews (S08)** | ✅ `s08_frozen_reviews` | ✅ 4 granted | ✅ | ❌ | `SERVICE_WITHOUT_SURFACE` (H1) |
| **Corrections (S09)** | ✅ `s09_corrections` | ✅ 4 granted | ✅ | ❌ | `SERVICE_WITHOUT_SURFACE` (H1) |
| **Accounting period open/close** | ✅ `accounting_periods` | ✅ 2 granted | ✅ | ❌ (read-only table + refetch) | `BACKEND_ONLY_CAPABILITY` (B3) |
| **Credit notes** | ✅ `invoice_credits` | ✅ 2 granted | ❌ | ❌ | `BACKEND_ONLY_CAPABILITY` (B2/H2) |
| **Due from owner** | ✅ 3 tables | ✅ 4 granted | ❌ | ❌ | `BACKEND_ONLY_CAPABILITY` (H3) |
| Chart of accounts | ✅ `accounts` | `provision_company_chart_of_accounts` (old) vs `ensure_company_chart_of_accounts` (new) | partial | read-only | `IMPLEMENTED_VISIBLE` read + `COMPATIBILITY_ONLY` pair |
| **Raw journal authoring** | ✅ `journal_batches/lines` | service_role only | n/a | ❌ **by design** | `IMPLEMENTED_HIDDEN_INTENTIONAL` — keep it |
| Aged receivables / rent roll / overdue invoices / financial summary / GL report / cash-flow (legacy) | ✅ | ✅ granted | ❌ | ❌ | `COMPATIBILITY_ONLY` — superseded by the wired `rpt_*` set; do not surface, retire |
| `rpt_rc1_owner_agency_invoice_mapping_diagnostics` | ✅ | granted | ❌ | ❌ | diagnostic-only; `INTERNAL_INFRASTRUCTURE` |
| `recalculate_all_balances`, `close_journal_batch` | ✅ | granted | ❌ | ❌ | `COMPATIBILITY_ONLY` (superseded by atomic chains) |

### Runtime defect in this area (P0)

`resolve_active_tax_profile` and `resolve_active_fee_tax_treatment` are called **from the browser**
at:

- `billing-readiness-service.ts:120`
- `finance-readiness-service.ts:63` and `:78`
- `tax-authority-service.ts:88`, `:109`, `~169`

but `supabase/migrations/20260901000020_revoke_internal_and_trigger_rpc_execute.sql:313-323`
grants their EXECUTE to **`service_role` only**. `auth_exec=false` in the live ACL, and executing
them as an `authenticated` role against the replayed DB returns
**`permission denied for function resolve_active_tax_profile`** (SQLSTATE 42501). Every Tax /
Finance / Billing readiness surface that touches these two RPCs therefore degrades at runtime.
The only thing preventing this from being caught is a **text-containment test** —
`tax-authority-service.test.ts:18,27` greps source strings instead of exercising the call — plus
`tax-authority-service.ts:89` passing `p_company_id: undefined`.

Fix direction (either): move these two calls into an existing `security definer` readiness RPC, or
grant both to `authenticated`. The second is safe only if the functions already scope by
`require_company_id()`; **prefer the first.**

---

## 11. Missing product capabilities

Applying the "business-evidence-backed only" rule strictly: **no absent domain concept was found.**
For every candidate gap, the schema, the migration history, or the docs already contain the concept.
The honest classification is therefore *schema-complete, surface-incomplete*:

| Candidate | Is the concept modelled? | Actual state |
|---|---|---|
| Credit notes | ✅ `invoice_credits` + 2 atomic RPCs + docs OPS-010 | not missing — unsurfaced (B1) |
| Due-from-owner | ✅ 3 tables + 4 RPCs + pgTAP 23 PASS | not missing — unsurfaced (H3), **and docs overstate it as VERIFIED_IMPLEMENTED** |
| Refund / void receipt | ✅ `refund_deposit_atomic` / `deduct_deposit_atomic` (+ `_governed_atomic` twins) | `PARTIAL_IMPLEMENTATION`: RPCs exist, `financial.receipts.void` has no surface |
| Contract cancel / extend / reactivate | ✅ 3 atomic RPCs | `PARTIAL_IMPLEMENTATION`: no action |
| Inspection / registration requirement **configuration** | ❌ tables exist, **no write RPC at all** | genuinely absent as a product capability — today this is a migration-only workflow (L3). The only true *schema-layer* gap in this audit. |
| Notification triage (acknowledge/resolve) | ❌ no RPC; table has status columns | `MISSING_PRODUCT_CAPABILITY` (small) |
| Outbound delivery (real sending) | ✅ outbox + preferences + atomic preview | deliberately deferred to preview; not missing, but unwired (H5) |
| Multi-entity People / Documents Vault as pillars | ✅ | decided against in `00_INDEX:58` — **not** a gap |

**No speculative features are proposed.** If a capability is not demanded by `docs/source-of-truth/**`,
a migration, an ADR, or an existing-but-unused governed RPC, it is not in this list.

---

## 12. Roadmap — what deserves implementation next

Priority: **P0 = broken now** · P1 = high-value, cheap, already-built · P2 = completes a partial
workflow · P3 = hygiene.

| Capability | Current state | Missing layer | Expected user value | Implementation risk | DB change | Permission change | UI effort | P |
|---|---|---|---|---|---|---|---|---|
| Permission catalog parity (40 codes) | FE declares 61, DB catalog 21; client fails closed for non-ADMIN | `insert` into `app_permission_catalog` for the codes that are real *delegable* capabilities **or** narrow `appPermissions` to the catalog + role-derived UI flags; make `canAccess` fall back to the role map when a code is absent from the projection | Managers, accountants and operations staff can actually reach owners, lands, leads, expenses, arrears, deposits, settlements, bank rec, communications, automation | **High if done blind** — this is the authorization path; must be decided with the security owner, not "fixed" by widening the catalog reflexively | **Yes** (catalog rows) | **Yes** (core) | S (a migration + ~10 lines) | **P0** |
| Tax readiness RPC call path | 42501 at runtime on Tax/Finance/Billing readiness | route the two calls through a `security definer` wrapper RPC | readiness panels stop silently degrading | Low | Yes (1 wrapper fn) or (a grant) | No | S | **P0** |
| Credit-note action on invoices | RPCs + table + service-free | action in `invoice-actions.ts` + list panel; gate `financial.invoices.*` | correct AR correction without ad-hoc journals; closes OPS-010 | Medium (touches GL) — RPC is already atomic + idempotent | No | Possibly 1 new code | M | **P1** |
| Due-from-owner finance surface | 4 RPCs + 3 RLS-readable tables, pgTAP green | owner-receivable view under `/financials` (list + create + offset + recover + reverse) | makes GAP-008 actually usable; makes `offset_allowed` mean something | Medium | No | No | M | **P1** |
| Period open/close UI | service + RPCs done, `GeneralLedgerCoreSection` read-only | create-period + status-change dialogs (reason capture already server-enforced) | month-end closes without a developer | Low-Medium; HARD_CLOSED immutability is already enforced in DB | No | No | S-M | **P1** |
| Reconciliation → assert/correct action | variance shown, no remediation | one "run assertion / propose correction" action calling existing `wp05Services` | turns a report into a workflow | Low | No | No | S | **P1** |
| Frozen-review + correction workspace | full service layer unused | route + list/approve/apply screens over existing `s08_*` / `s09_*` | audit-grade close; the most unused-complete code in the repo | Medium (large surface, no precedent) | No | Yes (likely 1 view code) | L | **P1** |
| Wire outbox from outbound comms | preview-only, backend exists | replace `PreviewCommunicationAdapter` internals with `prepare_communication_preview_atomic` | makes the declared preview state real without new product risk | Medium (keep the `mode` flag honest; do not silently claim `live`) | No | No | M | **P1** |
| Portal-link revocation | create wired, revoke orphaned, DENY_ALL escape hatch | destructive button + confirm on both link actions | closes an open-ended external token | Low | No | Yes (gate on existing `*.portal.link`) | S | **P2** |
| Tenant portal-link gate mismatch | UI checks `users.manage`, RPC checks `tenant.portal.link` | one-line gate change + parity test | consistent delegation | Low | No | No | S | **P2** |
| Onboarding reset + revoke-waiver | 2 RPCs orphaned | admin-only affordance beside the checklist | admins can undo a wrong "complete" | Low | No | No | S | **P2** |
| Contract lifecycle actions (cancel/extend/reactivate) | 3 atomic RPCs orphaned | action buttons in `ContractDetailWorkspace` | removes manual DB work for the most common contract edits | Medium (lease snapshot trigger) | No | Yes (`contracts.cancel` exists; `extend` may need one) | M | **P2** |
| Migrate permission editor to atomic RPCs | legacy `set_employee_permission` in use; 8 modern RPCs unused | swap the service layer, keep `UserRolesWorkspace` | history, audit, idempotency for owner decisions | Medium | No | No | M | **P2** |
| Company profile atomic writers | 3 RPCs orphaned | point `companySettingsContractAdapter` writes at them | consistent governed writes | Low | No | No | S | **P2** |
| Hub discovery for Automation / Audit / Integrity / Leasing tabs | routes live, `showInPrimaryNavigation:false`, leasing tabs deep-link-only; palette 15/71 | nav entries or a documented decision to keep them hidden; extend `hub-navigation-contract.test.ts` to 5/5 hubs | discoverability without new features | Low; must respect `01:79` (hidden ≠ deleted) | No | No | S | **P2** |
| Retire the 3 orphan RPCs | `{postgres=X/postgres}`, unreachable, still advertised in `database.ts` | delete, or grant + wire | stops the contract lying | Low | Yes (drop or grant) | No | S | **P3** |
| Retire superseded report/GL variants | 8 `rpt_*` + `gl_run_fixed_monthly_accruals`, `provision_company_chart_of_accounts`, `close_journal_batch`, `recalculate_all_balances`, `*_phase3a1a_impl`, `*_s02_base`, `create_contract_atomic` vs `_v2`, `record_invoice_payment_atomic` vs `_engine`, `refund/deduct_deposit_atomic` vs `_governed_atomic` | ADR + removal, or explicit "compat, do not use" contract test | halves the perceived surface area | Medium (historical callers in tests/fixtures) | Possibly | No | M | **P3** |
| View grant hygiene (11 granted, 0 read) | all granted to `authenticated` | keep `s08_*` internal (revoke `authenticated`); decide on `party_directory`, `vw_active_owner_agreements`, `journal_entries` | smaller attack surface, clearer contract | Low | Yes (grants) | No | S | **P3** |
| Notification actions (ack/resolve) | table has status columns, no RPC | new atomic RPC + one action per row | turns a mailbox into a worklist | Medium | **Yes** (1 RPC) | No | S-M | **P3** |
| Inspection / registration template configuration | no write path exists | CRUD RPCs + settings section | self-serve requirements config instead of migrations | Medium | **Yes** (new RPCs) | Yes | M | **P3** |

**Explicitly out of scope by decision:** adding browser journal authoring.
`scripts/check-no-new-legacy-journal-writes.mjs` and
`20260901000028_secure_function_default_privileges.sql` forbid it; nothing above reintroduces it.

---

## 13. Verification appendix

| Claim | Reproduction |
|---|---|
| Object counts | `node scripts/db0/audit.mjs --out /home/user/audit/db0` → `inventory.json.counts` (70/70 migrations, 0 blockers, 29 MAJOR `DB0-07`) |
| Live function ACLs | `has_function_privilege('authenticated', oid, 'EXECUTE')` + `aclexplode(proacl)` over replayed DB → `live_fns.json`, `live_fn_acl.json`, `live_tables.json` |
| Tax RPC 42501 | `perm_e2e.mjs`: `set local role authenticated` + JWT claims → `permission denied for function resolve_active_tax_profile` |
| 21-row catalog | `select permission from public.app_permission_catalog` on replayed DB → `db_perms_live.json` |
| Role divergence table | `perm_matrix.mjs` → `perm_matrix.json` (server-effective vs FE role map per role) |
| 40 FE-only codes | `perm_fe_only.json` |
| 111 browser-exec, no prod caller | `browser_never_called.txt` |
| Per-table RLS + FE-query + mutation-RPC join | `table_rows.json` (built by `build_ledger.py`) |
| Full ledger | `/home/user/audit/ledger.json` |

**Uncertainty explicitly carried, not hidden:**
1. §6.1 assumes the deployed `app_permission_catalog` matches migrations — re-run the count query first.
2. Frontend reachability is static-analysis; a dynamic/indirect RPC call via a computed string
   would be invisible to it. Every "no caller" claim was cross-checked against triggers,
   `pg_depend`, definer-function bodies and Edge Functions to reduce this risk, but the 111-item
   list should be spot-checked before deletion.
3. `frontend-scan.mjs`'s own regex undercounts by 14 vs this audit's regex; both were run and the
   wider one was used.
4. Items marked `COMPATIBILITY_ONLY` were classified on absence of a prod caller plus presence of a
   named successor — not on the presence of a deprecation notice, because these migrations carry none.
