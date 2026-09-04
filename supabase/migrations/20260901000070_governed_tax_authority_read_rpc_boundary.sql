-- Expose the two authoritative tax resolvers to the browser through a governed
-- read boundary, without granting EXECUTE on the internals.
--
-- Verified root cause (P0-2), replayed on PGlite 2026-09-04:
-- public.resolve_active_tax_profile(uuid,date) and
-- public.resolve_active_fee_tax_treatment(uuid,text,date) are internal/service
-- helpers: 20260901000020_revoke_internal_and_trigger_rpc_execute.sql:313-323
-- revoked EXECUTE from public/anon/authenticated and pinned the ACL to
-- {postgres = all (owner), service_role = all}. The browser still calls both
-- names directly (finance-readiness-service.ts, billing-readiness-service.ts),
-- so every finance-readiness panel and every billing-row tax check returns
-- `permission denied for function ...` (42501) instead of a tax answer: the
-- readiness panel degrades to BLOCKED and billing rows fail closed to
-- TAX_CHECK_FAILED. Confirmed for ADMIN, MANAGER, ACCOUNTANT, USER, OPERATIONS
-- and VIEWER alike; only service_role and a direct superuser connection work.
-- The original baseline grant was asymmetric too (canonical baseline
-- 34140-34142 granted resolve_active_tax_profile to authenticated but never
-- granted the fee resolver), which is why this stayed invisible: half the tax
-- surface "worked" until 000020 closed it, and nothing repointed the callers.
--
-- Directly re-granting authenticated EXECUTE on the internals is not an
-- option, and not only because 000020:455-490 asserts that they stay private.
-- Both are SECURITY DEFINER functions owned by postgres, so they run with
-- rights that bypass RLS, and both accept an arbitrary p_company_id with no
-- membership check: any signed-in user could read any company's tax
-- configuration. The governed boundary therefore removes the company parameter
-- entirely — the company comes only from the JWT via public.require_company_id(),
-- which fails closed (42501) when no company context exists — and enforces the
-- same predicate the underlying tables' own SELECT policies use
-- (company_id = current_company_id() AND (is_admin_or_manager() OR
-- is_accountant())). No wider, because a caller who passes it can already read
-- those rows through PostgREST directly; no narrower, because both readiness
-- panels need the answer for exactly those roles.
--
-- The wrappers delegate to the existing resolvers instead of re-implementing
-- them, so there is still exactly one tax-configuration authority and the
-- TAX_PROFILE_MISSING / FEE_TAX_TREATMENT_MISSING fail-closed semantics (and
-- their message prefixes, which the frontend matches on) are preserved
-- verbatim. The internals keep their current ACL, so service_role and internal
-- SQL callers are unaffected and nothing is executed in parallel.

begin;

create or replace function app_private.require_tax_authority_read()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is not null then
    if public.is_admin_or_manager() or public.is_accountant() then
      return;
    end if;
    raise exception 'TAX_AUTHORITY_READ_FORBIDDEN' using errcode = '42501';
  end if;

  if coalesce(auth.role(), '') = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return;
  end if;

  raise exception 'TAX_AUTHORITY_READ_AUTH_REQUIRED' using errcode = '42501';
end;
$function$;

alter function app_private.require_tax_authority_read() owner to postgres;

revoke all on function app_private.require_tax_authority_read() from public, anon, authenticated;
grant execute on function app_private.require_tax_authority_read() to service_role;

create or replace function public.resolve_current_company_tax_profile(p_effective_date date)
returns table(profile_id uuid, tax_code text, tax_rate numeric, effective_from date, effective_to date)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid;
begin
  v_company := public.require_company_id();
  perform app_private.require_tax_authority_read();
  return query
    select r.profile_id, r.tax_code, r.tax_rate, r.effective_from, r.effective_to
      from public.resolve_active_tax_profile(v_company, p_effective_date) r;
end;
$function$;

