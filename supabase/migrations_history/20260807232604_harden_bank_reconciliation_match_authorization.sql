-- Live hardening parity: bank reconciliation matching must enforce server-side
-- role authorization, active-company isolation, and full-line amount integrity.
begin;

create or replace function public.process_bank_reconciliation_match_atomic(payload jsonb)
returns public.bank_reconciliation_matches
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
  v_statement_line_id uuid := nullif(payload->>'statement_line_id', '')::uuid;
  v_matched_entity_type text := nullif(payload->>'matched_entity_type', '');
  v_matched_entity_id text := nullif(payload->>'matched_entity_id', '');
  v_matched_amount numeric := nullif(payload->>'matched_amount', '')::numeric;
  v_notes text := nullif(payload->>'notes', '');
  v_line public.bank_statement_lines%rowtype;
  v_match public.bank_reconciliation_matches%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;

  if not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'Bank reconciliation matching requires ADMIN or MANAGER.' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if v_statement_line_id is null then
    raise exception 'statement_line_id is required.' using errcode = '22023';
  end if;
  if v_matched_entity_type not in ('payment', 'receipt', 'expense', 'manual_adjustment') then
    raise exception 'Invalid matched_entity_type.' using errcode = '22023';
  end if;
  if v_matched_entity_id is null then
    raise exception 'matched_entity_id is required.' using errcode = '22023';
  end if;
  if v_matched_amount is null or v_matched_amount = 0 then
    raise exception 'matched_amount must be non-zero.' using errcode = '22023';
  end if;

  select * into v_line
  from public.bank_statement_lines
  where id = v_statement_line_id
    and company_id = v_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Bank statement line was not found.' using errcode = 'P0002';
  end if;
  if lower(coalesce(v_line.status, '')) <> 'unmatched' then
    raise exception 'Bank statement line is already processed.' using errcode = '23514';
  end if;

  if v_matched_amount <> v_line.amount then
    raise exception 'matched_amount must equal the bank statement line amount.' using errcode = '23514';
  end if;

  if v_matched_entity_type = 'payment' then
    if not exists (
      select 1 from public.payments p
      where p.id::text = v_matched_entity_id
        and p.company_id = v_company_id
        and p.deleted_at is null
    ) then
      raise exception 'Matched payment was not found in the active company.' using errcode = 'P0002';
    end if;
  elsif v_matched_entity_type = 'receipt' then
    if not exists (
      select 1 from public.receipts r
      where r.id::text = v_matched_entity_id
        and r.company_id = v_company_id
        and r.deleted_at is null
    ) then
      raise exception 'Matched receipt was not found in the active company.' using errcode = 'P0002';
    end if;
  elsif v_matched_entity_type = 'expense' then
    if not exists (
      select 1 from public.expenses e
      where e.id::text = v_matched_entity_id
        and e.company_id = v_company_id
        and e.deleted_at is null
    ) then
      raise exception 'Matched expense was not found in the active company.' using errcode = 'P0002';
    end if;
  end if;

  insert into public.bank_reconciliation_matches (
    statement_line_id,
    matched_entity_type,
    matched_entity_id,
    matched_amount,
    notes,
    matched_by,
    company_id
  ) values (
    v_statement_line_id,
    v_matched_entity_type,
    v_matched_entity_id,
    v_matched_amount,
    v_notes,
    auth.uid(),
    v_company_id
  )
  returning * into v_match;

  update public.bank_statement_lines
  set status = 'matched', updated_at = now()
  where id = v_statement_line_id
    and company_id = v_company_id;

  insert into public.audit_log (
    id, user_id, action, entity, entity_id, note, "table",
    old_value, new_value, action_timestamp, created_at, updated_at,
    company_id
  ) values (
    gen_random_uuid()::text,
    auth.uid(),
    'PROCESS_BANK_RECONCILIATION_MATCH_ATOMIC',
    'bank_reconciliation_match',
    v_match.id::text,
    'Bank statement line matched atomically through RPC.',
    'bank_reconciliation_matches',
    to_jsonb(v_line),
    jsonb_build_object('match', to_jsonb(v_match), 'statement_line_status', 'matched'),
    now(), now(), now(),
    v_company_id
  );

  return v_match;
end;
$function$;

revoke all on function public.process_bank_reconciliation_match_atomic(jsonb) from public, anon;
grant execute on function public.process_bank_reconciliation_match_atomic(jsonb) to authenticated, service_role;

commit;
