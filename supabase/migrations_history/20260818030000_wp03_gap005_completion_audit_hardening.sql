-- WP-03 / GAP-005 (hardening): authoritative completion + durable audit history.
-- Canonical rules: OPS-004, DOM-010, SEC-003.
--
-- Closes three decision-free defects in the merged #1465 onboarding authority:
--
--   1. COMPLETION AUTHORITY: complete_company_onboarding_atomic() previously
--      recorded completion without proving the required gates were satisfied —
--      a caller could complete onboarding merely by invoking the RPC. Now the
--      server derives/validates each required requirement before recording
--      completion: a NON_WAIVABLE identity/authority gate requires its
--      underlying data to exist; an ADMIN_WAIVABLE gate requires either the
--      data to exist or a valid, active, admin-authorized waiver. Incomplete
--      onboarding cannot be marked complete.
--
--   2. AUDIT HISTORY (OPS-004 "auditable" / DOM-010): waiver grant/change,
--      revoke and reset used destructive current-state patterns (DELETE /
--      ON CONFLICT DO UPDATE) that destroyed the only record of the prior
--      decision. This migration preserves durable evidence: waiver revoke now
--      marks the waiver revoked (actor + time) instead of deleting it, and an
--      append-only company_onboarding_events ledger records every WAIVE /
--      REVOKE / COMPLETE / RESET with company, requirement, actor, time,
--      authority, reason and evidence reference.
--
--   3. DP-5 stays open: the exact canonical seven-step enumeration and any
--      property-level safety-evidence model remain a product decision. The
--      framework stays company-scoped and extensible (requirement templates
--      drive both the catalog and, via completion_source, the server-side
--      existence check), so an authorized future seven-step catalog can be
--      introduced additively without a destructive redesign.
--
-- Rollback: supabase/rollback/20260818030000_rollback_wp03_gap005_completion_audit_hardening.sql

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Data-driven completion-source mapping on the requirement templates.
--    A template's completion_source selects the server-side existence check
--    used to prove a NON_WAIVABLE gate (or the underlying data of an
--    ADMIN_WAIVABLE gate) is actually satisfied. 'NONE' means the step has no
--    data requirement (always satisfied by itself).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.onboarding_requirement_templates
  add column if not exists completion_source text
    check (completion_source is null or completion_source in
      ('NONE','OWNER_EXISTS','PROPERTY_EXISTS','UNIT_EXISTS','CONTRACT_EXISTS','INVOICE_EXISTS'));

update public.onboarding_requirement_templates set completion_source = 'OWNER_EXISTS'    where code = 'owner';
update public.onboarding_requirement_templates set completion_source = 'PROPERTY_EXISTS' where code = 'property';
update public.onboarding_requirement_templates set completion_source = 'UNIT_EXISTS'     where code = 'unit';
update public.onboarding_requirement_templates set completion_source = 'CONTRACT_EXISTS' where code = 'contract';
update public.onboarding_requirement_templates set completion_source = 'INVOICE_EXISTS'  where code = 'invoice';
update public.onboarding_requirement_templates set completion_source = 'NONE'
  where completion_source is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Waiver revocation columns: revoke marks the waiver (history preserved)
--    instead of deleting it.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.company_onboarding_waivers
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid;

comment on column public.company_onboarding_waivers.revoked_at is
  'GAP-005: when set, the waiver has been revoked; the grant record is retained for audit rather than deleted.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Append-only audit ledger for onboarding decisions.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.company_onboarding_events (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id),
  requirement_code   text references public.onboarding_requirement_templates(code),
  action             text not null check (action in ('WAIVE','REVOKE','COMPLETE','RESET')),
  actor              uuid not null,
  acted_at           timestamptz not null default now(),
  authority          text,
  reason             text,
  evidence_reference text
);

comment on table public.company_onboarding_events is
  'GAP-005: append-only audit ledger. Never UPDATE/DELETE; every waiver grant/change/revoke and every completion/reset leaves durable evidence.';

alter table public.company_onboarding_events enable row level security;

drop policy if exists onboarding_events_company_read on public.company_onboarding_events;
create policy onboarding_events_company_read on public.company_onboarding_events
  for select to authenticated
  using (company_id = public.current_company_id());

