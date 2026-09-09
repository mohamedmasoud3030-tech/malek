-- FIN-007/013/019, SEC-001/002; GAP-013.
-- Read-only prerequisite for source-scoped historical review. No correction,
-- allocation, legal offset right, source balance or posted history is invented.
begin;
do $precondition$
begin
  if not exists(select 1 from pg_proc where oid='public.s08_analyze_expense_misclassification(uuid,uuid)'::regprocedure and provolatile='s')
     or to_regprocedure('app_private.require_financial_reports_view()') is null then
    raise exception 'EXPENSE_DIAGNOSTIC_BOUNDARY_PRECONDITION';
  end if;
end;
$precondition$;

create or replace function public.s08_analyze_expense_misclassification(p_company_id uuid,p_period_id uuid)
returns table(company_id uuid,expense_id uuid,charged_to text,beneficiary text,account_no text,
  account_name text,amount numeric,period text,finding_code text,severity text,explanation text)
language plpgsql stable security definer set search_path to 'public','pg_temp'
as $function$
declare v_period public.accounting_periods%rowtype;
begin
  perform app_private.require_financial_reports_view();
  if p_company_id is null or p_period_id is null then
    raise exception 'S08_COMPANY_AND_PERIOD_REQUIRED' using errcode='22023';
  end if;
  if auth.uid() is not null and p_company_id is distinct from public.require_company_id() then
    raise exception 'S08_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
  end if;
  select ap.* into v_period from public.accounting_periods ap
  where ap.id=p_period_id and ap.company_id=p_company_id;
  if not found then
    raise exception 'EXPENSE_DIAGNOSTIC_PERIOD_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;

  return query
  with expenses as (
    select e.*,upper(coalesce(nullif(btrim(e.charged_to),''),
      case when upper(e.category) in ('OWNER','TENANT') then upper(e.category) else 'COMPANY' end)) as responsibility
    from public.expenses e where e.company_id=p_company_id
  ), direct_links as (
    select e.id as expense_id,b.id as batch_id
    from expenses e join public.journal_batches b
      on b.company_id=e.company_id and b.source_id=e.id::text
      and b.source_type in ('expense','expenses','expense_update','expense_reversal')
    union
    select e.id,b.id
    from expenses e join public.s09_corrections c
      on c.company_id=e.company_id and c.source_type='expense' and c.source_id=e.id::text
    join public.journal_batches b on b.id=c.correction_journal_batch_id and b.company_id=c.company_id
  ), links as (
    select d.expense_id,d.batch_id from direct_links d
    union
    select d.expense_id,r.id from direct_links d join public.journal_batches r
      on r.company_id=p_company_id and r.source_type='journal_reversal' and r.reversal_of_batch_id=d.batch_id
  ), posting as (
    select l.expense_id,
      sum(case when a.no='6100' then jl.debit-jl.credit else 0 end) as office_debit,
      count(distinct b.id) as batch_count,
      bool_or(b.source_type in ('expense_update','expense_reversal')) as has_adjustment,
      bool_or(b.effective_date between v_period.start_date and v_period.end_date) as in_period
    from links l join public.journal_batches b on b.id=l.batch_id and b.company_id=p_company_id
      and b.status in ('POSTED','REVERSED') and b.effective_date<=v_period.end_date
    join public.journal_lines jl on jl.batch_id=b.id and jl.company_id=b.company_id and jl.deleted_at is null
    join public.accounts a on a.id=jl.account_id and a.company_id=b.company_id
    group by l.expense_id
  ), evidence as (
    select e.*,coalesce(p.office_debit,0) as office_debit,coalesce(p.batch_count,0) as batch_count,
      coalesce(p.has_adjustment,false) as has_adjustment,
      (select count(distinct po.owner_id) from public.property_owners po
        join public.owners o on o.id=po.owner_id and o.company_id=e.company_id
        where po.company_id=e.company_id and po.property_id=e.property_id
          and (po.starts_on is null or po.starts_on<=e.expense_date)
          and (po.ends_on is null or po.ends_on>=e.expense_date)) as owner_count
    from expenses e left join posting p on p.expense_id=e.id
    where (e.expense_date between v_period.start_date and v_period.end_date or coalesce(p.in_period,false))
      and (upper(coalesce(e.status,''))='POSTED' or coalesce(p.batch_count,0)>0)
  )
  select e.company_id,e.id,e.responsibility,''::text,f.account,
    coalesce((select a.name from public.accounts a where a.company_id=e.company_id and a.no=f.account limit 1),'')::text,
    e.amount::numeric,v_period.name::text,f.code,'HIGH'::text,f.detail
  from evidence e cross join lateral (values
    (e.responsibility in ('OWNER','TENANT') and e.office_debit>0,
     '6100','OWNER_TENANT_EXPENSE_IN_OFFICE_ACCOUNT',
     'Declared reimbursable expense retains a net office-expense posting. Review the obligation and source-scoped compensation; this finding is not authority to allocate or offset.'),
    (e.responsibility='OWNER' and e.owner_count>1,
     '','OWNER_ALLOCATION_UNRESOLVED',
     'Multiple owners overlap the source date. No immutable per-owner expense allocation is recorded; never assign the full amount to each owner.'),
    (e.responsibility='OWNER' and e.owner_count=0,
     '','MISSING_PROPERTY_AGREEMENT_LINKAGE',
     'No company-scoped owner-property relationship is evidenced at the source date. Owner identity and obligation scope require review.'),
    (e.batch_count=0,
     '','EXPENSE_POSTING_LINEAGE_MISSING',
     'No linked posted source event exists by the requested cutoff. Do not manufacture a zero balance or a correcting journal.'),
    (e.has_adjustment or e.deleted_at is not null or upper(coalesce(e.status,''))<>'POSTED',
     '','EXPENSE_HISTORY_REQUIRES_REVIEW',
     'Legacy adjustments, archived sources or changed posting status require review. Amount and responsibility shown are current source metadata, not a certified historical allocation snapshot.')
  ) f(applies,account,code,detail)
  where f.applies
  order by e.expense_date,e.id,f.code;
end;
$function$;
-- Replace the implementation, not the public contract or existing grants.
comment on function public.s08_analyze_expense_misclassification(uuid,uuid) is
'Company/period-scoped, OMR3, read-only expense source diagnostic. Flags classification, missing lineage and unresolved historical allocation; never applies a correction or infers offset rights.';
commit;
