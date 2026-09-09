-- FIN-007/008/013/016/018/019; SEC-001/002. No historical backfill.
begin;
-- Widen only: the prior two-decimal maintenance costs are not reconstructed.
alter table public.maintenance_records alter column cost type numeric(18,3);
alter table public.due_from_owners add column owner_agreement_version_id uuid references public.owner_agreement_versions(id);
alter table public.expenses add column owner_allocation_version smallint check(owner_allocation_version=1);
create table public.expense_owner_allocations (
  expense_id uuid not null references public.expenses(id),
  due_from_owner_id uuid not null unique references public.due_from_owners(id),
  company_id uuid not null references public.companies(id),
  allocation_evidence text not null check(length(btrim(allocation_evidence))>=3),
  created_at timestamptz not null default now(),
  primary key(expense_id,due_from_owner_id)
);
alter table public.expense_owner_allocations enable row level security;
revoke all on public.expense_owner_allocations from public,anon,authenticated;
grant select on public.expense_owner_allocations to authenticated;
grant all on public.expense_owner_allocations to service_role;
create policy expense_owner_allocation_read on public.expense_owner_allocations for select to authenticated
 using(company_id=public.current_company_id() and public.current_user_has_effective_app_permission('financial.reports.view'));

create function app_private.guard_expense_owner_allocation() returns trigger language plpgsql
set search_path to 'public','pg_temp' as $$
begin
 if tg_table_name='due_from_owners' then
  if tg_op='DELETE' or (to_jsonb(old)-array['status','recovered_amount','offset_amount','waived_amount','outstanding','reversed_request_id','reversal_journal_batch_id','updated_at'])
    is distinct from (to_jsonb(new)-array['status','recovered_amount','offset_amount','waived_amount','outstanding','reversed_request_id','reversal_journal_batch_id','updated_at']) then
   raise exception 'OWNER_RECEIVABLE_SOURCE_IMMUTABLE' using errcode='42501';
  end if;
 elsif tg_table_name='expense_owner_allocations' then
  if tg_op<>'INSERT' then raise exception 'OWNER_EXPENSE_ALLOCATION_IMMUTABLE' using errcode='42501'; end if;
  if not exists(select 1 from public.expenses e join public.due_from_owners d
    on d.id=new.due_from_owner_id and d.company_id=e.company_id and d.source_id=e.id::text
    where e.id=new.expense_id and e.company_id=new.company_id and e.owner_allocation_version=1
      and d.property_id=e.property_id::text and d.source_type='OWNER_EXPENSE') then
   raise exception 'OWNER_EXPENSE_ALLOCATION_SCOPE_INVALID' using errcode='23514';
  end if;
 elsif old.owner_allocation_version is not null then
  if tg_op='DELETE' or (to_jsonb(old)-array['description','attachment_url','updated_at'])
     is distinct from (to_jsonb(new)-array['description','attachment_url','updated_at']) then
   raise exception 'OWNER_EXPENSE_SOURCE_IMMUTABLE_USE_GOVERNED_ADJUSTMENT' using errcode='42501';
  end if;
 elsif new.owner_allocation_version is distinct from old.owner_allocation_version then
  raise exception 'OWNER_EXPENSE_PROVENANCE_IMMUTABLE' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function app_private.guard_expense_owner_allocation() from public,anon,authenticated;
create trigger owner_receivable_source_guard before update or delete on public.due_from_owners for each row execute function app_private.guard_expense_owner_allocation();
create trigger expense_owner_allocation_guard before insert or update or delete on public.expense_owner_allocations
 for each row execute function app_private.guard_expense_owner_allocation();
create trigger expense_owner_source_guard before update or delete on public.expenses
 for each row execute function app_private.guard_expense_owner_allocation();

