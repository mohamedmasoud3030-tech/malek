-- Guard the financial posting boundary: invoices may be drafted for a valid
-- contract, but they cannot become POSTED until that contract is active.
-- The existing lineage guard already proves contract existence and company scope.
-- Extending its trigger columns is essential: the risky transition changes
-- document_status, not contract_id or company_id.

create or replace function public.invoice_lineage_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract_company uuid;
  v_contract_status text;
begin
  select c.company_id, c.status
    into v_contract_company, v_contract_status
    from public.contracts c
   where c.id = new.contract_id;

  if v_contract_company is null then
    raise exception 'INVOICE_CONTRACT_NOT_FOUND: contract % does not exist.', new.contract_id
      using errcode = '23503';
  end if;

  if v_contract_company is distinct from new.company_id then
    raise exception 'INVOICE_COMPANY_MISMATCH: invoice company % does not match contract company % (cross-company injection rejected).', new.company_id, v_contract_company
      using errcode = '42501';
  end if;

  if upper(coalesce(new.document_status, 'DRAFT')) = 'POSTED'
     and lower(coalesce(v_contract_status, '')) <> 'active' then
    raise exception 'INVOICE_POSTING_REQUIRES_ACTIVE_CONTRACT: invoice % cannot be posted while contract % is %.',
      new.id, new.contract_id, coalesce(v_contract_status, 'NULL')
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoice_lineage_guard on public.invoices;

create trigger trg_invoice_lineage_guard
before insert or update of contract_id, company_id, document_status
on public.invoices
for each row execute function public.invoice_lineage_guard();
