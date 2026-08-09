-- Rollback for: 20260809010000_s04_property_management_gl_rpcs.sql
-- Drops all PM GL RPCs added by this migration. No financial data is removed.

begin;

drop function if exists public.gl_pm_list_batches(int, int);
drop function if exists public.gl_pm_post_owner_payment(jsonb);
drop function if exists public.gl_pm_accrue_fixed_monthly_fee(jsonb);
drop function if exists public.gl_pm_post_collection_office_is_creditor(jsonb);
drop function if exists public.gl_pm_post_invoice_office_is_creditor(jsonb);
drop function if exists public.gl_pm_post_collection_owner_is_creditor(jsonb);
drop function if exists public.gl_pm_round_omr(numeric);
drop function if exists public.gl_pm_require_account(uuid, text);

commit;
