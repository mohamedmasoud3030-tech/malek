-- P0-2 Tax / billing readiness RPC authorization boundary.
--
-- Verified defect on main (post-#1795/#1796): three frontend services called
-- the internal tax authority resolvers directly from the browser:
--   * features/financials/billing/billing-readiness-service.ts
--       -> supabase.rpc('resolve_active_tax_profile', { p_company_id, p_effective_date })
--   * features/financials/tax-authority/finance-readiness-service.ts
--       -> resolve_active_tax_profile + resolve_active_fee_tax_treatment
--   * features/financials/tax-authority/tax-authority-service.ts
--       -> getActiveTaxProfile / getActiveTaxProfileForCompany (no consumer)
--
-- Both resolvers are internal/service helpers. Migration
-- 20260901000020_revoke_internal_and_trigger_rpc_execute.sql revoked EXECUTE
-- from public/anon/authenticated, granted it to service_role only, and aborts
-- if that boundary is ever re-opened. Every browser call therefore failed with
-- SQLSTATE 42501 (permission denied for function), so billing readiness
-- reported TAX_CHECK_FAILED and the finance readiness page reported BLOCKED
-- instead of the real tax state. The resolvers also take p_company_id from the
-- caller, so a browser EXECUTE grant would have been a cross-company read.
--
-- Fix: one narrow, purpose-specific, browser-authorized readiness boundary in
-- front of the unchanged authoritative resolvers.
--
--   Frontend -> public.resolve_tax_authority_readiness(date[])
--            -> public.resolve_active_tax_profile(uuid,date)            [unchanged]
--            -> public.resolve_active_fee_tax_treatment(uuid,text,date) [unchanged]
--
-- The wrapper accepts dates only. Company scope is derived from the
-- authenticated caller (require_company_id), never accepted as an argument, so
-- no cross-company read is expressible. It exposes readiness status only — no
-- profile id, tax code or rate — because that is all a readiness surface needs.
-- TAX_PROFILE_MISSING / FEE_TAX_TREATMENT_MISSING are preserved as statuses,
-- and any other resolver failure is re-raised so callers keep failing closed.

begin;

create or replace function public.resolve_tax_authority_readiness(p_effective_dates date[])
returns table(effective_date date, tax_scope text, readiness_status text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  -- Fails closed when the JWT carries no validated company claim.
  v_company uuid := public.require_company_id();
  v_fee_kind text;
  v_date date;
  v_message text;
  v_ready boolean;
  -- Readiness is resolved per distinct issue/effective date. A billing cycle
  -- set is small; the bound keeps one browser call from fanning out into an
  -- unbounded resolver loop.
  c_max_dates constant integer := 60;
begin
  -- Canonical authorization boundary. SECURITY DEFINER that is browser
  -- executable must prove identity, membership and capability itself.
  if not coalesce(public.is_app_user(), false) then
    raise exception 'TAX_READINESS_FORBIDDEN' using errcode = '42501';
  end if;

  if not public.current_user_has_effective_app_permission('financial.workspace.view') then
    raise exception 'TAX_READINESS_FORBIDDEN' using errcode = '42501';
  end if;

  if p_effective_dates is null then
    raise exception 'TAX_READINESS_INPUT_REQUIRED' using errcode = '22023';
  end if;

  if cardinality(p_effective_dates) > c_max_dates then
    raise exception 'TAX_READINESS_DATE_LIMIT_EXCEEDED' using errcode = '22023';
  end if;

  for v_date in
    select distinct d.effective_date
    from unnest(p_effective_dates) as d(effective_date)
    where d.effective_date is not null
    order by d.effective_date
  loop
    -- Rent / invoice tax authority. The authoritative resolver is unchanged;
    -- only its missing-profile signal is translated into a readiness status.
    begin
      perform 1 from public.resolve_active_tax_profile(v_company, v_date);
      v_ready := true;
    exception when others then
      get stacked diagnostics v_message = message_text;
      if v_message like 'TAX_PROFILE_MISSING%' then
        v_ready := false;
      else
        -- Any other failure propagates: readiness must never default to READY.
        raise;
      end if;
    end;

    return query
      select v_date, 'RENT'::text,
             case when v_ready then 'READY'::text else 'TAX_PROFILE_MISSING'::text end;

    foreach v_fee_kind in array array['RATE_MANAGEMENT_FEE', 'FIXED_MONTHLY']
    loop
      begin
        perform 1 from public.resolve_active_fee_tax_treatment(v_company, v_fee_kind, v_date);
        v_ready := true;
      exception when others then
        get stacked diagnostics v_message = message_text;
        if v_message like 'FEE_TAX_TREATMENT_MISSING%' then
          v_ready := false;
        else
          raise;
        end if;
      end;

      return query
        select v_date, v_fee_kind,
               case when v_ready then 'READY'::text else 'FEE_TAX_TREATMENT_MISSING'::text end;
    end loop;
  end loop;
end;
$function$;

alter function public.resolve_tax_authority_readiness(date[]) owner to postgres;

comment on function public.resolve_tax_authority_readiness(date[]) is
  'Browser-authorized tax authority readiness boundary. Company scope is derived from the authenticated caller; exposes only READY / TAX_PROFILE_MISSING / FEE_TAX_TREATMENT_MISSING per requested date. The internal resolvers keep their service_role-only EXECUTE grant.';

-- Minimum grants: the governed browser role plus the service role. anon and
-- PUBLIC stay revoked, matching every other browser-facing governed RPC.
revoke all on function public.resolve_tax_authority_readiness(date[]) from public, anon;
grant execute on function public.resolve_tax_authority_readiness(date[]) to authenticated;
grant execute on function public.resolve_tax_authority_readiness(date[]) to service_role;

-- ---------------------------------------------------------------------------
-- Re-assert and verify the internal resolver boundary. The wrapper is SECURITY
-- DEFINER owned by postgres, so it reaches the resolvers through the definer
-- identity; browser roles must never gain EXECUTE on them directly.
-- ---------------------------------------------------------------------------
revoke all on function public.resolve_active_tax_profile(uuid,date) from public, anon, authenticated;
grant execute on function public.resolve_active_tax_profile(uuid,date) to service_role;
revoke all on function public.resolve_active_fee_tax_treatment(uuid,text,date) from public, anon, authenticated;
grant execute on function public.resolve_active_fee_tax_treatment(uuid,text,date) to service_role;

do $tax_readiness_acl$
declare
  v_internal text[] := array[
    'public.resolve_active_tax_profile(uuid,date)',
    'public.resolve_active_fee_tax_treatment(uuid,text,date)'
  ];
  v_signature text;
  v_role text;
  v_wrapper text := 'public.resolve_tax_authority_readiness(date[])';
begin
  foreach v_signature in array v_internal
  loop
    foreach v_role in array array['anon', 'authenticated']
    loop
      if has_function_privilege(v_role, v_signature, 'EXECUTE') then
        raise exception 'TAX_READINESS_ACL_ABORT: % still has EXECUTE on internal resolver %', v_role, v_signature;
      end if;
    end loop;
    if not has_function_privilege('service_role', v_signature, 'EXECUTE') then
      raise exception 'TAX_READINESS_ACL_ABORT: service_role lost EXECUTE on %', v_signature;
    end if;
  end loop;

  if not has_function_privilege('authenticated', v_wrapper, 'EXECUTE') then
    raise exception 'TAX_READINESS_ACL_ABORT: authenticated lost EXECUTE on %', v_wrapper;
  end if;
  if has_function_privilege('anon', v_wrapper, 'EXECUTE') then
    raise exception 'TAX_READINESS_ACL_ABORT: anon must not EXECUTE %', v_wrapper;
  end if;
end
$tax_readiness_acl$;

notify pgrst, 'reload schema';

commit;
