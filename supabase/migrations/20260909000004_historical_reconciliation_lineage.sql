-- FIN-004/009/010/013/016/018/019, SEC-001/002.
-- Forward-only read-model correction. No financial rows, posted dates, ACLs,
-- function signatures or accounting policy are changed.
-- Rewind operational balances using source-event AMOUNTS and booked header
-- dates. Never sum journal lines to manufacture an agreeing "subledger".
-- Complete dated legacy lineage remains readable. Incomplete source history
-- fails explicitly instead of inventing dates. There is no current_date bypass:
-- a current counter may already contain future-dated settlements.
begin;

-- Refuse an unexpected deployed authority boundary; do not overwrite drift.
do $precondition$
begin
  if (select count(*) from pg_proc where oid in (
      to_regprocedure('public.wp05_subledger_tenant_receivables(uuid,date)'),
      to_regprocedure('public.wp05_subledger_security_deposits(uuid,date)'))
      and not prosecdef and provolatile='s') <> 2 then
    raise exception 'HISTORICAL_RECONCILIATION_PRECONDITION: expected existing stable invoker contracts';
  end if;
end;
$precondition$;

create or replace function public.wp05_subledger_tenant_receivables(
  p_company_id uuid, p_as_of date default current_date
) returns table(balance numeric, cnt bigint)
language plpgsql stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_balance numeric;
  v_count bigint;
  v_incomplete boolean;
begin
  if p_company_id is null or p_as_of is null then
    raise exception 'WP05_SUBLEDGER_TENANT_REQUIRED: company_id and as_of required' using errcode='22023';
  end if;

  -- A removed/voided posted invoice has no general-purpose operational void
  -- timeline. Do not silently omit it from an earlier historical snapshot.
  if p_as_of < current_date and exists (
    select 1 from public.invoices i
    join public.journal_batches b on b.id=i.invoice_posting_batch_id and b.company_id=i.company_id
    where i.company_id=p_company_id and b.effective_date<=p_as_of
      and i.invoice_accounting_classification='OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS'
      and (i.deleted_at is not null or upper(i.status) in ('VOID','VOIDED','CANCELLED'))
  ) then
    raise exception 'AR_AS_OF_HISTORY_INCOMPLETE: removed invoice history requires governed review' using errcode='23514';
  end if;

  with invoice_sources as (
    select i.*, coalesce(b.effective_date, legacy.effective_date, i.issue_date) as booked_on,
      case when b.id is not null and b.status in ('POSTED','REVERSED') then 1 else coalesce(legacy.sources,0) end as source_count
    from public.invoices i
    left join public.journal_batches b on b.id=i.invoice_posting_batch_id and b.company_id=i.company_id
    left join lateral (
      select count(*)::integer as sources, min(jb.effective_date) as effective_date
      from public.journal_batches jb
      where i.invoice_posting_batch_id is null and jb.company_id=i.company_id
        and jb.source_type='invoice' and jb.source_id=i.id::text and jb.status in ('POSTED','REVERSED')
        and exists (select 1 from public.journal_lines l join public.accounts a on a.id=l.account_id and a.company_id=l.company_id
          where l.batch_id=jb.id and l.company_id=i.company_id and a.no='1201' and l.deleted_at is null)
    ) legacy on true
    where i.company_id=p_company_id and i.deleted_at is null
      and upper(coalesce(i.status,'')) not in ('VOID','VOIDED','CANCELLED')
      and (
        (i.invoice_accounting_classification='OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS'
          and (i.document_status='POSTED' or i.invoice_posting_batch_id is not null))
        or (i.invoice_accounting_classification is null and legacy.sources>0)
      )
  ), cash_sources as (
    select a.invoice_id, a.amount, upper(r.status) as status,
      j.effective_date, j.reversed_on, j.sources, j.reversals
    from public.receipt_allocations a
    join invoice_sources i on i.id=a.invoice_id and i.company_id=a.company_id
    join public.receipts r on r.id=a.receipt_id and r.company_id=a.company_id
    left join lateral (
      select count(distinct b.id) as sources, min(b.effective_date) as effective_date,
        count(v.id) as reversals, min(v.effective_date) as reversed_on
      from public.journal_batches b
      left join public.journal_batches v on v.reversal_of_batch_id=b.id and v.company_id=b.company_id
        and v.source_type='journal_reversal' and v.status in ('POSTED','REVERSED')
      where b.company_id=a.company_id and b.source_type='receipt' and b.source_id=r.id::text
        and b.status in ('POSTED','REVERSED')
    ) j on true
    where a.company_id=p_company_id and a.deleted_at is null and r.deleted_at is null
      and upper(r.status) in ('POSTED','VOID')
  ), credit_sources as (
    select c.*, b.effective_date as booked_on, v.effective_date as reversed_on
    from public.invoice_credits c join invoice_sources i on i.id=c.invoice_id and i.company_id=c.company_id
    left join public.journal_batches b on b.id=c.journal_batch_id and b.company_id=c.company_id and b.status in ('POSTED','REVERSED')
    left join public.journal_batches v on v.id=c.reversal_journal_batch_id and v.company_id=c.company_id and v.status in ('POSTED','REVERSED')
    where c.company_id=p_company_id and c.status in ('POSTED','REVERSED')
  ), application_sources as (
    select c.*, b.effective_date as booked_on, v.effective_date as reversed_on
    from public.deposit_application_claims c join invoice_sources i on i.id::text=c.invoice_id and i.company_id=c.company_id
    left join public.journal_batches b on b.id=c.application_journal_batch_id and b.company_id=c.company_id and b.status in ('POSTED','REVERSED')
    left join public.journal_batches v on v.id=c.reversal_journal_batch_id and v.company_id=c.company_id and v.status in ('POSTED','REVERSED')
    where c.company_id=p_company_id and c.claim_kind='INVOICE_ARREARS' and c.target_account_no='1201'
      and c.status in ('APPLIED','REVERSED')
  ), movements as (
    select invoice_id, 'paid'::text as kind, amount, effective_date, sources=1 as valid from cash_sources
    union all select invoice_id,'paid',-amount,reversed_on,reversals=1 from cash_sources where status='VOID'
    union all select invoice_id,'credit',amount,booked_on,true from credit_sources
    union all select invoice_id,'credit',-amount,reversed_on,true from credit_sources where status='REVERSED'
    union all select invoice_id::uuid,'paid',allocation_amount,booked_on,true from application_sources
    union all select invoice_id::uuid,'paid',-allocation_amount,reversed_on,true from application_sources where status='REVERSED'
  ), settlement_totals as (
    select invoice_id,
      coalesce(sum(amount) filter(where kind='paid'),0) as paid,
      coalesce(sum(amount) filter(where kind='credit'),0) as credited,
      coalesce(sum(amount) filter(where effective_date>p_as_of),0) as after_cutoff,
      bool_or(not valid or effective_date is null) as incomplete
    from movements group by invoice_id
  ), snapshots as (
    select greatest(public.wp05_round_omr(i.amount+coalesce(i.tax_amount,0)-i.paid_amount-i.credited_amount+coalesce(t.after_cutoff,0)),0) as outstanding,
      i.source_count<>1 or coalesce(t.incomplete,false)
        or abs(coalesce(t.paid,0)-i.paid_amount)>0.0005
        or abs(coalesce(t.credited,0)-i.credited_amount)>0.0005 as incomplete
    from invoice_sources i left join settlement_totals t on t.invoice_id=i.id
    where i.booked_on<=p_as_of
  )
  select public.wp05_round_omr(coalesce(sum(outstanding),0)),
    count(*) filter(where outstanding>0.0005), coalesce(bool_or(incomplete),false)
  into v_balance,v_count,v_incomplete from snapshots;

  if v_incomplete then
    raise exception 'AR_AS_OF_HISTORY_INCOMPLETE: missing or inconsistent invoice/settlement posting lineage' using errcode='23514';
  end if;
  return query select v_balance,v_count;
