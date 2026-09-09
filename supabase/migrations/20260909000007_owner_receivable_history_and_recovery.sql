-- FIN-009/013/016/019: retain source amounts and booked-event dates.
-- No posted rows/backfill. Existing legacy expense evidence remains visible;
-- it is not silently removed to make 1300 appear reconciled.
begin;
create function app_private.owner_receivable_history_balance(p_company_id uuid,p_as_of date)
returns table(balance numeric,cnt bigint)
language plpgsql stable set search_path to 'public','pg_temp'
as $function$
declare v_balance numeric; v_count bigint; v_valid boolean;
begin
  if p_company_id is null or p_as_of is null then
    raise exception 'OWNER_RECEIVABLE_HISTORY_SCOPE_REQUIRED' using errcode='22023';
  end if;
  if exists (
    select 1 from public.due_from_owners d
    where d.company_id=p_company_id and (
      d.source_type<>'OWNER_EXPENSE' or d.waived_amount<>0
      or (d.status='REVERSED') is distinct from (d.reversal_journal_batch_id is not null)
      or d.recovered_amount <> coalesce((select sum(r.amount) from public.due_from_owner_recoveries r
        where r.company_id=d.company_id and r.due_from_owner_id=d.id and r.status='POSTED'),0)
      or d.offset_amount <> coalesce((select sum(o.amount) from public.due_from_owner_offsets o
        where o.company_id=d.company_id and o.due_from_owner_id=d.id and o.status='POSTED'),0)
      or d.outstanding <> case when d.status='REVERSED' then 0 else d.amount-d.recovered_amount-d.offset_amount end
    )
  ) then
    raise exception 'OWNER_RECEIVABLE_HISTORY_COUNTER_GAP' using errcode='23514';
  end if;

  with sources as (
    select d.id as receivable_id,d.company_id,d.amount,d.journal_batch_id as batch_id,
      d.reversal_journal_batch_id as reversal_id,d.status='REVERSED' as reversed,
      'pm_owner_expense'::text as expected_type,true as parent_valid
    from public.due_from_owners d where d.company_id=p_company_id
    union all
    select r.due_from_owner_id,r.company_id,-r.amount,r.journal_batch_id,r.reversal_journal_batch_id,
      r.status='REVERSED','pm_due_from_owner_recovery',d.id is not null and d.owner_id=r.owner_id
    from public.due_from_owner_recoveries r
    left join public.due_from_owners d on d.id=r.due_from_owner_id and d.company_id=r.company_id
    where r.company_id=p_company_id
    union all
    select o.due_from_owner_id,o.company_id,-o.amount,o.journal_batch_id,o.reversal_journal_batch_id,
      o.status='REVERSED','pm_due_from_owner_offset',d.id is not null and d.owner_id=o.owner_id
    from public.due_from_owner_offsets o
    left join public.due_from_owners d on d.id=o.due_from_owner_id and d.company_id=o.company_id
    where o.company_id=p_company_id
  ), events as (
    select s.receivable_id,s.amount,s.batch_id,b.effective_date,
      s.parent_valid and b.id is not null and b.source_type=s.expected_type
      and b.reversal_of_batch_id is not distinct from s.reversal_id
      and s.reversed=(s.reversal_id is not null) as valid
    from sources s left join public.journal_batches b
      on b.id=s.batch_id and b.company_id=s.company_id and b.status in ('POSTED','REVERSED')
    union all
    select s.receivable_id,-s.amount,s.reversal_id,b.effective_date,
      s.parent_valid and b.id is not null and b.source_type='journal_reversal'
      and b.reversal_of_batch_id=s.batch_id as valid
    from sources s left join public.journal_batches b
      on b.id=s.reversal_id and b.company_id=s.company_id and b.status in ('POSTED','REVERSED')
    where s.reversed
  )
  select coalesce(sum(e.amount) filter(where e.effective_date<=p_as_of),0),
    count(distinct e.receivable_id) filter(where e.effective_date<=p_as_of),
    coalesce(bool_and(coalesce(e.valid,false) and e.effective_date is not null),true)
      and count(*)=count(distinct e.batch_id)
  into v_balance,v_count,v_valid from events e;
  if not v_valid then
    raise exception 'OWNER_RECEIVABLE_HISTORY_EVENT_GAP' using errcode='23514';
  end if;
  return query select round(v_balance,3),v_count;
end;
$function$;
revoke all on function app_private.owner_receivable_history_balance(uuid,date) from public,anon,authenticated;
grant execute on function app_private.owner_receivable_history_balance(uuid,date) to authenticated,service_role;

do $repair$
declare v_definition text; v_old text;
begin
  if not exists(select 1 from pg_proc where oid='public.wp05_subledger_due_from_owner(uuid,date)'::regprocedure
      and not prosecdef and provolatile='s')
    or not exists(select 1 from pg_proc where oid='public.recover_owner_receivable_atomic(jsonb)'::regprocedure and prosecdef) then
    raise exception 'OWNER_RECEIVABLE_HISTORY_BOUNDARY_PRECONDITION';
  end if;
  -- Preserve legacy expense evidence, existing invoker attributes and ACLs.
  v_definition:=pg_get_functiondef('public.wp05_subledger_due_from_owner(uuid,date)'::regprocedure);
  v_old:='return query select coalesce(v_bal,0)::numeric, coalesce(v_cnt,0)::bigint;';
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old)<>1 then
    raise exception 'OWNER_RECEIVABLE_HISTORY_READ_PRECONDITION';
  end if;
  execute replace(v_definition,v_old,
    'return query select coalesce(v_bal,0)+h.balance,coalesce(v_cnt,0)+h.cnt from app_private.owner_receivable_history_balance(p_company_id,p_as_of) h;');

  -- Different recovery requests are different business events. The existing
  -- company-scoped request cache/fingerprint continues to own retry identity.
  v_definition:=pg_get_functiondef('public.recover_owner_receivable_atomic(jsonb)'::regprocedure);
  v_old:='''event_id'', ''recover''';
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old)<>1 then
    raise exception 'OWNER_RECEIVABLE_RECOVERY_EVENT_PRECONDITION';
  end if;
  execute replace(v_definition,v_old,'''event_id'', ''recover:'' || v_request_id');

  select pg_get_constraintdef(oid) into v_definition from pg_constraint
  where conrelid='public.due_from_owners'::regclass and conname='due_from_owners_outstanding_chk' and contype='c' and convalidated;
  if v_definition is null or v_definition like '%status%'
    or v_definition not like '%wp02_gap008_round_omr%'
    or v_definition not like '%recovered_amount%'
    or v_definition not like '%offset_amount%'
    or v_definition not like '%waived_amount%' then
    raise exception 'OWNER_RECEIVABLE_REVERSAL_CONSTRAINT_PRECONDITION';
  end if;
  -- Retain the original check verbatim, adding only the compensating-reversal
  -- zero-outstanding branch. Original amount/components remain historical facts.
  execute 'alter table public.due_from_owners drop constraint due_from_owners_outstanding_chk';
  execute 'alter table public.due_from_owners add constraint due_from_owners_outstanding_chk check (('
    ||substring(v_definition from 8 for length(v_definition)-8)
    ||') or (status=''REVERSED'' and outstanding=0))';
end;
$repair$;
commit;
