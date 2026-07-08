# Agent Context Domain Notes

This file is a compact, high-risk domain supplement for coding agents. It does **not** replace `docs/DOMAIN.md`; use `docs/DOMAIN.md` for the broad entity model and this file for invariants, current violations, and unknowns that commonly cause unsafe changes.

Verify current code, migrations, and live Supabase state before relying on any summarized status here. Tags below mean:

- **File-verified** — checked against files in this repository during the context-layer pass.
- **Live-verified elsewhere** — documented as live-verified in `docs/CURRENT_STATE.md`, but not rechecked by this file itself.
- **Needs live check** — must be verified against the target Supabase project before a production claim or mutation.

## Durable verified invariants

- **Generated TypeScript types are not a schema authority.** Several live primary/foreign key columns are `text` even when a column name or generated type might suggest `uuid`; inspect `information_schema`, constraints, policies, and `pg_get_functiondef` for the target object before writing migrations or RPC code. **File-verified; live status varies by object.**
- **Tenant identity resolves through people-facing app concepts, not by assuming a direct auth-user tenant row.** Contract and tenant work must inspect the current tenant/people services and the live schema before deciding which id is being passed. **File-verified.**
- **RPC overloads are a real production risk.** Prefer inspecting `pg_proc`/`pg_get_functiondef(oid)` by argument list instead of searching only by function name, especially for financial functions such as `void_receipt_atomic` and report functions. **File-verified; live-verified elsewhere for several financial RPCs.**
- **Financial collection totals should use payment-backed source data and exclude VOID/deleted rows.** Receipts are user-facing history/projections; payment records are the current source used by the UI path. **File-verified; migration/live application may still need checking for a specific branch.**
- **JWT role authorization uses the application `users.role` model, not `profiles.role`.** `profiles.role` was historically capped at `ADMIN`/`USER`; role-sensitive work should verify the live custom access token hook and RLS policies rather than assuming profile role semantics. **Live-verified elsewhere after the Phase 0 fix.**
- **Sessions RLS ownership uses `sessions.user_id`, not `sessions.id`.** Any auth/session policy change should preserve that boundary. **Live-verified elsewhere after the sessions RLS fix.**
- **Route guards and RLS are separate layers.** Frontend route permission checks improve UX but do not replace Supabase RLS/RPC grants for sensitive data. **File-verified.**

## Known current violations

- **Receipt/payment voiding is code-fixed but not fully release-verified.** PR #1064 merged a code fix for the payment-backed receipt void path, but the target Supabase project still needs direct verification of `record_invoice_payment_atomic`, `void_receipt_atomic(jsonb)`, the migration ledger, and an app-path payment → receipt → void → report check before anyone claims the fix is production-verified. **Needs live check.**
- **Reports still mix dedicated RPCs and client-side recalculation.** Several live `rpt_*` RPCs have no frontend caller; owner/tenant statements need new UI, while collection reports must not swap to an RPC until its source matches the payment-backed receipt path. **File-verified; see `docs/CURRENT_STATE.md`.**
- **Migration files are better than before but still not automatically a live-source-of-truth.** Baseline capture narrowed drift, yet any task touching schema/RPC/RLS still needs a live check because production has a history of metadata-only registrations, direct applies, and captured fixes. **Live-verified elsewhere.**
- **Operational property-management gaps remain.** Daily/open-ended contracts, utility billing, tenant maintenance chargeback, master-lease owner obligation schedules, tenant deposits, deferred revenue policy, and operation-level financial permissions are tracked but not complete. **File-verified; see `docs/FEATURE_GAP_REGISTER.md`.**

## Open assumptions and unknowns

- **Contract/people id column types must be checked live before DDL.** Some migrations and comments historically disagreed with production (`contracts.id` has been documented as `text` live in `docs/CURRENT_STATE.md`); do not infer `uuid` from names or generated types. **Needs live check per object.**
- **Owner-settlement accounting policy is product-blocked.** The product owner still needs to decide collected-vs-invoiced basis, commission treatment, expense deductions, approvals, owner payment lifecycle, and reversals before settlement code can be called complete. **Product decision required.**
- **Master-lease accounting is not just another management-fee variant.** The app needs a product/accounting decision for fixed owner obligations independent of tenant collections before reports can represent office profit accurately. **Product decision required.**
- **Utility bills need posting rules.** Before implementation, decide whether each utility bill becomes a tenant invoice, an owner/office expense, or a utility subledger item that posts into those records. **Product decision required.**
- **Cash-vs-accrual/deferred revenue is undecided.** Annual/prepaid rent cannot be reported as period revenue with 100% confidence until the accounting basis is explicit. **Product decision required.**
