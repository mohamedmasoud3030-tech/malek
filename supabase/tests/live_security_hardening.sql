-- Regression contract for the 2026-08-07 live security hardening series.
begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

-- 1. S08 read-only views must execute as the caller so underlying RLS applies.
select is(
  (
    select count(*)::int
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and c.relname in (
        's08_analysis_scope',
        's08_liability_balances_by_period',
        's08_master_lease_readiness',
        's08_subledger_gl_reconciliation',
        's08_legacy_gl_context'
      )
      and coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true']::text[]
  ),
  5,
  'all five S08 security-sensitive views use security_invoker=true'
);

-- 2-3. Read-only helpers must not elevate privileges.
select ok(
  not (select p.prosecdef from pg_proc p where p.oid = 'public.require_company_id()'::regprocedure),
  'require_company_id is SECURITY INVOKER'
);

select ok(
  not (select p.prosecdef from pg_proc p where p.oid = 'public.resolve_unit_operational_status(uuid,text)'::regprocedure),
  'resolve_unit_operational_status is SECURITY INVOKER'
);

-- 4. RLS membership helper must reject inactive company/member records and
-- authenticated callers may only test their own membership.
select ok(
  pg_get_functiondef('public.is_company_member(uuid,uuid)'::regprocedure) ilike '%cm.is_active%'
  and pg_get_functiondef('public.is_company_member(uuid,uuid)'::regprocedure) ilike '%c.is_active%'
  and pg_get_functiondef('public.is_company_member(uuid,uuid)'::regprocedure) ilike '%target_user_id = auth.uid()%'
  and not has_function_privilege('anon', 'public.is_company_member(uuid,uuid)', 'EXECUTE'),
  'company membership RLS helper is active-only, self-scoped, and not callable by anon'
);

-- 5. Balance rebuild must never contain the old global delete path.
select ok(
  pg_get_functiondef('public.recalculate_all_balances()'::regprocedure) not ilike '%delete from contract_balances where true%'
  and pg_get_functiondef('public.recalculate_all_balances()'::regprocedure) not ilike '%delete from public.contract_balances where true%'
  and pg_get_functiondef('public.recalculate_all_balances()'::regprocedure) ilike '%company_id = v_company_id%'
  and pg_get_functiondef('public.recalculate_all_balances()'::regprocedure) ilike '%require_company_id()%'
  and not has_function_privilege('anon', 'public.recalculate_all_balances()', 'EXECUTE'),
  'balance rebuild is active-company scoped and not callable by anon'
);

-- 6. Maintenance resolution must lock and mutate only the active company.
select ok(
  pg_get_functiondef('public.resolve_maintenance_with_expense(text,numeric,text)'::regprocedure) ilike '%company_id = v_company_id%'
  and pg_get_functiondef('public.resolve_maintenance_with_expense(text,numeric,text)'::regprocedure) ilike '%require_company_id()%'
  and pg_get_functiondef('public.resolve_maintenance_with_expense(text,numeric,text)'::regprocedure) ilike '%u.role in (''ADMIN'', ''MANAGER'')%'
  and not has_function_privilege('anon', 'public.resolve_maintenance_with_expense(text,numeric,text)', 'EXECUTE'),
  'maintenance resolution is role-gated and active-company scoped'
);

-- 7. Authenticated scheduled automation runs must be company scoped.
select ok(
  pg_get_functiondef('public.run_scheduled_automation_rules()'::regprocedure) ilike '%u.role in (''ADMIN'', ''MANAGER'')%'
  and pg_get_functiondef('public.run_scheduled_automation_rules()'::regprocedure) ilike '%v_company_id is null or company_id = v_company_id%'
  and pg_get_functiondef('public.run_scheduled_automation_rules()'::regprocedure) ilike '%require_company_id()%'
  and not has_function_privilege('anon', 'public.run_scheduled_automation_rules()', 'EXECUTE'),
  'manual scheduled automation is role-gated and active-company scoped'
);

-- 8. Bank matching must enforce permission, company ownership, and full amount.
select ok(
  pg_get_functiondef('public.process_bank_reconciliation_match_atomic(jsonb)'::regprocedure) ilike '%is_admin_or_manager()%'
  and pg_get_functiondef('public.process_bank_reconciliation_match_atomic(jsonb)'::regprocedure) ilike '%company_id = v_company_id%'
  and pg_get_functiondef('public.process_bank_reconciliation_match_atomic(jsonb)'::regprocedure) ilike '%v_matched_amount <> v_line.amount%'
  and pg_get_functiondef('public.process_bank_reconciliation_match_atomic(jsonb)'::regprocedure) ilike '%Matched payment was not found in the active company.%'
  and not has_function_privilege('anon', 'public.process_bank_reconciliation_match_atomic(jsonb)', 'EXECUTE'),
  'bank reconciliation match is role/company/amount hardened'
);

select * from finish();
rollback;
