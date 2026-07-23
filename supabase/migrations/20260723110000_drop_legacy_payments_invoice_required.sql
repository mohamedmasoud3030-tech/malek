-- Reconcile clean migration replay with the live receipt/allocation payment model.
-- Invoice allocation is stored in receipt_allocations; payments.invoice_id is a
-- legacy compatibility column and must not be required for receipt-backed writes.
begin;

alter table public.payments
  drop constraint if exists payments_invoice_required;

commit;
