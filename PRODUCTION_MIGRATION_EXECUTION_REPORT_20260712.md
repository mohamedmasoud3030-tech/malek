# Production Migration Execution Report

Date: 2026-07-12  
Project: Rentrix ERP / Supabase Production  
Project ref: `nnggcnpcuomwfuupupwg`  
Repo HEAD at start: `cfb08bbe`  
Execution command: `supabase db push` via Supabase CLI `2.105.0`

## 1. Execution status

`supabase db push` was executed against Production after the rollback-only dry-run was approved.

Result: **SUCCESS**

CLI output summary:

```text
Applying migration 20260713000002_fix_owner_balances_cascade.sql...
Applying migration 20260713000003_fix_receipt_allocations_cascade.sql...
Applying migration 20260713000004_fix_expense_rpc_role_check.sql...
Applying migration 20260713000005_fix_void_receipt_anon_grant.sql...
Applying migration 20260713000006_fix_report_rpcs_security_definer.sql...
Applying migration 20260713000007_add_update_expense_with_journal_atomic.sql...
Applying migration 20260713000008_add_journal_batch_balance_check.sql...
Applying migration 20260714000001_seed_revenue_account.sql...
Applying migration 20260714000002_hardened_invoice_generation.sql...
Applying migration 20260714000003_contract_balances_triggers.sql...
Applying migration 20260714000004_fix_rpt_cash_flow_void_filter.sql...
Applying migration 20260714000005_fix_rpt_vat_return_void_filter.sql...
Applying migration 20260714000006_fix_rpt_financial_summary_status.sql...
Applying migration 20260715000001_drop_stale_soft_delete_contract_uuid_overload.sql...
Applying migration 20260715000002_purge_production_qa_seed_data.sql...
Finished supabase db push.
```

No PostgreSQL error occurred during the push.

---

## 2. Migrations applied

The following 15 migrations were applied and recorded in `supabase_migrations.schema_migrations`:

| Version | Name |
|---|---|
| `20260713000002` | `fix_owner_balances_cascade` |
| `20260713000003` | `fix_receipt_allocations_cascade` |
| `20260713000004` | `fix_expense_rpc_role_check` |
| `20260713000005` | `fix_void_receipt_anon_grant` |
| `20260713000006` | `fix_report_rpcs_security_definer` |
| `20260713000007` | `add_update_expense_with_journal_atomic` |
| `20260713000008` | `add_journal_batch_balance_check` |
| `20260714000001` | `seed_revenue_account` |
| `20260714000002` | `hardened_invoice_generation` |
| `20260714000003` | `contract_balances_triggers` |
| `20260714000004` | `fix_rpt_cash_flow_void_filter` |
| `20260714000005` | `fix_rpt_vat_return_void_filter` |
| `20260714000006` | `fix_rpt_financial_summary_status` |
| `20260715000001` | `drop_stale_soft_delete_contract_uuid_overload` |
| `20260715000002` | `purge_production_qa_seed_data` |

---

## 3. Migration state verification

Post-deployment migration ledger check:

```text
remote_migration_count = 69
latest_remote_migration = 20260715000002
local_count = 69
local_not_remote = []
remote_not_local = []
```

Status: **PASS — local and remote migration state are synchronized.**

---

## 4. Stale RPC overload verification

Post-deployment `soft_delete_contract_atomic` function check:

| args | security_definer | owner | execute_grantees |
|---|---:|---|---|
| `p_contract_id text` | true | postgres | authenticated, postgres, service_role |

Status: **PASS**

- `public.soft_delete_contract_atomic(uuid)` no longer exists.
- `public.soft_delete_contract_atomic(text)` remains present with owner/grants intact.

---

## 5. QA seed cleanup verification

### Marker scan

A full `public` schema scan for these QA markers returned zero positive rows:

- `TEST-QA`
- `بيانات اختبار جاهزية`
- `00000000-0000-4000-900...`

Result:

```text
qa_scan = []
```

### Specific QA rows

Specific rows checked:

- `owner_balances.owner_id = 00000000-0000-4000-9000-000000000001`
- `payments.reference_no/reference_number = TEST-QA-REF-1`
- `invoices.id = 00000000-0000-4000-9004-000000000001`
- `contracts.property_id = TEST-QA-PROP-001`
- `receipts.ref = TEST-QA-REF-1`
- QA `contract_balances` / `tenant_balances`

Result:

```text
qa_specific_rows = 0
```

Status for targeted QA tables: **PASS**

### Important residual finding

A deeper post-deployment linkage check found **2 residual journal entries** linked to the deleted QA receipt/contract:

```text
journal_entries_linked_to_deleted_qa_receipt_or_contract = 2
```

These two entries are:

- `PAY-testqapaymen-C`, source_id `cef11264-fcb2-4f29-81c5-0b0b99e156a4`, entity_id `b81853ee-b305-43f8-a7bc-39aed420781a`
- `PAY-testqapaymen-D`, source_id `cef11264-fcb2-4f29-81c5-0b0b99e156a4`, entity_id `b81853ee-b305-43f8-a7bc-39aed420781a`