revoke all on table public.company_onboarding_events from public, anon, authenticated;
grant select on table public.company_onboarding_events to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. get_company_onboarding_state — a waiver is "waived" only while effective
--    (not revoked); revocation history is surfaced.
-- ─────────────────────────────────────────────────────────────────────────────
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
          'completion_source', t.completion_source,
          'waived', (w.id is not null and w.revoked_at is null),
          'waiver_reason', case when w.id is not null and w.revoked_at is null then w.waiver_reason end,
          'waived_at', case when w.id is not null and w.revoked_at is null then w.waived_at end,
          'waiver_authority', case when w.id is not null and w.revoked_at is null then w.waiver_authority end,
          'evidence_reference', case when w.id is not null and w.revoked_at is null then w.evidence_reference end,
          'revoked', (w.id is not null and w.revoked_at is not null),
          'revoked_at', w.revoked_at
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. waive_onboarding_requirement_atomic — records a WAIVE event; re-waiving an
--    existing (possibly revoked) waiver reactivates it with fresh evidence.
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_authority text := coalesce(public.current_app_role(), 'ADMIN');
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
    v_authority, nullif(btrim(coalesce(p_evidence_reference, '')), '')
  )
  on conflict (company_id, requirement_code) do update
    set waived_by          = excluded.waived_by,
        waived_at          = now(),
        waiver_reason      = excluded.waiver_reason,
        waiver_authority   = excluded.waiver_authority,
        evidence_reference = excluded.evidence_reference,
        revoked_at         = null,
        revoked_by         = null
  returning to_jsonb(public.company_onboarding_waivers.*) into v_result;

  insert into public.company_onboarding_events (
    company_id, requirement_code, action, actor, authority, reason, evidence_reference
  ) values (
    v_company, v_template.code, 'WAIVE', v_actor, v_authority,
    btrim(p_reason), nullif(btrim(coalesce(p_evidence_reference, '')), '')
  );

  return v_result;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. revoke_onboarding_waiver_atomic — marks the waiver revoked (audit
--    preserved) and records a REVOKE event. Never deletes the grant history.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.revoke_onboarding_waiver_atomic(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor   uuid := auth.uid();
  v_authority text := coalesce(public.current_app_role(), 'ADMIN');
  v_updated integer;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'ONBOARDING_WAIVER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  update public.company_onboarding_waivers
  set revoked_at = now(),
      revoked_by = v_actor
  where company_id = v_company
    and requirement_code = p_code
    and revoked_at is null;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'ONBOARDING_WAIVER_NOT_ACTIVE' using errcode = '22023';
  end if;

  insert into public.company_onboarding_events (
    company_id, requirement_code, action, actor, authority
  ) values (
    v_company, p_code, 'REVOKE', v_actor, v_authority
  );

  return jsonb_build_object('revoked', true, 'company_id', v_company, 'code', p_code);
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. complete_company_onboarding_atomic — completion is server-derived: every
--    required requirement must be satisfied (data present, or a valid active
--    waiver for ADMIN_WAIVABLE gates). A caller cannot complete onboarding by
--    merely invoking the RPC.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.complete_company_onboarding_atomic()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor   uuid := auth.uid();
  v_authority text := coalesce(public.current_app_role(), 'ADMIN');
  v_t       public.onboarding_requirement_templates%rowtype;
  v_data_ok boolean;
  v_result  jsonb;
begin
  if v_actor is null or not public.is_admin_or_manager() then
    raise exception 'ONBOARDING_COMPLETE_FORBIDDEN' using errcode = '42501';
  end if;

  -- Server-derived gate evaluation: every required requirement must be
  -- satisfied. NON_WAIVABLE gates require the underlying data; ADMIN_WAIVABLE
  -- gates require data OR a valid (non-revoked) admin waiver.
  for v_t in
    select * from public.onboarding_requirement_templates
    where required
    order by sort_order
  loop
    v_data_ok := case v_t.completion_source
      when 'OWNER_EXISTS'    then exists (select 1 from public.owners o    where o.company_id = v_company)
      when 'PROPERTY_EXISTS' then exists (select 1 from public.properties p where p.company_id = v_company)
      when 'UNIT_EXISTS'     then exists (select 1 from public.units u     where u.company_id = v_company)
      when 'CONTRACT_EXISTS' then exists (select 1 from public.contracts c where c.company_id = v_company and c.deleted_at is null)
      when 'INVOICE_EXISTS'  then exists (select 1 from public.invoices i  where i.company_id = v_company)
      else true
    end;

    if not v_data_ok then
      if v_t.waiver_policy = 'ADMIN_WAIVABLE' and exists (
        select 1 from public.company_onboarding_waivers w
        where w.company_id = v_company
          and w.requirement_code = v_t.code
          and w.revoked_at is null
      ) then
        v_data_ok := true;
      end if;
    end if;

    if not v_data_ok then
      raise exception 'ONBOARDING_INCOMPLETE_REQUIREMENT'
        using errcode = '23514', detail = v_t.code;
    end if;
  end loop;

  insert into public.company_onboarding_completion (company_id, completed_by)
  values (v_company, v_actor)
  on conflict (company_id) do update
    set completed_by = excluded.completed_by,
        completed_at = now()
  returning to_jsonb(public.company_onboarding_completion.*) into v_result;

  insert into public.company_onboarding_events (
    company_id, requirement_code, action, actor, authority
  ) values (
    v_company, null, 'COMPLETE', v_actor, v_authority
  );

  return v_result;
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. reset_company_onboarding_atomic — revokes all waivers (history preserved)
--    and clears completion, recording a RESET event; never deletes waiver
--    history.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reset_company_onboarding_atomic()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company  uuid := public.require_company_id();
  v_actor    uuid := auth.uid();
  v_authority text := coalesce(public.current_app_role(), 'ADMIN');
  v_waived_count integer;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'ONBOARDING_WAIVER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  -- Mark every effective waiver revoked (do not delete the grant history).
  update public.company_onboarding_waivers
  set revoked_at = coalesce(revoked_at, now()),
      revoked_by = coalesce(revoked_by, v_actor)
  where company_id = v_company;

  get diagnostics v_waived_count = row_count;

  -- Clear the completion fact; the RESET event preserves the audit trail.
  delete from public.company_onboarding_completion where company_id = v_company;

  insert into public.company_onboarding_events (
    company_id, requirement_code, action, actor, authority
  ) values (
    v_company, null, 'RESET', v_actor, v_authority
  );

  return jsonb_build_object('reset', true, 'company_id', v_company, 'waivers_revoked', v_waived_count);
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Grants: authenticated callers only; never anon/public.
-- ─────────────────────────────────────────────────────────────────────────────
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