create or replace function public.create_expense_with_journal_atomic(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare
 v_company uuid; v_request text:=nullif(p_payload->>'request_id',''); v_cached jsonb; v_result jsonb;
 v_fp text; v_internal text; v_id uuid; v_no text; v_allocations jsonb:=p_payload->'owner_allocations';
 v_evidence text:=nullif(btrim(p_payload->>'allocation_evidence'),''); v_a jsonb; v_dfo jsonb;
 v_amount numeric(18,3):=nullif(p_payload->>'amount','')::numeric;
 v_date date:=nullif(p_payload->>'expense_date','')::date;
 v_property uuid:=nullif(p_payload->>'property_id','')::uuid;
 v_contract uuid:=nullif(p_payload->>'contract_id','')::uuid;
 v_center uuid:=nullif(p_payload->>'cost_center_id','')::uuid;
 v_category text:=nullif(p_payload->>'category','');
 v_responsibility text:=coalesce(nullif(upper(btrim(p_payload->>'charged_to')),''),'COMPANY');
begin
 if auth.uid() is null or not public.is_admin_or_manager() then
  raise exception 'ADMIN or MANAGER role is required to create expenses.' using errcode='42501';
 end if;
 v_company:=public.require_company_id();
 v_request:=coalesce(v_request,gen_random_uuid()::text);
 v_fp:=encode(sha256(convert_to((p_payload-'request_id')::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('expense_create:'||v_company::text||':'||v_request,0));
 select response_payload into v_cached from public.financial_operation_idempotency
 where operation_name='create_expense_with_journal_atomic:'||v_company::text and request_id=v_request for update;
 if v_cached is not null then
  -- Old cache entries retain their historical response. Only new server
  -- fingerprints are authoritative; no retrospective fabricated intent.
  if v_cached ? '_expense_request_fingerprint' and v_cached->>'_expense_request_fingerprint' is distinct from v_fp then
   raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode='22023';
  end if;
  return v_cached||jsonb_build_object('idempotent',true);
 end if;
 if v_responsibility not in ('OWNER','TENANT','COMPANY') then raise exception 'EXPENSE_RESPONSIBILITY_INVALID' using errcode='22023'; end if;
 p_payload:=p_payload||jsonb_build_object('charged_to',v_responsibility);
 if v_responsibility<>'OWNER' then
  v_internal:='phase3a1a:'||v_company::text||':'||v_request;
  v_result:=public.create_expense_with_journal_atomic_phase3a1a_impl(jsonb_set(p_payload,'{request_id}',to_jsonb(v_internal)));
  v_result:=v_result||jsonb_build_object('request_id',v_request);
 else
  if jsonb_typeof(v_allocations) is distinct from 'array' or v_evidence is null or length(v_evidence)<3 then
   raise exception 'OWNER_EXPENSE_ALLOCATION_REQUIRED' using errcode='22023';
  end if;
  if v_property is null or v_date is null or v_amount is null or v_amount<=0 or v_category is null then
   raise exception 'OWNER_EXPENSE_PROPERTY_DATE_AMOUNT_CATEGORY_REQUIRED' using errcode='22023';
  end if;
  perform 1 from public.properties where id=v_property and company_id=v_company and deleted_at is null for update;
  if not found then raise exception 'OWNER_EXPENSE_PROPERTY_FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.property_owners where property_id=v_property and company_id=v_company for share;
  if v_contract is not null and not exists(select 1 from public.contracts where id=v_contract and company_id=v_company and property_id=v_property and deleted_at is null) then
   raise exception 'OWNER_EXPENSE_CONTRACT_FORBIDDEN' using errcode='42501';
  end if;
  if v_center is not null and not exists(select 1 from public.cost_centers where id=v_center and company_id=v_company) then
   raise exception 'OWNER_EXPENSE_COST_CENTER_FORBIDDEN' using errcode='42501';
  end if;
  if jsonb_array_length(v_allocations)=0 or
     (select sum(round((a->>'amount')::numeric,3)) from jsonb_array_elements(v_allocations) a) is distinct from v_amount then
   raise exception 'OWNER_EXPENSE_ALLOCATION_TOTAL' using errcode='22023';
  end if;
  if (select count(distinct (a->>'owner_id')::uuid) from jsonb_array_elements(v_allocations) a)<>jsonb_array_length(v_allocations) then
   raise exception 'OWNER_EXPENSE_ALLOCATION_DUPLICATE_OR_MISSING_OWNER' using errcode='22023';
  end if;
  for v_a in select value from jsonb_array_elements(v_allocations) order by value->>'owner_id' loop
   if round((v_a->>'amount')::numeric,3) is null or round((v_a->>'amount')::numeric,3)<=0 then
    raise exception 'OWNER_EXPENSE_ALLOCATION_AMOUNT_INVALID' using errcode='22023';
   end if;
   if not exists(select 1 from public.property_owners po where po.company_id=v_company and po.property_id=v_property
     and po.owner_id=(v_a->>'owner_id')::uuid and (po.starts_on is null or po.starts_on<=v_date) and (po.ends_on is null or po.ends_on>=v_date)) then
    raise exception 'OWNER_EXPENSE_ALLOCATION_OWNER_FORBIDDEN' using errcode='42501';
   end if;
  end loop;
  v_id:=gen_random_uuid(); v_no:='EXP-'||to_char(now(),'YYYYMMDD')||'-'||substr(replace(v_id::text,'-',''),1,8);
  insert into public.expenses(id,company_id,property_id,category,amount,expense_date,description,cost_center_id,contract_id,charged_to,attachment_url,status,date_time,no,owner_allocation_version)
  values(v_id,v_company,v_property,v_category,v_amount,v_date,nullif(p_payload->>'description',''),v_center,v_contract,'OWNER',nullif(p_payload->>'attachment_url',''),'POSTED',v_date::text,v_no,1);
  for v_a in select value from jsonb_array_elements(v_allocations) order by value->>'owner_id' loop
   v_dfo:=public.create_owner_receivable_atomic(jsonb_build_object('owner_id',v_a->>'owner_id','owner_agreement_id',v_a->>'owner_agreement_id',
    'property_id',v_property,'amount',round((v_a->>'amount')::numeric,3),'effective_date',v_date,'source_id',v_id,
    'cash_account_no','1111','request_id','expense:'||v_id::text||':'||(v_a->>'owner_id')));
   insert into public.expense_owner_allocations(expense_id,due_from_owner_id,company_id,allocation_evidence)
   values(v_id,(v_dfo->>'due_from_owner_id')::uuid,v_company,v_evidence);
  end loop;
  v_result:=jsonb_build_object('success',true,'expense_id',v_id,'expense_no',v_no,'request_id',v_request,'idempotent',false);
 end if;
 v_result:=v_result||jsonb_build_object('_expense_request_fingerprint',v_fp);
 insert into public.financial_operation_idempotency(operation_name,request_id,response_payload)
 values('create_expense_with_journal_atomic:'||v_company::text,v_request,v_result);
 return v_result;
end; $$;

-- A source explicitly adopted into the owner receivable subledger must not
-- remain a second legacy balance, or an automatic deduction from owner funds.
-- NULL legacy rows are untouched; no classification is inferred from GL.
do $patch$
declare r record; d text;
begin
 for r in select * from (values
 ('public.calculate_owner_net_payout(uuid,date,date,text)','from public.expenses e','from public.expenses e'),
 ('public.owner_settlement_reservable_expenses(uuid,uuid,date,date,text)','from public.expenses e','from public.expenses e'),
 ('public.wp05_subledger_due_from_owner(uuid,date)','from public.expenses e','from public.expenses e'),
 ('public._owner_statement_expenses(uuid,date,date)','FROM public.expenses e','FROM public.expenses e'),
 ('public.recalculate_owner_balance(uuid)','FROM public.expenses e','FROM public.expenses e')
 ) x(signature,needle,replacement) loop
  d:=pg_get_functiondef(r.signature::regprocedure);
  if (length(d)-length(replace(d,r.needle,'')))/length(r.needle)<>1 then raise exception 'OWNER_EXPENSE_READ_ADOPTION_PRECONDITION: %',r.signature; end if;
  -- Inline source filtering at the authoritative selector, before summation or
  -- reservation. Kept as a derived source to cover both static/dynamic SQL.
  execute replace(d,r.needle,replace(r.replacement,'public.expenses e','(select * from public.expenses where owner_allocation_version is null) e'));
 end loop;
end; $patch$;

-- Deferred completeness makes provenance structural, not a caller-controlled
-- label: no adopted source can commit without its exact immutable allocation.
create function app_private.require_complete_expense_allocation() returns trigger
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare e public.expenses%rowtype; v_id uuid; v_total numeric; v_count bigint; v_owners bigint;
begin
 if tg_table_name='expenses' then v_id:=new.id; else v_id:=new.expense_id; end if;
 select * into e from public.expenses where id=v_id;
 if e.owner_allocation_version=1 then
  select sum(d.amount),count(*),count(distinct d.owner_id) into v_total,v_count,v_owners
   from public.expense_owner_allocations a join public.due_from_owners d on d.id=a.due_from_owner_id and d.company_id=a.company_id
   where a.expense_id=e.id and a.company_id=e.company_id;
  if v_total is distinct from e.amount or v_count=0 or v_count<>v_owners then
   raise exception 'OWNER_EXPENSE_ALLOCATION_INCOMPLETE' using errcode='23514';
  end if;
 end if;
 return new;
end; $$;
revoke all on function app_private.require_complete_expense_allocation() from public,anon,authenticated;
create constraint trigger expense_allocation_complete after insert on public.expenses deferrable initially deferred for each row execute function app_private.require_complete_expense_allocation();
create constraint trigger expense_allocation_link_complete after insert on public.expense_owner_allocations deferrable initially deferred for each row execute function app_private.require_complete_expense_allocation();

-- Extend the existing maintenance command, without a second overload. Existing
-- six-argument SQL calls still resolve via defaults; OWNER callers supply the
-- explicit allocation rather than inferring a party from a property label.
do $maintenance$
declare d text;
begin
 d:=pg_get_functiondef('public.close_maintenance_with_expense(text,numeric,text,text,text,boolean)'::regprocedure);
 if position('p_confirmed boolean DEFAULT false)' in d)=0 or position('''charged_to'', v_charged_to,' in d)=0 then
  raise exception 'OWNER_EXPENSE_MAINTENANCE_CONTRACT_PRECONDITION';
 end if;
 d:=replace(d,'p_confirmed boolean DEFAULT false)', 'p_confirmed boolean DEFAULT false, p_owner_allocations jsonb DEFAULT NULL::jsonb, p_allocation_evidence text DEFAULT NULL::text)');
 d:=replace(d,'''charged_to'', v_charged_to,', '''charged_to'', v_charged_to, ''owner_allocations'',p_owner_allocations,''allocation_evidence'',p_allocation_evidence,''attachment_url'',p_evidence_url,');
 if position('  v_expense_id uuid;' in d)=0 or position('  if lower(coalesce(v_row.status,' in d)=0
   or position($r$  return jsonb_build_object('maintenance', to_jsonb(v_row), 'expense_id', coalesce(v_expense_id, v_row.expense_id));$r$ in d)=0 then
  raise exception 'OWNER_EXPENSE_MAINTENANCE_RETRY_PRECONDITION';
 end if;
 d:=replace(d,'  v_expense_id uuid;', '  v_expense_id uuid; v_fp text; v_cached jsonb; v_result jsonb;');
 d:=replace(d,'  if lower(coalesce(v_row.status,', $cache$  v_fp:=encode(sha256(convert_to(jsonb_build_array(p_cost,v_charged_to,p_notes,p_evidence_url,p_confirmed,p_owner_allocations,p_allocation_evidence)::text,'UTF8')),'hex');
  select response_payload into v_cached from public.financial_operation_idempotency where operation_name='close_maintenance_with_expense:'||v_company_id::text and request_id=p_request_id;
  if v_cached is not null then
   if v_cached->>'fingerprint' is distinct from v_fp then raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode='22023'; end if;
   return v_cached->'response';
  end if;
  if lower(coalesce(v_row.status,$cache$);
 d:=replace(d,$r$  return jsonb_build_object('maintenance', to_jsonb(v_row), 'expense_id', coalesce(v_expense_id, v_row.expense_id));$r$,
 $r$  v_result:=jsonb_build_object('maintenance', to_jsonb(v_row), 'expense_id', coalesce(v_expense_id, v_row.expense_id));
  insert into public.financial_operation_idempotency(operation_name,request_id,response_payload)
  values('close_maintenance_with_expense:'||v_company_id::text,p_request_id,jsonb_build_object('fingerprint',v_fp,'response',v_result));
  return v_result;$r$);
 drop function public.close_maintenance_with_expense(text,numeric,text,text,text,boolean);
 execute d;
end; $maintenance$;
revoke all on function public.close_maintenance_with_expense(text,numeric,text,text,text,boolean,jsonb,text) from public,anon,authenticated;
grant execute on function public.close_maintenance_with_expense(text,numeric,text,text,text,boolean,jsonb,text) to authenticated,service_role;

-- Persist the exact version already selected by the canonical receivable RPC;
-- old booleans are not backfilled with a guessed version.
do $version$
declare d text; r record;
begin
 for r in select * from (values
 ('id, company_id, owner_id, owner_agreement_id, property_id, source_type, source_id,',
  'id, company_id, owner_id, owner_agreement_id, owner_agreement_version_id, property_id, source_type, source_id,'),
 ('v_dfo_id, v_company_id, v_owner_id, v_agreement_id, v_property_id,',
  'v_dfo_id, v_company_id, v_owner_id, v_agreement_id, v_agreement_version_id, v_property_id,'),
 ('  -- Book the owner obligation to 1300 (never 6100) — reuse the canonical kernel.',
 $source$  if exists(select 1 from public.expenses where company_id=v_company_id and id::text=v_source_id) then
   declare e public.expenses%rowtype; v_allocated numeric;
   begin
    select * into e from public.expenses where company_id=v_company_id and id::text=v_source_id for update;
    if e.owner_allocation_version is distinct from 1 then raise exception 'OWNER_EXPENSE_LEGACY_REVIEW_REQUIRED' using errcode='23514'; end if;
    select coalesce(sum(d.amount),0) into v_allocated from public.expense_owner_allocations a join public.due_from_owners d on d.id=a.due_from_owner_id and d.company_id=a.company_id where a.expense_id=e.id and a.company_id=e.company_id;
    if v_allocated+v_amount>e.amount then raise exception 'OWNER_EXPENSE_SOURCE_ALREADY_ALLOCATED' using errcode='23514'; end if;
   end;
  end if;
  -- Book the owner obligation to 1300 (never 6100) — reuse the canonical kernel.$source$)
 ) x(old_text,new_text) loop
  d:=pg_get_functiondef('public.create_owner_receivable_atomic(jsonb)'::regprocedure);
  if (length(d)-length(replace(d,r.old_text,'')))/length(r.old_text)<>1 then raise exception 'OWNER_EXPENSE_AGREEMENT_VERSION_PRECONDITION'; end if;
  execute replace(d,r.old_text,r.new_text);
 end loop;
end; $version$;

-- Diagnostic lineage must follow the new authoritative subledger, not hide it.
do $lineage$
declare d text; r record;
begin
 for r in select * from (values
 ('public.s08_analyze_expense_misclassification(uuid,uuid)',
  '  ), links as (',
  '    union select e.id,d.journal_batch_id from expenses e join public.expense_owner_allocations a on a.expense_id=e.id and a.company_id=e.company_id join public.due_from_owners d on d.id=a.due_from_owner_id and d.company_id=a.company_id
  ), links as ('),
 ('public.s08_analyze_expense_misclassification(uuid,uuid)',
  $s$e.responsibility='OWNER' and e.owner_count>1$s$, $s$e.responsibility='OWNER' and e.owner_count>1 and e.owner_allocation_version is null$s$),
 ('public.s09_create_correction_draft(jsonb)',
  $s$  if v_source_type='expense' then$s$,
  $s$  if v_source_type='expense' and exists(select 1 from public.expenses where id::text=v_source_id and company_id=v_company_id and owner_allocation_version=1) then raise exception 'OWNER_EXPENSE_USE_RECEIVABLE_ADJUSTMENT' using errcode='23514'; end if;
  if v_source_type='expense' then$s$)
 ) x(signature,old_text,new_text) loop
  d:=pg_get_functiondef(r.signature::regprocedure);
  if (length(d)-length(replace(d,r.old_text,'')))/length(r.old_text)<>1 then raise exception 'OWNER_EXPENSE_LINEAGE_PRECONDITION: %',r.signature; end if;
  execute replace(d,r.old_text,r.new_text);
 end loop;
end; $lineage$;
-- No alternate legacy OWNER writer remains callable through the old internal
-- company-expense implementation. Its old cached responses stay untouched.
do $internal$
declare d text; old_text text:='  if v_property_id is null then raise exception';
begin
 d:=pg_get_functiondef('public.create_expense_with_journal_atomic_phase3a1a_impl(jsonb)'::regprocedure);
 if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'OWNER_EXPENSE_INTERNAL_PRECONDITION'; end if;
 execute replace(d,old_text,$s$  if upper(btrim(coalesce(v_charged_to,'')))='OWNER' then raise exception 'OWNER_EXPENSE_USE_CANONICAL_ALLOCATION_COMMAND' using errcode='23514'; end if;
  if v_property_id is null then raise exception$s$);
end; $internal$;

-- Extend the existing snapshot's posting graph. Legacy NULL-provenance sources
-- retain byte-equivalent evidence; new allocation evidence is included only for
-- the new source model, never retroactively grafted onto older reviews.
do $snapshot$
declare d text; old_text text:='  ), links as (';
begin
 d:=pg_get_functiondef('app_private.expense_correction_source_snapshot(uuid,text)'::regprocedure);
 if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'OWNER_EXPENSE_SNAPSHOT_PRECONDITION'; end if;
 execute replace(d,old_text,$s$    union select d.journal_batch_id from public.expense_owner_allocations a join public.due_from_owners d on d.id=a.due_from_owner_id and d.company_id=a.company_id where a.expense_id=e.id and a.company_id=p_company
    union select r.journal_batch_id from public.expense_owner_allocations a join public.due_from_owner_recoveries r on r.due_from_owner_id=a.due_from_owner_id and r.company_id=a.company_id where a.expense_id=e.id and a.company_id=p_company
    union select o.journal_batch_id from public.expense_owner_allocations a join public.due_from_owner_offsets o on o.due_from_owner_id=a.due_from_owner_id and o.company_id=a.company_id where a.expense_id=e.id and a.company_id=p_company
  ), links as ($s$);
 d:=pg_get_functiondef('app_private.expense_correction_source_snapshot(uuid,text)'::regprocedure);
 old_text:=$tail$'owners',v_owners,'contract',v_contract,'postings',v_postings);$tail$;
 if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'OWNER_EXPENSE_ALLOCATION_SNAPSHOT_PRECONDITION'; end if;
 execute replace(d,old_text,$tail$'owners',v_owners,'contract',v_contract,'postings',v_postings)
  || case when e.owner_allocation_version=1 then jsonb_build_object('allocations',(
    select jsonb_agg(jsonb_build_array(a.due_from_owner_id,d.owner_id,d.amount,d.owner_agreement_id,d.owner_agreement_version_id,d.lawful_offset_right,a.allocation_evidence) order by d.owner_id)
    from public.expense_owner_allocations a join public.due_from_owners d on d.id=a.due_from_owner_id and d.company_id=a.company_id where a.expense_id=e.id and a.company_id=e.company_id
  )) else '{}'::jsonb end;$tail$);
end; $snapshot$;

-- Legacy expense labels are not enforceable offset evidence. Preserve their
-- historical display and cached lifecycle responses, but do not create or pay
-- a new automatically-netted settlement while source review is outstanding.
create function app_private.require_allocated_expense_settlement_scope(p_company uuid,p_owner uuid,p_from date,p_to date,p_property text)
returns void language plpgsql set search_path to 'public','pg_temp' as $$
begin
 if exists(select 1 from public.owner_settlement_reservable_expenses(p_company,p_owner,p_from,p_to,p_property)) then
  raise exception 'OWNER_SETTLEMENT_LEGACY_EXPENSE_REVIEW_REQUIRED: راجع تخصيص المصروفات القديمة وحق المقاصة قبل تسوية أموال المالك' using errcode='23514';
 end if;
end; $$;
revoke all on function app_private.require_allocated_expense_settlement_scope(uuid,uuid,date,date,text) from public,anon,authenticated;
do $settlement_scope$
declare d text; r record;
begin
 for r in select * from (values
 ('public.create_owner_settlement_draft_atomic(jsonb)', '  -- P1: derive every amount from canonical sources (unchanged).',
  '  perform app_private.require_allocated_expense_settlement_scope(v_company_id,v_owner_id::uuid,v_period_start,v_period_end,v_property_id);'),
 ('public.approve_owner_settlement_atomic_s02_base(jsonb)', '  -- ── FA-003: the settlement must be fully reserved by its derived items and',
  '  perform app_private.require_allocated_expense_settlement_scope(v_company_id,v_row.owner_id::uuid,v_row.period_start,v_row.period_end,v_row.property_id::text);'),
 ('public.pay_owner_settlement_atomic_s02_base(jsonb)', '  -- GAP-008: the lawful offset already debited 2000 / credited 1300.',
  '  perform app_private.require_allocated_expense_settlement_scope(v_company_id,v_row.owner_id::uuid,v_row.period_start,v_row.period_end,v_row.property_id::text);')
 ) x(signature,needle,guard) loop
  d:=pg_get_functiondef(r.signature::regprocedure);
  if (length(d)-length(replace(d,r.needle,'')))/length(r.needle)<>1 then raise exception 'OWNER_EXPENSE_SETTLEMENT_SCOPE_PRECONDITION: %',r.signature; end if;
  execute replace(d,r.needle,r.guard||chr(10)||r.needle);
 end loop;
end; $settlement_scope$;

-- The offset has already reduced owner funds. Capture only residual cash
-- payout, once; never subtract the gross settlement a second time. No old
-- events are rewritten. The business amount is checked against its posting.
create or replace function public.capture_owner_funds_settlement_payout() returns trigger
language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_amount numeric(18,3); v_batch uuid; v_date date; v_posted numeric;
begin
 if new.status='PAID' and coalesce(old.status,'')<>'PAID' then
  v_amount:=public.gl_pm_round_omr(coalesce(new.net_payable,0)-coalesce(new.offset_applied,0));
  if v_amount<0 then raise exception 'OWNER_SETTLEMENT_EFFECTIVE_PAYABLE_NEGATIVE' using errcode='23514'; end if;
  if v_amount>0 then
   select b.id,b.effective_date into v_batch,v_date from public.journal_batches b
    where b.company_id=new.company_id and b.source_type='owner_settlement_payment'
      and b.source_id=new.id::text and b.event_id='pay' and b.status='POSTED';
   select sum(l.debit-l.credit) into v_posted from public.journal_lines l join public.accounts a
    on a.id=l.account_id and a.company_id=l.company_id where l.batch_id=v_batch
      and l.company_id=new.company_id and l.deleted_at is null and a.no='2000';
   if v_batch is null or v_posted is distinct from v_amount then
    raise exception 'OWNER_SETTLEMENT_PAYOUT_SOURCE_POSTING_MISMATCH' using errcode='23514';
   end if;
   insert into public.owner_funds_events(company_id,owner_id,source_type,source_id,event_id,amount_delta,effective_date,journal_batch_id)
   values(new.company_id,new.owner_id::uuid,'OWNER_SETTLEMENT_PAYOUT',new.id::text,'payout',-v_amount,v_date,v_batch);
  end if;
 end if;
 return new;
end; $$;
-- Retire the verified duplicate raw-expense writer. The compatibility command
-- may still request a valid zero-cost technical completion, but all money must
-- use verified closure; it no longer creates an unposted expense behind it.
create or replace function public.resolve_maintenance_with_expense(p_request_id text,p_cost numeric,p_notes text default null)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
 if auth.uid() is null or not public.current_user_has_effective_app_permission('maintenance.approve') then
  raise exception 'MAINTENANCE_APPROVAL_PERMISSION_REQUIRED' using errcode='42501';
 end if;
 if p_cost is distinct from 0 then raise exception 'MAINTENANCE_USE_VERIFIED_FINANCIAL_CLOSURE' using errcode='23514'; end if;
 return jsonb_build_object('maintenance',public.transition_maintenance_status_atomic(p_request_id,'resolved',p_notes),'expense_id',null);
end; $$;
notify pgrst, 'reload schema';
commit;