create or replace function public.resolve_current_company_fee_tax_treatment(
  p_fee_kind text,
  p_effective_date date
)
returns table(treatment_id uuid, tax_profile_id uuid, tax_code text, tax_rate numeric, effective_from date, effective_to date)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid;
begin
  v_company := public.require_company_id();
  perform app_private.require_tax_authority_read();
  return query
    select r.treatment_id, r.tax_profile_id, r.tax_code, r.tax_rate, r.effective_from, r.effective_to
      from public.resolve_active_fee_tax_treatment(v_company, p_fee_kind, p_effective_date) r;
end;
$function$;

alter function public.resolve_current_company_tax_profile(date) owner to postgres;
alter function public.resolve_current_company_fee_tax_treatment(text, date) owner to postgres;

revoke all on function public.resolve_current_company_tax_profile(date) from public, anon;
revoke all on function public.resolve_current_company_fee_tax_treatment(text, date) from public, anon;
grant execute on function public.resolve_current_company_tax_profile(date) to authenticated, service_role;
grant execute on function public.resolve_current_company_fee_tax_treatment(text, date) to authenticated, service_role;

comment on function app_private.require_tax_authority_read() is
  'Fail-closed server-side authority gate for tax-configuration reads; mirrors the SELECT policy of company_tax_profiles and company_fee_tax_treatments.';
comment on function public.resolve_current_company_tax_profile(date) is
  'Browser-facing tax authority for the caller''s own company only; company is taken from the JWT, never from an argument. Delegates to public.resolve_active_tax_profile and raises TAX_PROFILE_MISSING when no active profile covers the date.';
comment on function public.resolve_current_company_fee_tax_treatment(text, date) is
  'Browser-facing fee tax authority for the caller''s own company only; company is taken from the JWT, never from an argument. Delegates to public.resolve_active_fee_tax_treatment and raises FEE_TAX_TREATMENT_MISSING when nothing covers the date.';

-- Self-proving boundary check, in the style of 000020's internal-ACL
-- verification: the assertion is re-run at every replay, so a later migration
-- that widens either wrapper or re-opens the internals fails the bootstrap
-- instead of silently shipping an escalation.
do $verify_tax_read_acl$
declare
  v_row record;
begin
  if has_function_privilege(
       'anon', 'public.resolve_current_company_tax_profile(date)', 'execute')
     or has_function_privilege(
       'anon', 'public.resolve_current_company_fee_tax_treatment(text,date)', 'execute') then
    raise exception 'tax read wrappers must not be executable by anon';
  end if;

  if not has_function_privilege(
       'authenticated', 'public.resolve_current_company_tax_profile(date)', 'execute')
     or not has_function_privilege(
       'authenticated', 'public.resolve_current_company_fee_tax_treatment(text,date)', 'execute') then
    raise exception 'tax read wrappers must be executable by authenticated';
  end if;

  -- The parameterless internals must stay out of reach of every browser role:
  -- they accept an arbitrary company id and run as the owning superuser role.
  if has_function_privilege(
       'authenticated', 'public.resolve_active_tax_profile(uuid,date)', 'execute')
     or has_function_privilege(
       'authenticated', 'public.resolve_active_fee_tax_treatment(uuid,text,date)', 'execute') then
    raise exception 'internal tax resolvers must not be executable by authenticated';
  end if;

  for v_row in
    select p.proname, p.prosecdef, p.proconfig,
           has_function_privilege('service_role', p.oid, 'execute') as svc
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'resolve_current_company_tax_profile',
         'resolve_current_company_fee_tax_treatment')
  loop
    if not v_row.prosecdef then
      raise exception '% must be SECURITY DEFINER', v_row.proname;
    end if;
    if coalesce(array_to_string(v_row.proconfig, ','), '') <> 'search_path=public, pg_temp' then
      raise exception '% must pin search_path, found %', v_row.proname,
        coalesce(array_to_string(v_row.proconfig, ','), '<unset>');
    end if;
    if not v_row.svc then
      raise exception '% must stay executable by service_role', v_row.proname;
    end if;
  end loop;
end;
$verify_tax_read_acl$;

commit;

-- PostgREST has to learn the two new signatures; hosted deploys otherwise keep
-- serving the previous function list.
notify pgrst, 'reload schema';