They were not caught by the marker scan because they do not contain `TEST-QA`, the deterministic `0000...900...` IDs, or Arabic QA marker text.

Status for broader “no QA-linked data anywhere”: **FAIL / residual issue remains**

No unapproved remediation was attempted after this discovery.

---

## 6. Contract RPC verification

Post-deployment contract RPCs exist and remain `SECURITY DEFINER`:

| RPC | args | security_definer |
|---|---|---:|
| `create_contract_atomic` | `p_property_id text, p_unit_id uuid, p_tenant_id uuid, p_agreement_id uuid, ...` | true |
| `update_contract_atomic` | `p_contract_id text, p_property_id text, p_unit_id uuid, p_tenant_id uuid, ...` | true |
| `renew_contract_atomic` | `old_contract_id text, new_contract_data jsonb` | true |
| `terminate_contract_atomic` | `p_contract_id text, p_reason text` | true |
| `soft_delete_contract_atomic` | `p_contract_id text` | true |

Status: **PASS — Contract RPCs are present.**

Note: this was an existence/security verification, not an authenticated functional UI test.

---

## 7. Financial integrity verification

Post-deployment orphan checks:

| Check | Result |
|---|---:|
| `owner_balances_orphans` | 0 |
| `contract_balances_orphans` | 0 |
| `tenant_balances_orphans` | 0 |
| `receipt_allocations_invoice_orphans` | 0 |
| `receipt_allocations_receipt_orphans` | 0 |

Status: **PASS for orphan/FK-style integrity checks.**

### Journal balance check

Global debit-credit delta:

```text
journal_debit_credit_delta = 200
```

Unbalanced journal groups found:

| no | delta | entries |
|---|---:|---:|
| `1012` | 100 | 1 |
| `1016` | 100 | 1 |
| `PAY-testqapaymen-C` | -150 | 1 |
| `PAY-testqapaymen-D` | 150 | 1 |

The two QA payment journal entries are balanced together globally, but remain QA-linked residual data. The global `+200` delta appears to come from older single-entry legacy journal rows `1012` and `1016`, not from the QA pair.

Status: **PARTIAL / existing journal imbalance remains and should be investigated separately.**

---

## 8. New object verification

| Object | Expected | Actual | Status |
|---|---:|---:|---|
| `journal_entries.batch_id` column | 1 | 1 | PASS |
| `trg_invoices_update_contract_balance` | 1 | 1 | PASS |
| `trg_receipt_allocations_update_contract_balance` | 1 | 1 | PASS |
| `trg_prevent_owner_delete_with_balances` | 1 | 1 | PASS |
| invalid `owner_balances_owner_id_fkey` | 0 | 0 | PASS |

---

## 9. Final status against original readiness goals

| Goal | Status | Evidence |
|---|---|---|
| No `soft_delete_contract_atomic(uuid)` | PASS | Only text overload remains. |
| QA seed data removed from targeted tables | PASS | QA marker scan and specific table checks returned zero. |
| No QA-linked records anywhere | FAIL / residual | 2 journal entries still reference deleted QA receipt/contract. |
| Migration state synchronized | PASS | local = 69, remote = 69, no differences. |
| Contract RPCs still present | PASS | All contract RPCs exist as `SECURITY DEFINER`. |
| Financial orphan integrity | PASS | Orphan checks all zero. |
| Global journal balance | PARTIAL / existing issue | Global debit-credit delta = 200 from legacy single-entry rows. |

---

## 10. Remaining risks / required follow-up

1. **Residual QA-linked journal entries remain.**
   - They reference the deleted QA receipt id `cef11264-fcb2-4f29-81c5-0b0b99e156a4` and QA contract id `b81853ee-b305-43f8-a7bc-39aed420781a`.
   - Recommended fix: create and review a new targeted migration to delete only these two QA journal entries, with guard checks proving they are the QA payment pair.

2. **Pre-existing journal imbalance remains.**
   - Global debit-credit delta is `200`.
   - The imbalance appears to be from legacy single-entry rows `1012` and `1016`.
   - Recommended fix: separate accounting reconciliation task; do not auto-delete or auto-adjust without business approval.

3. **Operational risk from new triggers.**
   - `contract_balances` is now maintained by triggers on `invoices` and `receipt_allocations`.
   - Rollback simulation passed before deployment, and objects exist after deployment, but production monitoring is recommended for invoice/payment flows.

---

## 11. Final conclusion

`supabase db push` completed successfully and the migration ledger is synchronized.

However, the Production readiness target is **not fully closed** because post-deployment verification found residual QA-linked `journal_entries` and an existing journal imbalance.

Recommended next action: approve a small follow-up migration for the two QA-linked journal entries, then run journal integrity reconciliation as a separate controlled task.
