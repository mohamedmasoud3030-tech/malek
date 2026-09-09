-- FIN-012/013/016/017/018/019; SEC-001/002/009.
-- One read-only tax-event projection for VAT schedules and 2100 reconciliation.
-- No rate/policy changes, financial writes, backfill, or new public API.
-- Original configured snapshots supply amounts; booked headers supply dates.
-- Public report permission wrapper and private-core execution ACLs are retained.
begin;

do $precondition$
begin
  if to_regprocedure('app_private.financial_vat_return_core(date,date)') is null
     or not exists (select 1 from pg_proc where oid=to_regprocedure('public.rc1_owner_agency_vat_payable_balance(uuid,date)') and not prosecdef and provolatile='s') then
    raise exception 'TAX_READ_AUTHORITY_PRECONDITION: expected guarded report core and stable invoker control';
  end if;
end;
$precondition$;

create view app_private.tax_posting_events
with (security_invoker=true, security_barrier=true) as
with sources as (
  select i.company_id, 'OFFICE_RENT'::text as source_kind, i.id::text as source_id,
    'invoice:'||i.id::text as event_key, i.id as invoice_id,
    i.invoice_posting_batch_id as batch_id, null::uuid as reversal_batch_id, false as reversed,
    s.tax_code, s.net_amount, s.tax_amount,
    s.id is not null and s.source_type='invoice' and s.source_id=i.id::text
      and s.net_amount=i.amount and s.tax_amount=i.tax_amount and s.tax_code=i.tax_code as source_valid
  from public.invoices i
  left join public.taxable_line_tax_snapshots s on s.id=i.tax_snapshot_id and s.company_id=i.company_id
  where i.invoice_accounting_classification='OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS'
    and i.document_status='POSTED'
  union all
  select c.company_id, 'OFFICE_RENT', c.invoice_id::text, 'credit:'||c.id::text, c.invoice_id,
    c.journal_batch_id, c.reversal_journal_batch_id, c.status='REVERSED',
    c.tax_code, -c.net_amount, -c.tax_amount,
    c.tax_snapshot_id is not null and c.net_amount is not null and c.tax_amount is not null
  from public.invoice_credits c
  where c.accounting_classification='OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS'
    and c.status in ('POSTED','REVERSED')
  union all
  select p.company_id, 'OWNER_COLLECTION', p.id::text, 'collection:'||p.id::text, p.invoice_id,
    b.id, b.reversal_of_batch_id, upper(r.status)='VOID',
    s.tax_code, p.net_amount, p.tax_amount, s.id is not null and s.id=i.tax_snapshot_id
  from public.invoice_payment_tax_allocations p
  join public.invoices i on i.id=p.invoice_id and i.company_id=p.company_id
  join public.receipts r on r.id=p.receipt_id and r.company_id=p.company_id
  left join public.taxable_line_tax_snapshots s on s.id=p.tax_snapshot_id and s.company_id=p.company_id
  left join public.journal_batches b on b.company_id=p.company_id and b.source_type='receipt'
    and b.source_id=r.id::text and b.status in ('POSTED','REVERSED')
  where i.invoice_accounting_classification='OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL'
    and upper(r.status) in ('POSTED','VOID')
  union all
  select s.company_id, 'RATE_FEE', s.id::text, 'rate_fee:'||s.id::text, s.invoice_id,
    s.journal_batch_id, b.reversal_of_batch_id, upper(r.status)='VOID',
    s.tax_code, s.net_amount, s.tax_amount, s.treatment_id is not null
  from public.management_fee_tax_snapshots s
  join public.receipts r on r.id=s.receipt_id and r.company_id=s.company_id
  left join public.journal_batches b on b.id=s.journal_batch_id and b.company_id=s.company_id
  where upper(r.status) in ('POSTED','VOID')
  union all
  select a.company_id, 'FIXED_FEE', a.id::text, 'fixed_fee:'||a.id::text, null::uuid,
    a.journal_batch_id, rev.reversal_journal_batch_id, rev.id is not null,
    a.fee_tax_code, a.net_amount, a.tax_amount,
    a.fee_tax_treatment_id is not null and a.tax_authority_status='VERSIONED_FEE_TREATMENT'
  from public.fixed_monthly_daily_accruals a
  left join public.fixed_monthly_daily_accrual_reversals rev on rev.accrual_id=a.id and rev.company_id=a.company_id
  where a.net_amount>0
), checked_sources as (
  select s.*, count(*) over(partition by company_id,event_key) as copies from sources s
), dated as (
  select s.*, b.effective_date, v.effective_date as reversed_on,
    coalesce(s.source_valid,false) and s.copies=1 and b.id is not null
      and coalesce(s.tax_code in ('VAT','VAT_ZERO','NON_TAXABLE'),false) as original_valid,
    v.id is not null as reversal_valid
  from checked_sources s
  left join public.journal_batches b on b.id=s.batch_id and b.company_id=s.company_id and b.status in ('POSTED','REVERSED')
  left join public.journal_batches v on v.id=s.reversal_batch_id and v.company_id=s.company_id
    and v.reversal_of_batch_id=b.id and v.source_type='journal_reversal' and v.status in ('POSTED','REVERSED')
)
select company_id,source_kind,source_id,event_key,invoice_id,batch_id,effective_date,tax_code,net_amount,tax_amount,original_valid as lineage_valid from dated
union all
select company_id,source_kind,source_id,event_key||':reversal',invoice_id,reversal_batch_id,reversed_on,tax_code,-net_amount,-tax_amount,original_valid and reversal_valid from dated where reversed;

