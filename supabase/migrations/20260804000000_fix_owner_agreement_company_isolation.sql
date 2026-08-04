-- FA-004: enforce company isolation inside update_owner_agreement_atomic.
-- This is a forward-only replacement of the active signature from
-- 20260722000002_multi_tenant_rpc_company_isolation.sql.  RLS is not the
-- security boundary for this SECURITY DEFINER RPC: every target read and
-- write is scoped to the caller's company here.

begin;

create or replace function public.update_owner_agreement_atomic(
  p_agreement_id uuid,
  payload jsonb
)
returns public.owner_agreements
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_company_id uuid;
  v_row public.owner_agreements%rowtype;
  v_old public.owner_agreements%rowtype;
  v_commission_value numeric;
  v_starts_on date;
  v_ends_on date;
  v_changed_fields jsonb := '{}'::jsonb;
  v_updated_count integer := 0;
begin
  if v_actor_id is null or not public.is_admin_or_manager() then
    raise exception 'غير مصرح: يحتاج هذا الإجراء صلاحية مدير أو مشرف.'
      using errcode = '42501';
  end if;

  -- The company is derived from the trusted JWT context.  A missing context
  -- fails before the agreement UUID is read, so it cannot be used as an
  -- existence oracle.
  v_company_id := public.require_company_id();

  -- Deliberately use the same not-found error for an unknown UUID and a UUID
  -- belonging to another company.  The row lock also serializes concurrent
  -- updates to the same in-company agreement.
  select oa.*
    into v_old
    from public.owner_agreements as oa
   where oa.id = p_agreement_id
     and oa.company_id = v_company_id
   for update;

  if not found then
    raise exception 'AGREEMENT_NOT_FOUND_OR_FORBIDDEN'
      using errcode = '42501';
  end if;

  -- Relationship columns are not part of the supported update contract.  If
  -- an old/new client sends them, reject a change rather than permitting a
  -- cross-company rebind.  This does not reveal the requested row.
  if payload ? 'company_id'
     and nullif(payload->>'company_id', '') is distinct from v_old.company_id::text then
    raise exception 'AGREEMENT_RELATIONSHIP_IMMUTABLE'
      using errcode = '42501';
  end if;
  if payload ? 'owner_id'
     and nullif(payload->>'owner_id', '')::uuid is distinct from v_old.owner_id then
    raise exception 'AGREEMENT_RELATIONSHIP_IMMUTABLE'
      using errcode = '42501';
  end if;
  if payload ? 'property_id'
     and nullif(payload->>'property_id', '') is distinct from v_old.property_id::text then
    raise exception 'AGREEMENT_RELATIONSHIP_IMMUTABLE'
      using errcode = '42501';
  end if;

  -- Validate the existing relationships as well as the requested row.  The
  -- update path never infers a company from owner_id or property_id.
  if not exists (
    select 1
      from public.owners as o
     where o.id = v_old.owner_id
       and o.company_id = v_company_id
       and o.deleted_at is null
  ) or not exists (
    select 1
      from public.properties as p
     where p.id::text = v_old.property_id::text
       and p.company_id = v_company_id
       and p.deleted_at is null
  ) then
    raise exception 'AGREEMENT_RELATIONSHIP_IMMUTABLE'
      using errcode = '42501';
  end if;

  -- Parse and validate before UPDATE.  PostgreSQL numeric accepts NaN, so it
  -- is rejected explicitly; table constraints remain the final backstop.
  if payload ? 'commission_type' then
    if nullif(btrim(payload->>'commission_type'), '') is null
       or payload->>'commission_type' not in ('RATE', 'FIXED_MONTHLY') then
      raise exception 'نوع العمولة غير مدعوم' using errcode = '22023';
    end if;
  end if;

  if payload ? 'commission_value'
     and nullif(btrim(payload->>'commission_value'), '') is null then
    raise exception 'قيمة العمولة مطلوبة عند إرسال commission_value'
      using errcode = '22023';
  end if;

  v_commission_value := case
    when payload ? 'commission_value' then (payload->>'commission_value')::numeric
    else v_old.commission_value
  end;
  if v_commission_value::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'قيمة العمولة غير صالحة' using errcode = '22023';
  end if;

  if coalesce(nullif(payload->>'commission_type', ''), v_old.commission_type) = 'RATE'
     and (v_commission_value < 0 or v_commission_value > 100) then
    raise exception 'نسبة العمولة يجب أن تكون بين 0 و100 عند نوع RATE'
      using errcode = '22023';
  end if;
  if coalesce(nullif(payload->>'commission_type', ''), v_old.commission_type) = 'FIXED_MONTHLY'
     and v_commission_value < 0 then
    raise exception 'قيمة العمولة الثابتة لا يمكن أن تكون سالبة'
      using errcode = '22023';
  end if;

  v_starts_on := case
    when payload ? 'starts_on' then (payload->>'starts_on')::date
    else v_old.starts_on
  end;
  v_ends_on := case
    when payload ? 'ends_on' then nullif(payload->>'ends_on', '')::date
    else v_old.ends_on
  end;
  if v_starts_on is null or (v_ends_on is not null and v_ends_on < v_starts_on) then
    raise exception 'فترة الاتفاقية غير صحيحة' using errcode = '22023';
  end if;

  update public.owner_agreements as oa
     set agreement_type = coalesce(nullif(payload->>'agreement_type', ''), oa.agreement_type),
         commission_type = coalesce(nullif(payload->>'commission_type', ''), oa.commission_type),
         commission_value = case when payload ? 'commission_value' then v_commission_value else oa.commission_value end,
         starts_on = v_starts_on,
         ends_on = v_ends_on,
         notes = case when payload ? 'notes' then nullif(payload->>'notes', '') else oa.notes end,
         updated_at = now()
   where oa.id = p_agreement_id
     and oa.company_id = v_company_id
   returning oa.* into v_row;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 or not found then
    raise exception 'AGREEMENT_NOT_FOUND_OR_FORBIDDEN'
      using errcode = '42501';
  end if;

  -- Audit only the in-company row and only changed, non-secret fields.  The
  -- company is included in details because audit_log has no company_id column.
  if v_old is distinct from v_row then
    if v_old.agreement_type is distinct from v_row.agreement_type then
      v_changed_fields := v_changed_fields || jsonb_build_object('agreement_type', jsonb_build_object('old', v_old.agreement_type, 'new', v_row.agreement_type));
    end if;
    if v_old.commission_type is distinct from v_row.commission_type then
      v_changed_fields := v_changed_fields || jsonb_build_object('commission_type', jsonb_build_object('old', v_old.commission_type, 'new', v_row.commission_type));
    end if;
    if v_old.commission_value is distinct from v_row.commission_value then
      v_changed_fields := v_changed_fields || jsonb_build_object('commission_value', jsonb_build_object('old', v_old.commission_value, 'new', v_row.commission_value));
    end if;
    if v_old.starts_on is distinct from v_row.starts_on then
      v_changed_fields := v_changed_fields || jsonb_build_object('starts_on', jsonb_build_object('old', v_old.starts_on, 'new', v_row.starts_on));
    end if;
    if v_old.ends_on is distinct from v_row.ends_on then
      v_changed_fields := v_changed_fields || jsonb_build_object('ends_on', jsonb_build_object('old', v_old.ends_on, 'new', v_row.ends_on));
    end if;
    if v_old.notes is distinct from v_row.notes then
      v_changed_fields := v_changed_fields || jsonb_build_object('notes', jsonb_build_object('old', v_old.notes, 'new', v_row.notes));
    end if;

    insert into public.audit_log (
      id, ts, user_id, username, action, entity, entity_id, note, "table",
      details, action_timestamp, created_at
    ) values (
      gen_random_uuid()::text,
      extract(epoch from now())::bigint,
      v_actor_id,
      v_actor_id::text,
      'UPDATE',
      'owner_agreement',
      v_row.id::text,
      'Owner agreement updated within the caller company.',
      'owner_agreements',
      jsonb_build_object(
        'company_id', v_company_id,
        'agreement_id', v_row.id,
        'actor_id', v_actor_id,
        'changed_fields', v_changed_fields,
        'timestamp', now()
      )::text,
      now(),
      now()
    );
  end if;

  return v_row;
end;
$function$;

alter function public.update_owner_agreement_atomic(uuid, jsonb) owner to postgres;
revoke all on function public.update_owner_agreement_atomic(uuid, jsonb) from public, anon;
grant execute on function public.update_owner_agreement_atomic(uuid, jsonb) to authenticated, service_role;

comment on function public.update_owner_agreement_atomic(uuid, jsonb)
is 'FA-004: company isolation is enforced inside this SECURITY DEFINER RPC; agreement reads and writes require the caller company.';

commit;
