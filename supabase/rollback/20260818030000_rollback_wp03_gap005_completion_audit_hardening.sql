-- Manual / emergency rollback for
-- 20260818030000_wp03_gap005_completion_audit_hardening.sql.
-- Restores the base (#1465) onboarding authority functions and removes the
-- added columns and the audit-events table. Production remains forward-only;
-- use a new forward migration in normal use.

begin;

-- Drop the append-only audit ledger and the added columns.
drop table if exists public.company_onboarding_events;

alter table public.company_onboarding_waivers
  drop column if exists revoked_at,
  drop column if exists revoked_by;

alter table public.onboarding_requirement_templates
  drop column if exists completion_source;

-- Restore base get_company_onboarding_state.
create or replace function public.get_company_onboarding_state()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_result  jsonb;
begin
  select jsonb_build_object(
    'company_id', v_company,
    'completed', exists (
      select 1 from public.company_onboarding_completion c
      where c.company_id = v_company
    ),
    'requirements', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'code', t.code,
          'label_ar', t.label_ar,
          'required', t.required,
          'waiver_policy', t.waiver_policy,
          'sort_order', t.sort_order,
          'waived', w.id is not null,
          'waiver_reason', w.waiver_reason,
          'waived_at', w.waived_at,
          'waiver_authority', w.waiver_authority,
          'evidence_reference', w.evidence_reference
        )
        order by t.sort_order
      )
      from public.onboarding_requirement_templates t
      left join public.company_onboarding_waivers w
        on w.requirement_code = t.code
       and w.company_id = v_company
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

-- Restore base waive_onboarding_requirement_atomic.
create or replace function public.waive_onboarding_requirement_atomic(
  p_code               text,
  p_reason             text,
  p_evidence_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company  uuid := public.require_company_id();
  v_actor    uuid := auth.uid();
  v_template public.onboarding_requirement_templates%rowtype;
  v_result   jsonb;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'ONBOARDING_WAIVER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select * into v_template
  from public.onboarding_requirement_templates
  where code = p_code;

  if not found then
    raise exception 'ONBOARDING_REQUIREMENT_UNKNOWN' using errcode = '22023';
  end if;

  if v_template.waiver_policy = 'NON_WAIVABLE' then
    raise exception 'ONBOARDING_REQUIREMENT_NON_WAIVABLE' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'ONBOARDING_WAIVER_REASON_REQUIRED' using errcode = '22023';
  end if;

  insert into public.company_onboarding_waivers (
    company_id, requirement_code, waived_by, waiver_reason,
    waiver_authority, evidence_reference
  ) values (
    v_company, v_template.code, v_actor, btrim(p_reason),
    coalesce(public.current_app_role(), 'ADMIN'), nullif(btrim(coalesce(p_evidence_reference, '')), '')
  )
  on conflict (company_id, requirement_code) do update
    set waived_by          = excluded.waived_by,
        waived_at          = now(),
        waiver_reason      = excluded.waiver_reason,
        waiver_authority   = excluded.waiver_authority,
        evidence_reference = excluded.evidence_reference
  returning to_jsonb(public.company_onboarding_waivers.*) into v_result;

  return v_result;
end;
$function$;

-- Restore base revoke_onboarding_waiver_atomic (destructive current-state delete).
create or replace function public.revoke_onboarding_waiver_atomic(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor   uuid := auth.uid();
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'ONBOARDING_WAIVER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  delete from public.company_onboarding_waivers
  where company_id = v_company
    and requirement_code = p_code;

  return jsonb_build_object('revoked', true, 'company_id', v_company, 'code', p_code);
end;
$function$;

-- Restore base complete_company_onboarding_atomic (no server-side gate check).
create or replace function public.complete_company_onboarding_atomic()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor   uuid := auth.uid();
  v_result  jsonb;
begin
  if v_actor is null then
    raise exception 'ONBOARDING_AUTH_REQUIRED' using errcode = '42501';
  end if;

  insert into public.company_onboarding_completion (company_id, completed_by)
  values (v_company, v_actor)
  on conflict (company_id) do update
    set completed_by = excluded.completed_by,
        completed_at = now()
  returning to_jsonb(public.company_onboarding_completion.*) into v_result;

  return v_result;
end;
$function$;

-- Restore base reset_company_onboarding_atomic (destructive current-state delete).
create or replace function public.reset_company_onboarding_atomic()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor   uuid := auth.uid();
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'ONBOARDING_WAIVER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  delete from public.company_onboarding_waivers where company_id = v_company;
  delete from public.company_onboarding_completion where company_id = v_company;

  return jsonb_build_object('reset', true, 'company_id', v_company);
end;
$function$;

revoke all on function public.get_company_onboarding_state() from public, anon;
grant execute on function public.get_company_onboarding_state() to authenticated, service_role;

revoke all on function public.waive_onboarding_requirement_atomic(text, text, text) from public, anon;
grant execute on function public.waive_onboarding_requirement_atomic(text, text, text) to authenticated, service_role;

revoke all on function public.revoke_onboarding_waiver_atomic(text) from public, anon;
grant execute on function public.revoke_onboarding_waiver_atomic(text) to authenticated, service_role;

revoke all on function public.complete_company_onboarding_atomic() from public, anon;
grant execute on function public.complete_company_onboarding_atomic() to authenticated, service_role;

revoke all on function public.reset_company_onboarding_atomic() from public, anon;
grant execute on function public.reset_company_onboarding_atomic() to authenticated, service_role;

commit;