-- Invoker callers need SELECT on this private-schema projection. It is not a
-- PostgREST public API and cannot bypass any underlying company/identity RLS.
revoke all on app_private.tax_posting_events from public, anon, authenticated;
grant select on app_private.tax_posting_events to authenticated, service_role;

create or replace function public.rc1_owner_agency_vat_payable_balance(p_company_id uuid, p_as_of date default current_date)
returns table(balance numeric,cnt bigint)
language plpgsql stable
set search_path to 'public','pg_temp'
as $function$
begin
  if p_company_id is null or p_as_of is null then
    raise exception 'VAT_SUBLEDGER_COMPANY_DATE_REQUIRED' using errcode='22023';
  end if;
  if exists(select 1 from app_private.tax_posting_events where company_id=p_company_id and not lineage_valid) then
    raise exception 'VAT_POSTING_HISTORY_INCOMPLETE: governed source/snapshot/posting lineage required' using errcode='23514';
  end if;
  return query
  select public.wp05_round_omr(coalesce(sum(tax),0)),count(*) filter(where abs(tax)>0.0005)
  from (
    select source_kind,source_id,sum(tax_amount) as tax from app_private.tax_posting_events
    where company_id=p_company_id and effective_date<=p_as_of group by source_kind,source_id
  ) positions;
end;
$function$;

create or replace function app_private.financial_vat_return_core(p_from_date date,p_to_date date)
returns jsonb
language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_company_id uuid;
  v_result jsonb;
  v_unclassified boolean;
begin
  perform app_private.require_financial_reports_view();
  v_company_id := public.require_company_id();
  if p_from_date is null or p_to_date is null or p_from_date>p_to_date then
    raise exception 'VAT_REPORT_PERIOD_REQUIRED: ordered from/to dates required' using errcode='22023';
  end if;
  if exists(select 1 from app_private.tax_posting_events where company_id=v_company_id and not lineage_valid) then
    raise exception 'VAT_POSTING_HISTORY_INCOMPLETE: governed source/snapshot/posting lineage required' using errcode='23514';
  end if;

  -- Independent per-batch control, not a tax-base calculation from GL lines.
  -- Unknown/mismatched 2100 events must not masquerade as a complete VAT return.
  with source_tax as (
    select batch_id,sum(tax_amount) as tax from app_private.tax_posting_events
    where company_id=v_company_id and effective_date between p_from_date and p_to_date group by batch_id
  ), control_tax as (
    select b.id as batch_id,sum(l.credit-l.debit) as tax
    from public.journal_batches b join public.journal_lines l on l.batch_id=b.id and l.company_id=b.company_id
    join public.accounts a on a.id=l.account_id and a.company_id=l.company_id
    where b.company_id=v_company_id and b.status in ('POSTED','REVERSED') and l.deleted_at is null
      and a.no='2100' and b.effective_date between p_from_date and p_to_date group by b.id
  )
  select coalesce(bool_or(s.batch_id is null or abs(coalesce(s.tax,0)-coalesce(c.tax,0))>0.0005),false)
  into v_unclassified from source_tax s full join control_tax c using(batch_id);
  if v_unclassified then
    raise exception 'VAT_REPORT_UNCLASSIFIED_POSTING: tax source/2100 variance requires governed review' using errcode='23514';
  end if;

  select jsonb_build_object(
    'period',jsonb_build_object('from',p_from_date,'to',p_to_date),
    'total_sales_amount',public.wp05_round_omr(coalesce(sum(net_amount) filter(where tax_code in ('VAT','VAT_ZERO')),0)),
    'total_tax_amount',public.wp05_round_omr(coalesce(sum(tax_amount),0)),
    'invoice_count',count(distinct invoice_id) filter(where tax_code in ('VAT','VAT_ZERO'))
  ) into v_result from app_private.tax_posting_events
  where company_id=v_company_id and effective_date between p_from_date and p_to_date;
  return v_result;
end;
$function$;

commit;
