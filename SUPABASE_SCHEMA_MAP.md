# Supabase Schema Map

Generated: 2026-08-18  
Source of truth for this document: **repository migration chain replayed into disposable PGlite** (281 / 281 files).  
Live Production (`nnggcnpcuomwfuupupwg`): **Not verifiable remotely** in this sandbox (no `SUPABASE_DB_URL`, no `psql`, no management token). Historical read-only snapshot: `evidence/preflight/production_live_reconciliation_20260721.md`.

This map describes the schema the repository builds today. It is not a claim that Production matches it.

## 1. Inventory (Confirmed — PGlite replay)

| Object | Count |
|---|---:|
| SQL migrations applied | 281 |
| Public tables | 114 |
| Public views / materialized | 11 |
| RLS policies | 229 |
| Foreign keys | 257 |
| Indexes | 377 |
| Public functions / RPCs | 342 |
| Tables with `company_id` | 99 |
| Tables with RLS disabled | **0** |

Every public table has RLS enabled. Isolation scan (`findIsolationViolations`) reports no missing company fence on tenant tables.

## 2. Tenant and write authority

### Tenancy

- Browser preference: `auth.users.raw_user_meta_data.company_id` (untrusted).
- Issued claim: `app_metadata.company_id` stamped by `public.custom_access_token_hook(jsonb)`.
- RLS / SECURITY DEFINER RPCs read `public.current_company_id()` from that issued JWT claim.
- Client fail-closed: `use-company.tsx` refuses to open the app if the access-token claim does not match an active membership.

### Role helpers (latest repo definitions)

| Helper | Authority |
|---|---|
| `current_company_id()` | JWT `app_metadata.company_id`; null when the claim is missing |
| `is_app_user()` | `auth.uid()` exists **and** `public.users` is ACTIVE / not deleted |
| `is_admin_or_manager()` | same user-state check **and** `users.role` in (`ADMIN`, `MANAGER`) |
| `current_app_role()` | live `public.users.role`, not a stale JWT role |
| `role_has_app_permission(role, permission)` | six-role **catalog** (intended capability) |
| `current_user_has_effective_app_permission(...)` | catalog + per-user grants; used by some resources (e.g. service providers) |

`role_has_app_permission` still lists `properties.write` / `contracts.write` / `expenses.write` / `documents.write` for `OPERATIONS`. That is catalog capacity. **Current RLS/RPC write authority for those four is `is_admin_or_manager()` only.** The frontend now follows RLS (`serverEnforcedWriteRoles`). Do not change the SQL catalog in this PR — `supabase/tests/wp01_six_role_authorization.sql` locks it.

### Core entity write policies

| Table | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `properties`, `units`, `owners`, `people`, `contracts`, `expenses` | authenticated app user, company-scoped | `is_admin_or_manager()` |
| `invoices`, `payments`, `receipts` | app user, company-scoped | manager write or sealed to RPCs (later hardening) |
| `financial_operation_idempotency` | deny | deny (RPC-only) |
| `journal_lines` / journal writes | restricted | browser deny; SECURITY DEFINER only |
| `service_providers` | permission-gated | `current_user_has_effective_app_permission('service_providers.write')` |
| `vault_documents`, `contract_documents`, `storage.objects` (attachments) | company / app-user read | ADMIN or MANAGER |

Storage bucket `attachments`: private, 5 MiB, PDF/JPEG/PNG/WebP. Mutation policies require `is_admin_or_manager()`.

## 3. Tables by domain (Confirmed — replay)

### Identity / tenancy

`companies`, `company_members`, `users`, `profiles`, `sessions`, `user_permission_grants`, `permission_requests`, `app_permission_catalog`, `company_settings`, `settings`

### Portfolio

`properties`, `property_owners`, `units`, `owners`, `people`, `tenants`, `lands`, `leads`, `cost_centers`

### Contracts and evidence

`contracts`, `contract_documents`, `contract_inspections`, `contract_inspection_templates`, `contract_evidence_events`, `contract_registration_records`, `contract_registration_requirement_profiles`, `owner_agreements`, `owner_agreement_versions`

### Financial core

`invoices`, `payments`, `receipts`, `receipt_allocations`, `receipt_void_requests`, `expenses`, `accounts`, `account_balances`, `accounting_periods`, `journal_batches`, `journal_lines`, `journal_entries_archive`, `financial_operation_idempotency`

### Owner money

`owner_settlements`, `owner_settlement_payment_links`, `owner_settlement_expense_links`, `owner_funds_events`, `owner_funds_event_cutovers`, `owner_balances`, `due_from_owners`, `due_from_owner_offsets`, `due_from_owner_recoveries`, `contract_balances`, `tenant_balances`

