-- Manual rollback for 20260809010000_s04_property_management_gl_rpcs.sql — not auto-applied, run by hand only.
-- Rollback for: 20260809010000_s04_property_management_gl_rpcs.sql
--
-- Drops Stage S04 PM GL posting and reconciliation RPCs.

begin;

drop function if exists public.gl_diagnose_historical_financial_integrity();
drop function if exists public.gl_reconcile_subledgers(date);
drop function if exists public.gl_pm_list_batches(int,int);
drop function if exists public.gl_pm_post_broker_commission_payment(jsonb);
drop function if exists public.gl_pm_post_broker_commission_approval(jsonb);
drop function if exists public.gl_pm_post_deposit_application(jsonb);
drop function if exists public.gl_pm_post_deposit_refund(jsonb);
drop function if exists public.gl_pm_post_deposit_receipt(jsonb);
drop function if exists public.gl_pm_post_owner_expense(jsonb);
drop function if exists public.gl_pm_post_owner_payment(jsonb);
drop function if exists public.gl_pm_accrue_fixed_monthly_fee(jsonb);
drop function if exists public.gl_pm_post_collection_office_is_creditor(jsonb);
drop function if exists public.gl_pm_post_invoice_office_is_creditor(jsonb);
drop function if exists public.gl_pm_post_collection_owner_is_creditor(jsonb);
drop function if exists public.gl_pm_round_omr(numeric);
drop function if exists public.gl_pm_require_account(uuid, text);

commit;
