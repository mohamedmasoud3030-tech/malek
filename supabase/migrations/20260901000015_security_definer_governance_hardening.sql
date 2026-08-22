-- SECURITY DEFINER governance hardening (governance stabilization, Phase 5).
--
-- Effective authority must come from the canonical membership resolver and
-- governed permission resolver, never public.users.role. This migration keeps
-- all existing function signatures, grants, company scoping, and business
-- behavior intact while replacing the remaining authorization/routing leaks
-- discovered in the SECURITY DEFINER boundary audit.
--
-- Hardened boundaries:
--   * approve_receipt_void_atomic
--   * recalculate_all_balances
--   * resolve_maintenance_with_expense
--   * run_scheduled_automation_rules (authenticated path only; service path
--     with auth.uid() IS NULL remains intentionally unchanged)
--   * request_permission admin/manager notification routing
--   * current_user_has_support_capability named MANAGER bypass
--
-- Existing large function bodies are preserved mechanically with
-- pg_get_functiondef() + exact fail-closed replacements. If an expected old
-- fragment is absent and the hardened fragment is also absent, migration
-- replay aborts instead of silently weakening governance.

begin;

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
BEGIN
  SELECT pg_get_functiondef('public.run_scheduled_automation_rules()'::regprocedure)
    INTO v_sql;

  IF position(v_old IN v_sql) > 0 THEN
    EXECUTE replace(v_sql, v_old, v_new);
  ELSIF position(v_new IN v_sql) = 0 THEN
    RAISE EXCEPTION 'Phase 5 refused to patch run_scheduled_automation_rules: expected authenticated authority block not found.';
  END IF;
END
$phase5$;

DO $phase5$
DECLARE
  v_sql text;
  v_old_count integer;
  v_new_count integer;
BEGIN
  SELECT pg_get_functiondef('public.request_permission(text,text,text)'::regprocedure)
    INTO v_sql;

  v_old_count := (length(v_sql) - length(replace(v_sql, 'u.role::text', ''))) / length('u.role::text');
  v_new_count := (length(v_sql) - length(replace(v_sql, 'cm.role::text', ''))) / length('cm.role::text');

  IF v_old_count = 2 THEN
    v_sql := replace(v_sql, 'u.role::text', 'cm.role::text');
    EXECUTE v_sql;
  ELSIF NOT (v_old_count = 0 AND v_new_count >= 2) THEN
    RAISE EXCEPTION 'Phase 5 refused to patch request_permission: expected exactly two users.role notification references, found old=% new=%.', v_old_count, v_new_count;
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

-- CREATE OR REPLACE preserves the existing owner and EXECUTE grants.

commit;
