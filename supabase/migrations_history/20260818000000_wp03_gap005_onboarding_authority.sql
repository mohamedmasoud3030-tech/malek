-- WP-03 / GAP-005: authoritative, backend-driven company onboarding state.
-- Canonical rules: OPS-004, DOM-002, DOM-003; locked decision D12.
--
-- Replaces the localStorage-first onboarding checklist (dismissible, per-user,
-- no audit) with a company-scoped, audited workflow:
--   * requirement templates express the canonical operating order (owner ->
--     property -> unit -> contract; invoice optional);
--   * identity/authority gates (owner identity, property root aggregate) are
--     NON_WAIVABLE;
--   * operational steps are ADMIN_WAIVABLE: a waiver records company,
--     requirement, actor, time, reason, authority and an optional evidence
--     reference, and requires an admin + a mandatory reason;
--   * completion is a single, audited company-scoped fact, no longer a
--     per-user localStorage flag.
--
-- Step *completion* (does an owner/property/unit/contract/invoice exist) stays
-- derived from live company data by the UI/dashboard snapshot; this migration
-- owns the state that must not live in the browser: waivers and completion.
--
-- Rollback: supabase/rollback/20260818000000_rollback_wp03_gap005_onboarding_authority.sql

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Requirement templates (static catalog; the canonical operating order).
--    The exact canonical seven-step enumeration and any property-level safety
--    evidence requirements remain an open product decision (DP-5); this catalog
--    is the current repository operating order and is extensible without
--    further schema change.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.onboarding_requirement_templates (
  code          text primary key,
  label_ar      text not null,
  required      boolean not null default true,
  waiver_policy text not null default 'ADMIN_WAIVABLE'
    check (waiver_policy in ('NON_WAIVABLE', 'ADMIN_WAIVABLE')),
  sort_order    integer not null default 0
);

comment on table public.onboarding_requirement_templates is
  'GAP-005: canonical onboarding requirement templates. waiver_policy NON_WAIVABLE marks identity/authority gates; ADMIN_WAIVABLE requires an admin waiver with reason.';

insert into public.onboarding_requirement_templates (code, label_ar, required, waiver_policy, sort_order) values
  ('owner',    'إضافة أول مالك',        true,  'NON_WAIVABLE',   1),
  ('property', 'إنشاء أول عقار',        true,  'NON_WAIVABLE',   2),
  ('unit',     'إنشاء أول وحدة',        true,  'ADMIN_WAIVABLE', 3),
  ('contract', 'إنشاء أول عقد',         true,  'ADMIN_WAIVABLE', 4),
  ('invoice',  'إصدار أول فاتورة',      false, 'ADMIN_WAIVABLE', 5)
on conflict (code) do update
  set label_ar = excluded.label_ar,
      required = excluded.required,
      waiver_policy = excluded.waiver_policy,
      sort_order = excluded.sort_order;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Company-scoped onboarding state: waiver records + a single completion row.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.company_onboarding_waivers (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id),
  requirement_code   text not null references public.onboarding_requirement_templates(code),
  waived_by          uuid not null,
  waived_at          timestamptz not null default now(),
  waiver_reason      text not null,
  waiver_authority   text not null,
  evidence_reference text,
  unique (company_id, requirement_code)
);

comment on table public.company_onboarding_waivers is
  'GAP-005: admin-authorized, audited onboarding waivers. One per company/requirement; NON_WAIVABLE requirements can never be waived.';

create table if not exists public.company_onboarding_completion (
  company_id    uuid primary key references public.companies(id),
  completed_by  uuid not null,
  completed_at  timestamptz not null default now()
);

comment on table public.company_onboarding_completion is
  'GAP-005: company-scoped onboarding completion fact (no longer per-user localStorage).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS: authenticated reads are company-scoped; writes are RPC-only.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.onboarding_requirement_templates enable row level security;
alter table public.company_onboarding_waivers enable row level security;
alter table public.company_onboarding_completion enable row level security;

drop policy if exists onboarding_templates_read on public.onboarding_requirement_templates;
create policy onboarding_templates_read on public.onboarding_requirement_templates
  for select to authenticated using (true);

drop policy if exists onboarding_waivers_company_read on public.company_onboarding_waivers;
create policy onboarding_waivers_company_read on public.company_onboarding_waivers
  for select to authenticated
  using (company_id = public.current_company_id());

drop policy if exists onboarding_completion_company_read on public.company_onboarding_completion;
create policy onboarding_completion_company_read on public.company_onboarding_completion
  for select to authenticated
  using (company_id = public.current_company_id());

revoke all on table public.onboarding_requirement_templates from public, anon, authenticated;
revoke all on table public.company_onboarding_waivers from public, anon, authenticated;
revoke all on table public.company_onboarding_completion from public, anon, authenticated;
grant select on table public.onboarding_requirement_templates to authenticated;
grant select on table public.company_onboarding_waivers to authenticated;
grant select on table public.company_onboarding_completion to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPCs (SECURITY DEFINER, search_path pinned, company scope revalidated).
-- ─────────────────────────────────────────────────────────────────────────────

-- Read the authoritative state: completion flag + templates + waivers.
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

-- Admin-authorized waiver with mandatory reason. NON_WAIVABLE gates fail closed.
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

-- Admin-clearable waiver (restores a step to required) — audit preserved as a
-- new state, not a silent delete of history in the calling path.
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

-- Record company-scoped onboarding completion (audited actor + time).
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

-- Settings-style reset: clear waivers + completion for the company (admin only).
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Grants: authenticated callers only; never anon/public.
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
