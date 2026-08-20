-- Rentrix code-first baseline: financial integrity, reports, and reconciliation.

begin;

create or replace view public.v_balance_reconciliation
with (security_invoker = true)
as
select
  c.id as contract_id,
  c.property_id,
  c.unit_id,
  c.tenant_id,
  coalesce(sum(i.amount + coalesce(i.tax_amount, 0)) filter (where i.deleted_at is null and i.status <> 'VOID'), 0) as invoiced_amount,
  coalesce(sum(i.paid_amount) filter (where i.deleted_at is null and i.status <> 'VOID'), 0) as invoice_paid_amount,
  coalesce(sum(p.amount) filter (where p.deleted_at is null and coalesce(p.status, 'POSTED') <> 'VOID'), 0) as posted_payment_amount,
  coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - i.paid_amount) filter (where i.deleted_at is null and i.status <> 'VOID'), 0) as outstanding_amount,
  (
    coalesce(sum(i.paid_amount) filter (where i.deleted_at is null and i.status <> 'VOID'), 0)
    - coalesce(sum(p.amount) filter (where p.deleted_at is null and coalesce(p.status, 'POSTED') <> 'VOID'), 0)
  ) as paid_vs_payment_drift
from public.contracts c
left join public.invoices i on i.contract_id = c.id
left join public.payments p on p.contract_id = c.id
where c.deleted_at is null
group by c.id, c.property_id, c.unit_id, c.tenant_id;

create or replace view public.v_balance_reconciliation_drift
with (security_invoker = true)
as
select *
from public.v_balance_reconciliation
where abs(paid_vs_payment_drift) > 0.01;

create index invoices_contract_status_due_idx on public.invoices (contract_id, status, due_date) where deleted_at is null;
create index invoices_due_overdue_idx on public.invoices (due_date) where deleted_at is null and status in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE');
create index payments_report_date_idx on public.payments (payment_date, invoice_id, contract_id) where deleted_at is null;
create index expenses_report_date_idx on public.expenses (expense_date, property_id, category) where deleted_at is null;
create index contracts_active_unit_idx on public.contracts (unit_id, start_date, end_date) where deleted_at is null and lower(status) = 'active';
create index receipts_request_id_idx on public.receipts (request_id) where request_id is not null;
create index journal_entries_source_idx on public.journal_entries (source_id, entity_type);

grant select on public.v_balance_reconciliation to authenticated;
grant select on public.v_balance_reconciliation_drift to authenticated;

commit;
