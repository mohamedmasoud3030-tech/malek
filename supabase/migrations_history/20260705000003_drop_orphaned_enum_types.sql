-- STATUS AS OF 2026-07-05: APPLIED to nnggcnpcuomwfuupupwg (production) via
-- apply_migration.
--
-- Drops 9 orphaned enum types confirmed via the PR #1047 audit
-- (docs/CURRENT_STATE.md, "Orphaned live-schema enum types") to have zero
-- references anywhere on the live schema: no columns, function signatures,
-- function bodies (checked for actual ::type_name casts, not string-literal
-- false positives), views, RLS policy expressions, composite type
-- attributes, domain base types, or index expressions.
--
-- units.status, contracts.status, invoices.status, and
-- maintenance_records.status are all plain `text` columns whose values
-- happen to match these enum labels — not real enum usage. Product-owner
-- decision (docs/NEXT.md, "Ready now"): drop to reduce schema clutter.

begin;

drop type if exists public.contract_status;
drop type if exists public.invoice_status;
drop type if exists public.invoice_type;
drop type if exists public.journal_entry_type;
drop type if exists public.maintenance_status;
drop type if exists public.payment_method;
drop type if exists public.property_status;
drop type if exists public.transaction_status;
drop type if exists public.unit_status;

commit;
