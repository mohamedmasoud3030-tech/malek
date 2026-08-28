-- Short Stay checkout is date-driven, not a hotel workflow.
--
-- `end_date` is the checkout date for a short stay. Once that date is reached,
-- an ACTIVE short stay is operationally expired. The office read seams call
-- this deterministic reconciliation before returning contracts/units, so the
-- product cannot keep showing yesterday's occupancy merely because no manual
-- "checkout" button was pressed.
--
-- This command is intentionally narrow:
--   * current company only;
--   * short_stay + ACTIVE only;
--   * end_date <= current_date only;
--   * unit returns to AVAILABLE only when it is currently OCCUPIED and no
--     other active contract covers today;
--   * maintenance/reserved unit states are never overwritten;
--   * idempotent and auditable.

begin;

create or replace function public.reconcile_due_short_stays_atomic()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor uuid := auth.uid();
  v_contract_count integer := 0;
  v_unit_count integer := 0;
  v_unit_ids uuid[] := array[]::uuid[];
begin
  if v_actor is null
     or not public.is_company_member(v_company, v_actor)
     or not public.current_user_has_effective_app_permission('contracts.view') then
    raise exception 'CONTRACT_VIEW_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  -- Serialize one company reconciliation at a time; repeated reads stay cheap
  -- and deterministic instead of racing each other.
  perform pg_advisory_xact_lock(hashtextextended('short_stay_expiry:' || v_company::text, 0));

  with due as (
    select c.id, c.unit_id
    from public.contracts c
    where c.company_id = v_company
      and c.deleted_at is null
      and coalesce(lower(c.lease_mode), 'long_term') = 'short_stay'
      and lower(c.status::text) = 'active'
      and c.end_date <= current_date
    for update
  ), expired as (
    update public.contracts c
       set status = 'expired',
           updated_at = now()
      from due d
     where c.id = d.id
    returning c.unit_id
  )
  select count(*), coalesce(array_agg(distinct unit_id) filter (where unit_id is not null), array[]::uuid[])
    into v_contract_count, v_unit_ids
  from expired;

  if v_contract_count > 0 and cardinality(v_unit_ids) > 0 then
    update public.units u
       set status = 'available',
           updated_at = now()
     where u.company_id = v_company
       and u.id = any(v_unit_ids)
       and lower(u.status::text) in ('occupied', 'rented')
       and u.deleted_at is null
       and not exists (
         select 1
         from public.contracts other_contract
         where other_contract.company_id = v_company
           and other_contract.unit_id = u.id
           and other_contract.deleted_at is null
           and lower(other_contract.status::text) = 'active'
           and other_contract.start_date <= current_date
           and other_contract.end_date > current_date
       );
    get diagnostics v_unit_count = row_count;

    insert into public.audit_log (
      id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
    ) values (
      gen_random_uuid()::text,
      extract(epoch from now())::bigint,
      v_actor,
      (select email from auth.users where id = v_actor),
      'AUTO_EXPIRE_SHORT_STAY',
      'contracts',
      'batch',
      format('Expired %s short-stay contracts at checkout date; released %s units', v_contract_count, v_unit_count),
      'contracts',
      jsonb_build_object(
        'expired_contracts', v_contract_count,
        'released_units', v_unit_count,
        'as_of', current_date
      )::text,
      now()
    );
  end if;

  return jsonb_build_object(
    'status', 'reconciled',
    'expired_contracts', v_contract_count,
    'released_units', v_unit_count,
    'as_of', current_date
  );
end;
$function$;

revoke all on function public.reconcile_due_short_stays_atomic() from public, anon;
grant execute on function public.reconcile_due_short_stays_atomic() to authenticated;

commit;