### Tax / fee / deposits

`tax_code_catalog`, `company_tax_profiles`, `company_fee_tax_treatments`, `taxable_line_tax_snapshots`, `invoice_credits`, `invoice_payment_tax_allocations`, `management_fee_tax_snapshots`, `fixed_monthly_daily_accruals`, `fixed_monthly_daily_accrual_reversals`, `tenant_deposits`, `deposit_transactions`, `deposit_txs`, `deposit_application_claims`, `deposit_refund_events`

### Operations

`maintenance_records`, `service_providers`, `service_provider_categories`, `service_provider_category_links`, `utility_meters`, `utility_bills`, `commissions`, `communication_records`, `missions`

### Documents / automation / AI

`vault_documents`, `attachments`, `document_reference_sequences`, `automation_rules`, `automation_jobs`, `automation_runs`, `automation_run_logs`, `automation_notifications`, `notification_templates`, `notifications`, `outgoing_notifications`, `app_notifications`, `ai_assistant_rate_limits`

### Bank / close / review

`bank_accounts`, `bank_statement_imports`, `bank_statement_lines`, `bank_reconciliation_matches`, `s08_frozen_reviews`, `s09_corrections`, `wp05_correction_proposals`, `gl_cash_flow_classifications`, `master_lease_measurements`, `master_lease_schedule_rows`

### Onboarding / misc

`onboarding_requirement_templates`, `company_onboarding_events`, `company_onboarding_completion`, `company_onboarding_waivers`, `governance`, `kpi_snapshots`, `snapshots`, `serials`, `status_history`, `status_transition_rules`, `payment_terms_templates`, `budgets`, `schema_refactor_notes`, `auto_backups`, `audit_log`, `company-assets`

## 4. Views

All 11 public views use `security_invoker = true` (Confirmed — replay). They inherit caller RLS; they are not SECURITY DEFINER leaks.

## 5. Foreign keys and indexes

- 257 FKs, 377 indexes (Confirmed — replay).
- Existing additive FK-index migration: `20260820090000_rc1_release_integration_fk_indexes.sql` (`owner_funds_events.owner_id` / `contract_id`).
- Unindexed-FK scan on the replayed schema found **102** FKs with no supporting index (or no index whose leading column is the FK). The largest cluster is `*_company_id_fkey` on tenant tables plus journal-batch / tax-snapshot / settlement-link FKs.

**No new index migration is included in this PR.** Adding ~100 indexes without a live workload or advisor confirmation is REQUIRES CARE. Historical Production advisor (2026-07-21) already listed unindexed FKs and unused-index warnings. Revisit with a hosted read-only advisor after backup/deploy policy is resolved.

Suspicious type/shape items (`payments.invoice_id`, `maintenance_records.invoice_id`, `account_balances.account_id`, legacy `profiles.roles`, company locale defaults) were **not changed**. No active write path was proven to depend on “fixing” them.

## 6. Auth hook (repo-proven; hosted enablement not verifiable)

| Check | Repo status |
|---|---|
| Function `public.custom_access_token_hook(jsonb)` exists | Confirmed |
| `SECURITY DEFINER` + pinned `search_path` | Confirmed (`struct.hook_definer_search_path`) |
| EXECUTE granted only to `supabase_auth_admin` | Confirmed (`struct.hook_grants`) |
| Stamps membership company + `user_role`; ignores spoofed incoming claim | Confirmed |
| No membership / inactive membership → no `company_id` | Confirmed |
| Missing JWT company claim → `current_company_id()` is null | Confirmed (`auth.current_company_missing_claim`) |
| Hosted Auth Hook toggle enabled on the project | **Not verifiable remotely** (`GAP-003/021`) |

Production action (manual, outside this PR): in the Supabase dashboard for project `nnggcnpcuomwfuupupwg`, Auth → Hooks → enable `custom_access_token_hook` on access-token issuance. RLS trusts the **issued** claim; if the hook is off, a minted JWT that already contains another `company_id` is trusted.

## 7. Compatibility notes

- This PR changes **no** database objects, RLS policies, grants, or RPC signatures.
- Frontend write affordances for `properties.write`, `contracts.write`, `expenses.write`, and `documents.write` now require ADMIN or MANAGER even if a per-user grant exists. OPERATIONS keeps `service_providers.write`.
- Catalog SQL (`role_has_app_permission`) is unchanged.

## 8. Live drift

**Not verifiable remotely.** Last hosted ledger comparison (2026-07-21) found remote-only historical versions and three then-pending local files, plus automatic Production deploy blocked by “Remote migration versions not found in local migrations directory.” Backup: Free plan, no restorable artifact. Production writes remain **HOLD**. See `SUPABASE_MIGRATION_AUDIT.md`.
