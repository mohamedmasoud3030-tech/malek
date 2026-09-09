-- FIN-007/013/016/019; SEC-001/002. Source-scoped expense correction controls.
-- Old reviews/postings are never rewritten or automatically approved. An old
-- expense plan without a frozen source requires a new explicit review.
begin;
-- Nullable provenance: pre-migration JSON is not retroactively trusted as a
-- server-generated snapshot, even if a caller used the same reserved key.
alter table public.s08_frozen_reviews add column expense_source_snapshot_version smallint
  check (expense_source_snapshot_version=1);
-- Frozen evidence contains financial amounts and ownership identities. Keep
-- existing restrictive company isolation and no-direct-write policies, but do
-- not expose the snapshot through the former all-app-user SELECT policy.
alter policy s08_frozen_reviews_read on public.s08_frozen_reviews
  using (public.is_app_user() and public.current_user_has_effective_app_permission('financial.reports.view'));
create function app_private.expense_correction_source_snapshot(p_company uuid,p_expense text)
returns jsonb language plpgsql set search_path to 'public','pg_temp'
as $function$
declare e public.expenses%rowtype; v_owners jsonb; v_postings text; v_contract jsonb;
begin
  if p_company is null or p_expense is null then
    raise exception 'EXPENSE_REVIEW_SCOPE_REQUIRED' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('expense_correction:'||p_company::text||':'||p_expense,0));
  select x.* into e from public.expenses x where x.company_id=p_company and x.id::text=p_expense for update;
  if not found then raise exception 'EXPENSE_REVIEW_SOURCE_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  -- Hold the source and its parent while validating/posting. The parent lock
  -- also serializes new FK-backed ownership assignments with this decision.
  perform 1 from public.properties p where p.id=e.property_id and p.company_id=p_company for update;
  if not found then raise exception 'EXPENSE_REVIEW_PROPERTY_SCOPE_INVALID' using errcode='42501'; end if;
  perform 1 from public.property_owners po where po.property_id=e.property_id and po.company_id=p_company for share;
  select coalesce(jsonb_agg(jsonb_build_array(po.owner_id,po.ownership_percentage,po.starts_on,po.ends_on,po.is_primary)
    order by po.owner_id,po.starts_on,po.ends_on),'[]'::jsonb)
  into v_owners from public.property_owners po
  where po.property_id=e.property_id and po.company_id=p_company
    and (po.starts_on is null or po.starts_on<=e.expense_date)
    and (po.ends_on is null or po.ends_on>=e.expense_date);

  if e.contract_id is not null then
    select jsonb_build_array(c.id,c.company_id,c.property_id,c.agreement_id,c.agreement_version_id)
    into v_contract from public.contracts c where c.id::text=e.contract_id
      and c.company_id=p_company and c.property_id=e.property_id for share;
    if not found then raise exception 'EXPENSE_REVIEW_CONTRACT_SCOPE_INVALID' using errcode='42501'; end if;
  end if;

  with direct_links as (
    select b.id from public.journal_batches b where b.company_id=p_company and b.source_id=p_expense
      and b.source_type in ('expense','expenses','expense_update','expense_reversal')
    union
    select c.correction_journal_batch_id from public.s09_corrections c
      where c.company_id=p_company and c.source_type='expense' and c.source_id=p_expense
      and c.correction_journal_batch_id is not null
  ), links as (
    select d.id from direct_links d
    union
    select b.id from public.journal_batches b join direct_links d on b.reversal_of_batch_id=d.id
      where b.company_id=p_company and b.source_type='journal_reversal'
  )
  select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(
    b.id,b.status,b.source_type,b.source_id,b.event_id,b.effective_date,b.reversal_of_batch_id,
    l.id,l.account_id,l.debit,l.credit,l.deleted_at) order by b.id,l.id)::text,'[]'),'UTF8')),'hex')
  into v_postings from links x join public.journal_batches b on b.id=x.id and b.company_id=p_company
    left join public.journal_lines l on l.batch_id=b.id and l.company_id=b.company_id;

  return jsonb_build_object('version',1,'expense',jsonb_build_object(
    'id',e.id,'company_id',e.company_id,'property_id',e.property_id,'contract_id',e.contract_id,
    'cost_center_id',e.cost_center_id,'amount',e.amount,'expense_date',e.expense_date,
    'charged_to',e.charged_to,'category',e.category,'status',e.status,'deleted_at',e.deleted_at),
    'owners',v_owners,'contract',v_contract,'postings',v_postings);
end;
$function$;
revoke all on function app_private.expense_correction_source_snapshot(uuid,text) from public,anon,authenticated;
grant execute on function app_private.expense_correction_source_snapshot(uuid,text) to service_role;