end;
$function$;

create or replace function public.wp05_subledger_security_deposits(
  p_company_id uuid, p_as_of date default current_date
) returns table(balance numeric, cnt bigint)
language plpgsql stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_balance numeric;
  v_count bigint;
  v_incomplete boolean;
begin
  if p_company_id is null or p_as_of is null then
    raise exception 'WP05_SUBLEDGER_DEPOSIT_REQUIRED: company_id and as_of required' using errcode='22023';
  end if;
  with deposits as (
    select d.* from public.tenant_deposits d where d.company_id=p_company_id
      and (d.deleted_at is null or d.deleted_at::date>p_as_of)
  ), movements as (
    select t.deposit_id, t.type,
      case t.type when 'held' then t.amount when 'deduction' then -t.amount when 'refund' then -t.amount
        when 'reversal' then case original.type when 'held' then -t.amount when 'deduction' then t.amount when 'refund' then t.amount end
      end as delta,
      -- The original receipt has an explicit source date even in older rows;
      -- later event dates may NOT be fabricated from mutable created_at fields.
      coalesce(b.effective_date, case when t.type='held' then d.received_date end) as effective_date,
      b.id is not null as posted
    from public.deposit_transactions t join deposits d on d.id=t.deposit_id and d.company_id=t.company_id
    left join public.deposit_transactions original on original.id=t.reversal_of_id and original.company_id=t.company_id and original.deposit_id=t.deposit_id
    left join public.journal_batches b on b.id=t.journal_batch_id and b.company_id=t.company_id and b.status in ('POSTED','REVERSED')
    where t.company_id=p_company_id
  ), totals as (
    select deposit_id, sum(delta) as current_total,
      coalesce(sum(delta) filter(where effective_date>p_as_of),0) as after_cutoff,
      min(effective_date) filter(where type='held') as received_on,
      bool_or(delta is null or effective_date is null or not posted) as incomplete
    from movements group by deposit_id
  ), snapshots as (
    select public.wp05_round_omr(d.remaining_amount-coalesce(t.after_cutoff,0)) as remaining,
      coalesce(t.incomplete,true) or abs(coalesce(t.current_total,0)-d.remaining_amount)>0.0005 as incomplete
    from deposits d left join totals t on t.deposit_id=d.id
    where coalesce(t.received_on,d.received_date)<=p_as_of
  )
  select public.wp05_round_omr(coalesce(sum(remaining),0)),
    count(*) filter(where remaining>0.0005),coalesce(bool_or(incomplete),false)
  into v_balance,v_count,v_incomplete from snapshots;
  if v_incomplete then
    raise exception 'DEPOSIT_AS_OF_HISTORY_INCOMPLETE: missing or inconsistent deposit posting lineage' using errcode='23514';
  end if;
  return query select v_balance,v_count;
end;
$function$;

commit;
