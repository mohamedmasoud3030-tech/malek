-- SECURITY DEFINER governance hardening (governance stabilization, Phase 5).
--
-- Effective authority must come from the canonical membership resolver and
-- governed permission resolver, never public.users.role. This migration keeps
-- all existing function signatures, grants, company scoping, and business
-- behavior intact while replacing the remaining authorization/routing leaks
-- discovered in the SECURITY DEFINER boundary audit.
--
-- Hardened boundaries:
--   * current_user_has_effective_app_permission: every permission decision now
--     requires a valid active app identity/membership and a known catalog
--     permission before role or explicit-grant evaluation. Stale grants cannot
--     resurrect an inactive/deleted/non-member user, and ADMIN cannot authorize
--     an unknown permission identifier.
--   * request_receipt_void_atomic (maker step; approve_receipt_void_atomic is
--     the checker step already hardened below — both sides of the
--     maker/checker pair must use the canonical resolver, not just one)
--   * approve_receipt_void_atomic
--   * recalculate_all_balances
--   * resolve_maintenance_with_expense
--   * run_scheduled_automation_rules (authenticated path only; service path
--     with auth.uid() IS NULL remains intentionally unchanged). As of
--     migration 00006 this function is a disabled stub
--     (BACKGROUND_SCHEDULE_ACTIVATION_REQUIRED) with EXECUTE revoked from
--     authenticated/anon and granted only to service_role, so there is no
--     authenticated-role check left to hardened. That already-closed state
--     is recognized as a valid secure terminal state below and skipped.
--   * request_permission: active-app-user gate plus admin/manager notification
--     routing by company_members.role rather than users.role
--   * current_user_has_support_capability named MANAGER/ADMIN bypasses
--     (routes through current_user_has_effective_app_permission ->
--     role_has_app_permission instead; role_has_app_permission's MANAGER
--     whitelist is extended below to include support.operations.view and
--     support.requests.triage so this routing change does not silently
--     revoke access the 00005 foundation migration granted MANAGER.
--     support.user_lookup.view remains ADMIN-only, matching 00005.)
--
-- Existing large function bodies are preserved mechanically with
-- pg_get_functiondef() + exact fail-closed replacements. If an expected old
-- fragment is absent and the hardened fragment is also absent, migration
-- replay aborts instead of silently weakening governance.

begin;

