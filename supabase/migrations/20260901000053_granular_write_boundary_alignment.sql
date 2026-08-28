-- Granular write-boundary alignment.
--
-- 00050 split broad Employee writes into create/edit/approve/cancel/archive
-- capabilities. This follow-up closes the server-side gaps exposed by that
-- split:
--   * property/unit archive is a soft-delete UPDATE, not a SQL DELETE;
--   * contract writes are canonical RPC commands and must not be reachable as
--     raw PostgREST INSERT/UPDATE/DELETE operations;
--   * maintenance creation and lifecycle deletion are command paths, while
--     ordinary non-status maintenance edits remain table updates; the existing
--     maintenance status trigger continues to protect lifecycle transitions.
--
-- This migration does not change business outcomes. It makes RLS/trigger
-- enforcement match the action permissions already exposed by the product.

begin;

-- ---------------------------------------------------------------------------
-- Properties / units: edit and archive share SQL UPDATE at the RLS layer, then
-- a column-aware trigger requires the exact action permission. Hard DELETE is
-- never an archive operation and is denied to browser roles.
-- ---------------------------------------------------------------------------

do $property_unit_update_policies$
declare
  v_table text;
  v_name text;
begin
  foreach v_table in array array['properties','units'] loop
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;

    v_name := 'p50_' || v_table || '_action_update';
    execute format('drop policy if exists %I on public.%I', v_name, v_table);
    execute format(
      'create policy %I on public.%I for update to authenticated using (company_id=public.require_company_id() and (public.current_user_has_effective_app_permission(''properties.edit'') or public.current_user_has_effective_app_permission(''properties.archive''))) with check (company_id=public.require_company_id() and (public.current_user_has_effective_app_permission(''properties.edit'') or public.current_user_has_effective_app_permission(''properties.archive'')))',
      v_name, v_table
    );

    v_name := 'p50_' || v_table || '_action_update_guard';
    execute format('drop policy if exists %I on public.%I', v_name, v_table);
    execute format(
      'create policy %I on public.%I as restrictive for update to authenticated using (company_id=public.require_company_id() and (public.current_user_has_effective_app_permission(''properties.edit'') or public.current_user_has_effective_app_permission(''properties.archive''))) with check (company_id=public.require_company_id() and (public.current_user_has_effective_app_permission(''properties.edit'') or public.current_user_has_effective_app_permission(''properties.archive'')))',
      v_name, v_table
    );

    v_name := 'p53_' || v_table || '_no_hard_delete';
    execute format('drop policy if exists %I on public.%I', v_name, v_table);
    execute format(
      'create policy %I on public.%I as restrictive for delete to authenticated using (false)',
      v_name, v_table
    );
  end loop;
end
$property_unit_update_policies$;

-- Internal trigger helper: keep it out of the public RPC/type contract.
create or replace function app_private.guard_property_unit_granular_update()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_archive_change boolean;
  v_other_change boolean;
