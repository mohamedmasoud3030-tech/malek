do $$
declare
  archived_count integer;
begin
  update public.contracts c
  set deleted_at = now(),
      updated_at = now()
  where c.id = 'afe2077e-03fc-4f45-894b-a1fc02f31a85'
    and c.reference = 'CNT-2026-000002'
    and lower(c.status) = 'draft'
    and c.deleted_at is null
    and not exists (select 1 from public.invoices i where i.contract_id = c.id)
    and not exists (select 1 from public.payments p where p.contract_id = c.id)
    and not exists (select 1 from public.receipts r where r.contract_id = c.id);

  get diagnostics archived_count = row_count;
  if archived_count <> 1 then
    raise exception 'DRAFT_ARCHIVE_PRECONDITION_FAILED';
  end if;
end $$;

create unique index if not exists contracts_one_live_draft_per_unit_tenant_uidx
  on public.contracts (company_id, unit_id, tenant_id)
  where deleted_at is null
    and unit_id is not null
    and lower(status) = 'draft';