CREATE OR REPLACE FUNCTION public.current_user_has_effective_app_permission(p_permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_company uuid := public.require_company_id();
begin
  -- Explicit grants are not an identity source. A stale grant must never
  -- resurrect an inactive/deleted identity, inactive company, or lost
  -- company membership.
  if not coalesce(public.is_app_user(), false) then
    return false;
  end if;

  -- Unknown permission names fail closed for every role, including ADMIN.
  if not exists (
    select 1
    from public.app_permission_catalog c
    where c.permission = p_permission
  ) then
    return false;
  end if;

  if public.is_admin() then
    return true;
  end if;

  return public.role_has_app_permission(public.current_app_role(), p_permission)
    or exists (
      select 1
      from public.user_permission_grants g
      where g.company_id = v_company
        and g.user_id = auth.uid()
        and g.permission = p_permission
        and g.revoked_at is null
    );
end;
$function$;

DO $phase5$
DECLARE
  v_sql text;
  v_old text := $old$
  if v_actor is null or not exists (
    select 1
    from public.users u
    where u.id = v_actor
      and u.status::text = 'ACTIVE'
      and u.role::text in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'ADMIN or MANAGER role is required to request receipt VOID.'
      using errcode = '42501';
  end if;$old$;
  v_new text := $new$
  if v_actor is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'ADMIN or MANAGER role is required to request receipt VOID.'
      using errcode = '42501';
  end if;$new$;
BEGIN
  SELECT pg_get_functiondef('public.request_receipt_void_atomic(jsonb)'::regprocedure)
    INTO v_sql;

  IF position(v_old IN v_sql) > 0 THEN
    EXECUTE replace(v_sql, v_old, v_new);
  ELSIF position(v_new IN v_sql) = 0 THEN
    RAISE EXCEPTION 'Phase 5 refused to patch request_receipt_void_atomic: expected authority block not found.';
  END IF;
END
$phase5$;

DO $phase5$
DECLARE
  v_sql text;
  v_old text := $old$
  if v_actor is null or not exists (
    select 1
    from public.users u
    where u.id = v_actor
      and u.status::text = 'ACTIVE'
      and u.role::text in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'ADMIN or MANAGER role is required to approve receipt VOID.'
      using errcode = '42501';
  end if;$old$;
  v_new text := $new$
  if v_actor is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'ADMIN or MANAGER role is required to approve receipt VOID.'
      using errcode = '42501';
  end if;$new$;
BEGIN
  SELECT pg_get_functiondef('public.approve_receipt_void_atomic(jsonb)'::regprocedure)
    INTO v_sql;

  IF position(v_old IN v_sql) > 0 THEN
    EXECUTE replace(v_sql, v_old, v_new);
  ELSIF position(v_new IN v_sql) = 0 THEN
    RAISE EXCEPTION 'Phase 5 refused to patch approve_receipt_void_atomic: expected authority block not found.';
  END IF;
END
$phase5$;

DO $phase5$
DECLARE
  v_sql text;
  v_old text := $old$
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' using errcode = '42501';
  end if;$old$;
  v_new text := $new$
  if not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' using errcode = '42501';
  end if;$new$;
BEGIN
  SELECT pg_get_functiondef('public.recalculate_all_balances()'::regprocedure)
    INTO v_sql;

  IF position(v_old IN v_sql) > 0 THEN
    EXECUTE replace(v_sql, v_old, v_new);
  ELSIF position(v_new IN v_sql) = 0 THEN
    RAISE EXCEPTION 'Phase 5 refused to patch recalculate_all_balances: expected authority block not found.';
  END IF;
END
$phase5$;

DO $phase5$
DECLARE
  v_sql text;
  v_old text := $old$
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role in ('ADMIN', 'MANAGER')
  ) then
    raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' using errcode = '42501';
  end if;$old$;
  v_new text := $new$
  if not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' using errcode = '42501';
  end if;$new$;
BEGIN
  SELECT pg_get_functiondef('public.resolve_maintenance_with_expense(text,numeric,text)'::regprocedure)
    INTO v_sql;

  IF position(v_old IN v_sql) > 0 THEN
    EXECUTE replace(v_sql, v_old, v_new);
  ELSIF position(v_new IN v_sql) = 0 THEN
    RAISE EXCEPTION 'Phase 5 refused to patch resolve_maintenance_with_expense: expected authority block not found.';
  END IF;
END
$phase5$;

DO $phase5$
DECLARE
  v_sql text;
  v_old text := $old$
    if not exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('ADMIN', 'MANAGER')
    ) then
      raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' using errcode = '42501';
    end if;$old$;
  v_new text := $new$
    if not coalesce(public.is_admin_or_manager(), false) then
      raise exception 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول' using errcode = '42501';
    end if;$new$;
  v_disabled_stub_marker text := 'BACKGROUND_SCHEDULE_ACTIVATION_REQUIRED';
  v_has_authenticated_grant boolean;
BEGIN
  SELECT pg_get_functiondef('public.run_scheduled_automation_rules()'::regprocedure)
    INTO v_sql;

  SELECT has_function_privilege('authenticated', 'public.run_scheduled_automation_rules()', 'EXECUTE')
    INTO v_has_authenticated_grant;

  IF position(v_old IN v_sql) > 0 THEN
    EXECUTE replace(v_sql, v_old, v_new);
  ELSIF position(v_new IN v_sql) > 0 THEN
    -- Already hardened by a prior run of this migration. No-op.
    NULL;
  ELSIF position(v_disabled_stub_marker IN v_sql) > 0 AND NOT v_has_authenticated_grant THEN
    -- Valid secure terminal state: migration 00006 already replaced this
    -- function with a disabled stub and revoked EXECUTE from
    -- authenticated/anon, granting it only to service_role. There is no
    -- authenticated-role authority block left to harden.
    NULL;
  ELSE
    RAISE EXCEPTION 'Phase 5 refused to patch run_scheduled_automation_rules: expected authenticated authority block not found.';
  END IF;
END
$phase5$;

DO $phase5$
DECLARE
  v_sql text;
  v_auth_old text := $old$if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;$old$;
  v_auth_new text := $new$if auth.uid() is null or not coalesce(public.is_app_user(), false) then raise exception 'Authentication required' using errcode = '42501'; end if;$new$;
  v_old_count integer;
  v_new_count integer;
  v_changed boolean := false;
BEGIN
  SELECT pg_get_functiondef('public.request_permission(text,text,text)'::regprocedure)
    INTO v_sql;

  IF position(v_auth_old IN v_sql) > 0 THEN
    v_sql := replace(v_sql, v_auth_old, v_auth_new);
    v_changed := true;
  ELSIF position(v_auth_new IN v_sql) = 0 THEN
    RAISE EXCEPTION 'Phase 5 refused to patch request_permission: expected active-user authorization anchor not found.';
  END IF;

  v_old_count := (length(v_sql) - length(replace(v_sql, 'u.role::text', ''))) / length('u.role::text');
  v_new_count := (length(v_sql) - length(replace(v_sql, 'cm.role::text', ''))) / length('cm.role::text');

  IF v_old_count = 2 THEN
    v_sql := replace(v_sql, 'u.role::text', 'cm.role::text');
    v_changed := true;
  ELSIF NOT (v_old_count = 0 AND v_new_count >= 2) THEN
    RAISE EXCEPTION 'Phase 5 refused to patch request_permission: expected exactly two users.role notification references, found old=% new=%.', v_old_count, v_new_count;
  END IF;

  IF v_changed THEN
    EXECUTE v_sql;
  END IF;
END
$phase5$;

CREATE OR REPLACE FUNCTION public.current_user_has_support_capability(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.is_app_user()
    and case p_capability
      when 'support.operations.view' then public.current_user_has_effective_app_permission(p_capability)
      when 'support.requests.triage' then public.current_user_has_effective_app_permission(p_capability)
      when 'support.user_lookup.view' then public.current_user_has_effective_app_permission(p_capability)
      else false
    end;
$function$;

-- role_has_app_permission's MANAGER whitelist predates the 00005 support
-- foundation migration and was never extended to include the two support
-- permissions 00005 explicitly grants MANAGER (support.operations.view,
-- support.requests.triage). current_user_has_support_capability used to
-- bypass the catalog whitelist entirely for MANAGER/ADMIN; now that it
-- routes through the catalog (SD-15, above), the whitelist gap would
-- silently regress MANAGER's support access. Add exactly the two
-- permissions 00005 grants MANAGER; support.user_lookup.view stays
-- ADMIN-only as 00005 intended.
CREATE OR REPLACE FUNCTION public.role_has_app_permission(p_role text, p_permission text) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select case upper(coalesce(p_role, ''))
    when 'ADMIN' then
      exists(select 1 from public.app_permission_catalog c where c.permission = p_permission)
    when 'MANAGER' then
      p_permission = any(array[
        'app.dashboard.view','maintenance.view','permission_requests.review','cost_centers.manage','documents.write',
        'owners.hub.view','owners.detail.view','lands.view','leads.view','commissions.view','communication.view',
        'automation.view','auth.password.change','properties.write','contracts.write','expenses.view','expenses.write',
        'arrears.view','financial.deposits.view','financial.invoices.generate','financial.invoices.export',
        'financial.payments.create','financial.receipts.void','financial.reports.export',
        'financial.bank_reconciliation.view','financial.bank_reconciliation.match','financial.owner_settlements.view',
        'service_providers.view','service_providers.write',
        'financial.fixed_monthly_accruals.view','financial.fixed_monthly_accruals.execute',
        'financial.fixed_monthly_accruals.reverse',
        'support.operations.view','support.requests.triage'
      ]::text[])
    when 'ACCOUNTANT' then
      p_permission = any(array[
        'app.dashboard.view','audit.view','expenses.view','arrears.view',
        'financial.deposits.view','financial.invoices.generate','financial.invoices.export',
        'financial.reports.export','financial.bank_reconciliation.view','financial.bank_reconciliation.match',
        'financial.owner_settlements.view','auth.password.change',
        'financial.fixed_monthly_accruals.view','financial.fixed_monthly_accruals.execute',
        'financial.fixed_monthly_accruals.reverse'
      ]::text[])
    when 'OPERATIONS' then
      p_permission = any(array[
        'app.dashboard.view','maintenance.view','service_providers.view','service_providers.write',
        'cost_centers.manage','documents.write','owners.hub.view','owners.detail.view','lands.view',
        'leads.view','communication.view','automation.view','auth.password.change','properties.write',
        'contracts.write','expenses.view','expenses.write','arrears.view'
      ]::text[])
    when 'USER' then
      p_permission = any(array['app.dashboard.view','auth.password.change']::text[])
    when 'VIEWER' then
      p_permission = any(array[
        'app.dashboard.view','maintenance.view','service_providers.view',
        'owners.hub.view','owners.detail.view','lands.view','leads.view','commissions.view',
        'communication.view','automation.view','expenses.view','arrears.view',
        'financial.deposits.view','financial.owner_settlements.view',
        'financial.bank_reconciliation.view','auth.password.change'
      ]::text[])
    else false
  end
$$;

-- CREATE OR REPLACE preserves existing owners and EXECUTE grants.

-- record_invoice_payment_atomic_engine is documented as an internal engine,
-- "Not a browser RPC" (see its baseline comment), with only
-- record_invoice_payment_atomic (the public wrapper) meant to be callable by
-- authenticated. The baseline only revoked EXECUTE from PUBLIC on the engine
-- function, never explicitly from authenticated -- so the schema-level
-- `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO authenticated`
-- (applied once, near the end of the baseline dump) left it directly
-- executable by any authenticated client, bypassing the wrapper's canonical
-- ADMIN/MANAGER gate entirely. Close that leak explicitly.
REVOKE ALL ON FUNCTION public.record_invoice_payment_atomic_engine(jsonb) FROM authenticated;

commit;