begin
  -- Migration/service contexts without a user JWT are trusted infrastructure.
  -- Browser requests always carry auth.uid() and therefore pass the exact
  -- capability checks below. SECURITY DEFINER is required so archival
  -- dependency checks cannot be hidden by the caller's RLS visibility.
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id or new.company_id is distinct from old.company_id then
    raise exception 'PROPERTY_IDENTITY_IMMUTABLE' using errcode='42501';
  end if;

  v_archive_change := new.deleted_at is distinct from old.deleted_at;
  v_other_change :=
    (to_jsonb(new) - 'deleted_at' - 'updated_at')
      is distinct from
    (to_jsonb(old) - 'deleted_at' - 'updated_at');

  if v_archive_change
     and not public.current_user_has_effective_app_permission('properties.archive') then
    raise exception 'PROPERTY_ARCHIVE_PERMISSION_REQUIRED' using errcode='42501';
  end if;

  if v_other_change
     and not public.current_user_has_effective_app_permission('properties.edit') then
    raise exception 'PROPERTY_EDIT_PERMISSION_REQUIRED' using errcode='42501';
  end if;

  -- Enforce the existing archive preconditions at the trusted boundary. The
  -- frontend performs the same checks for UX, but it is never authorization or
  -- integrity evidence.
  if old.deleted_at is null and new.deleted_at is not null then
    if tg_table_name = 'properties' then
      if exists (
        select 1 from public.units u
        where u.company_id=old.company_id and u.property_id=old.id and u.deleted_at is null
      ) then
        raise exception 'PROPERTY_ARCHIVE_ACTIVE_UNITS' using errcode='23514';
      end if;
      if exists (
        select 1 from public.owner_agreements oa
        where oa.company_id=old.company_id and oa.property_id=old.id
      ) then
        raise exception 'PROPERTY_ARCHIVE_OWNER_AGREEMENT' using errcode='23514';
      end if;
      if exists (
        select 1 from public.maintenance_records m
        where m.company_id=old.company_id and m.property_id=old.id
          and m.deleted_at is null and lower(coalesce(m.status,'')) in ('open','in_progress')
      ) then
        raise exception 'PROPERTY_ARCHIVE_OPEN_MAINTENANCE' using errcode='23514';
      end if;
      if exists (
        select 1 from public.contracts c
        where c.company_id=old.company_id and c.property_id=old.id
          and c.deleted_at is null and lower(coalesce(c.status,'')) in ('active','draft')
      ) then
        raise exception 'PROPERTY_ARCHIVE_ACTIVE_CONTRACT' using errcode='23514';
      end if;
    elsif tg_table_name = 'units' then
      if exists (
        select 1 from public.contracts c
        where c.company_id=old.company_id and c.unit_id=old.id
      ) then
        raise exception 'UNIT_ARCHIVE_CONTRACT_HISTORY' using errcode='23514';
      end if;
      if exists (
        select 1 from public.maintenance_records m
        where m.company_id=old.company_id and m.unit_id=old.id
          and m.deleted_at is null and lower(coalesce(m.status,'')) in ('open','in_progress')
      ) then
        raise exception 'UNIT_ARCHIVE_OPEN_MAINTENANCE' using errcode='23514';
      end if;
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function app_private.guard_property_unit_granular_update() from public, anon, authenticated;

do $property_unit_triggers$
declare
  v_table text;
  v_trigger text;
begin
  foreach v_table in array array['properties','units'] loop
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;
    v_trigger := 'trg_' || v_table || '_granular_update_guard';
    execute format('drop trigger if exists %I on public.%I', v_trigger, v_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function app_private.guard_property_unit_granular_update()',
      v_trigger, v_table
    );
  end loop;
end
$property_unit_triggers$;

-- ---------------------------------------------------------------------------
-- Contracts: the application contract already requires every write to use an
-- atomic SECURITY DEFININER command. A restrictive false policy makes that true
-- at the database boundary as well; table-owner SECURITY DEFINER commands
-- bypass RLS, ordinary authenticated PostgREST writes do not.
-- ---------------------------------------------------------------------------

do $contract_rpc_only$
declare
  v_action text;
  v_name text;
begin
  if to_regclass('public.contracts') is not null then
    foreach v_action in array array['insert','update','delete'] loop
      v_name := 'p53_contracts_rpc_only_' || v_action;
      execute format('drop policy if exists %I on public.contracts', v_name);
      if v_action = 'insert' then
        execute format(
          'create policy %I on public.contracts as restrictive for insert to authenticated with check (false)',
          v_name
        );
      elsif v_action = 'update' then
        execute format(
          'create policy %I on public.contracts as restrictive for update to authenticated using (false) with check (false)',
          v_name
        );
      else
        execute format(
          'create policy %I on public.contracts as restrictive for delete to authenticated using (false)',
          v_name
        );
      end if;
    end loop;
  end if;
end
$contract_rpc_only$;

-- ---------------------------------------------------------------------------
-- Maintenance: creation is create_maintenance_atomic; cancellation/closure are
-- lifecycle commands. Ordinary metadata edits remain direct UPDATEs and the
-- pre-existing guard_maintenance_status_transition trigger blocks raw status
-- mutation independently of this policy layer.
-- ---------------------------------------------------------------------------

do $maintenance_command_boundaries$
declare
  v_name text;
begin
  if to_regclass('public.maintenance_records') is not null then
    v_name := 'p53_maintenance_rpc_only_insert';
    execute format('drop policy if exists %I on public.maintenance_records', v_name);
    execute format(
      'create policy %I on public.maintenance_records as restrictive for insert to authenticated with check (false)',
      v_name
    );

    v_name := 'p53_maintenance_no_hard_delete';
    execute format('drop policy if exists %I on public.maintenance_records', v_name);
    execute format(
      'create policy %I on public.maintenance_records as restrictive for delete to authenticated using (false)',
      v_name
    );
  end if;
end
$maintenance_command_boundaries$;

notify pgrst,'reload schema';
commit;
