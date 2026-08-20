-- Rentrix code-first baseline: Security Advisor cleanup retained as explicit evidence.

begin;

-- The reconciliation view is intentionally invoker-safe so authenticated users
-- see only rows allowed by underlying table RLS.
alter view public.v_balance_reconciliation set (security_invoker = true);
alter view public.v_balance_reconciliation_drift set (security_invoker = true);

-- Do not recreate the historical duplicate unique index. The composite primary
-- key on financial_operation_idempotency is the single required uniqueness
-- guarantee for operation/request idempotency.
drop index if exists public.financial_operation_idempotency_operation_request_uidx;

-- Browser-facing RPCs stay callable by authenticated because active app code
-- invokes them directly. Internal helpers remain revoked from anon/authenticated.
revoke all on function public.find_payment_account_id(text) from public, anon, authenticated;
revoke all on function public.post_receipt_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.void_receipt_atomic(uuid, timestamptz, jsonb, jsonb) from public, anon, authenticated;

revoke all on function public.record_invoice_payment_atomic(jsonb) from public, anon;
grant execute on function public.record_invoice_payment_atomic(jsonb) to authenticated;

revoke all on function public.renew_contract_atomic(uuid, jsonb) from public, anon;
grant execute on function public.renew_contract_atomic(uuid, jsonb) to authenticated;

revoke all on function public.void_receipt_atomic(jsonb) from public, anon;
grant execute on function public.void_receipt_atomic(jsonb) to authenticated;

revoke all on function public.generate_invoices_from_active_contracts() from public, anon;
grant execute on function public.generate_invoices_from_active_contracts() to authenticated;

revoke all on function public.rpt_financial_summary(date, date) from public, anon;
grant execute on function public.rpt_financial_summary(date, date) to authenticated;

commit;