create function app_private.require_expense_review_source(p_company uuid,p_review uuid,p_expense text)
returns jsonb language plpgsql set search_path to 'public','pg_temp'
as $function$
declare v_expected jsonb; v_actual jsonb;
begin
  select r.review_scope->'_expense_sources'->p_expense into v_expected
  from public.s08_frozen_reviews r where r.id=p_review and r.company_id=p_company and r.expense_source_snapshot_version=1;
  if v_expected is null then
    raise exception 'EXPENSE_REVIEW_SOURCE_REQUIRED: create a new review explicitly naming this expense.' using errcode='23514';
  end if;
  v_actual:=app_private.expense_correction_source_snapshot(p_company,p_expense);
  if v_actual is distinct from v_expected then
    raise exception 'EXPENSE_REVIEW_SOURCE_CHANGED: source, allocation or posting evidence changed; obtain a new source-scoped review.' using errcode='23514';
  end if;
  return v_expected;
end;
$function$;
revoke all on function app_private.require_expense_review_source(uuid,uuid,text) from public,anon,authenticated;
grant execute on function app_private.require_expense_review_source(uuid,uuid,text) to service_role;

do $patch$
declare r record; v_definition text;
begin
  for r in select * from (values
    ('public.s08_create_frozen_review(jsonb)',
     '  -- Compute fingerprint deterministically',
     $new$  -- Caller evidence cannot forge the server-owned financial source snapshot.
  declare v_sources jsonb:='{}'::jsonb; v_expense text;
  begin
    if jsonb_typeof(v_review_scope)<>'object' then raise exception 'S08_REVIEW_SCOPE_INVALID' using errcode='22023'; end if;
    if v_review_scope ? 'expense_ids' then
      if jsonb_typeof(v_review_scope->'expense_ids')<>'array' then raise exception 'S08_EXPENSE_SCOPE_INVALID' using errcode='22023'; end if;
      for v_expense in select distinct value from jsonb_array_elements_text(v_review_scope->'expense_ids') order by value loop
        v_sources:=v_sources||jsonb_build_object(v_expense,app_private.expense_correction_source_snapshot(v_company_id,v_expense));
      end loop;
    end if;
    v_review_scope:=(v_review_scope-'_expense_sources')||jsonb_build_object('_expense_sources',v_sources);
  end;

  -- Compute fingerprint deterministically$new$),
    ('public.s08_create_frozen_review(jsonb)',
     '    reviewer_decision, created_by',
     '    reviewer_decision, created_by, expense_source_snapshot_version'),
    ('public.s08_create_frozen_review(jsonb)',
     '    ''CREATED'', auth.uid()',
     '    ''CREATED'', auth.uid(), 1'),
    ('public.guard_s08_frozen_review_writes()',
     '    -- Lifecycle transitions enforcement',
     $new$    if old.created_by is distinct from new.created_by
       or old.review_scope is distinct from new.review_scope
       or old.expense_source_snapshot_version is distinct from new.expense_source_snapshot_version then
      raise exception 'S08_FROZEN_REVIEW_IMMUTABLE_FIELD: source review_scope cannot be changed' using errcode='42501';
    end if;
    -- Lifecycle transitions enforcement$new$),
    ('public.s08_approve_frozen_review(uuid,text)',
     '  -- Verify fingerprint still matches current dataset (no silent change under approval)',
     $new$  if coalesce(v_review.review_scope->'_expense_sources','{}'::jsonb)<>'{}'::jsonb
     and v_review.created_by is not distinct from auth.uid() then
    raise exception 'EXPENSE_REVIEW_INDEPENDENT_REVIEWER_REQUIRED' using errcode='42501';
  end if;
  declare v_expense text;
  begin
    for v_expense in select jsonb_object_keys(coalesce(v_review.review_scope->'_expense_sources','{}'::jsonb)) order by 1 loop
      perform app_private.require_expense_review_source(v_company_id,p_review_id,v_expense);
    end loop;
  end;
  -- Verify fingerprint still matches current dataset (no silent change under approval)$new$),
    ('public.s09_create_correction_draft(jsonb)',
     '  insert into public.s09_corrections (',
     $new$  if v_source_type='expense' then
    perform app_private.require_expense_review_source(v_company_id,v_review_id,v_source_id);
  end if;
  insert into public.s09_corrections ($new$),
    ('public.s09_validate_correction_invariants(uuid)',
     '  -- 2. company matches',
     $new$  if v_corr.source_type='expense' then
    perform app_private.require_expense_review_source(v_company_id,v_corr.review_id,v_corr.source_id);
  end if;
  -- 2. company matches$new$),
    ('public.s09_apply_correction(uuid)',
     '  if v_corr.accounting_period_id is not null then',
     $new$  if v_corr.source_type='expense' then
    v_effective_date:=(app_private.require_expense_review_source(v_company_id,v_corr.review_id,v_corr.source_id)->'expense'->>'expense_date')::date;
  elsif v_corr.accounting_period_id is not null then$new$)
  ) changes(signature,old_text,new_text)
  loop
    v_definition:=pg_get_functiondef(r.signature::regprocedure);
    if (length(v_definition)-length(replace(v_definition,r.old_text,'')))/length(r.old_text)<>1 then
      raise exception 'EXPENSE_CORRECTION_SOURCE_PRECONDITION: %',r.signature;
    end if;
    execute replace(v_definition,r.old_text,r.new_text);
  end loop;
end;
$patch$;
commit;
