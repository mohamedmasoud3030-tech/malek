-- S02-T10 — final SECURITY DEFINER / cross-company exposure sweep.
--
-- This is a runtime PostgreSQL contract, not a source inventory generator. It runs
-- after every migration in the isolated Supabase replay and fails closed when a
-- scoped financial SECURITY DEFINER function is exposed to PUBLIC/anon, when an
-- authenticated browser entry point loses its company guard, or when an internal
-- D-002 implementation becomes browser-executable.
--
-- Scope intentionally stays inside the S02 financial/security surface. UI, route,
-- ADR and UX files are not part of this gate.

begin;

create extension if not exists pgtap with schema extensions;
select plan(1);

do $$
declare
  v_scope text[] := array[
    'approve_owner_settlement_atomic',
    'assert_owner_settlement_links_backfillable',
    'backfill_owner_settlement_links',
    'cancel_commission_atomic',
    'cancel_owner_settlement_atomic',
    'create_commission_atomic',
    'create_expense_with_journal_atomic',
    'create_owner_agreement_atomic',
    'create_owner_settlement_draft_atomic',
    'create_property_with_agreement',
    'diagnose_owner_settlement_duplication',
    'enforce_owner_settlement_link_company_consistency',
    'guard_commission_financial_fields',
    'import_bank_statement_batch_atomic',
    'owner_settlement_reservable_expenses',
    'owner_settlement_reservable_payments',
    'pay_commission_atomic',
    'pay_owner_settlement_atomic',
    'post_receipt_atomic',
    'record_invoice_payment_atomic',
    'reverse_commission_atomic',
    'update_commission_atomic',
    'update_expense_with_journal_atomic',
    'update_owner_agreement_atomic',
    'void_receipt_atomic',
    -- S02 D-002 internals added after the reviewed FA-003 lifecycle bodies.
    'approve_owner_settlement_atomic_s02_base',
    'pay_owner_settlement_atomic_s02_base',
    'assert_owner_settlement_totals_fresh'
  ];
  v_d002_internal text[] := array[
    'approve_owner_settlement_atomic_s02_base',
    'pay_owner_settlement_atomic_s02_base',
    'assert_owner_settlement_totals_fresh'
  ];
  v_missing text;
  v_leaks text;
  v_internal_leaks text;
  v_company_guard_gaps text;
  v_definer_count integer;
begin
  -- Every canonical S02 scope name must still exist. Two known trigger helpers are
  -- intentionally SECURITY INVOKER; the ACL enumeration below filters by prosecdef.
  select string_agg(s.name, ', ' order by s.name)
    into v_missing
    from unnest(v_scope) as s(name)
   where not exists (
     select 1
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = s.name
   );

  if v_missing is not null then
    raise exception 'S02-T10 scope functions missing from runtime schema: %', v_missing;
  end if;

  select count(*)
    into v_definer_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = any(v_scope)
     and p.prosecdef;

  if v_definer_count = 0 then
    raise exception 'S02-T10 found zero scoped SECURITY DEFINER functions; enumeration is not meaningful';
  end if;

  -- Enumerate every SECURITY DEFINER overload in the canonical S02 financial
  -- surface. No overload may inherit EXECUTE from PUBLIC or anon.
  select string_agg(
           format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
           ', ' order by p.proname, pg_get_function_identity_arguments(p.oid)
         )
    into v_leaks
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = any(v_scope)
     and p.prosecdef
     and (
       has_function_privilege('public', p.oid, 'EXECUTE')
       or has_function_privilege('anon', p.oid, 'EXECUTE')
     );

  if v_leaks is not null then
    raise exception 'S02-T10 PUBLIC/anon EXECUTE exposure detected: %', v_leaks;
  end if;

  -- D-002 preserved implementations and the freshness assertion are internal
  -- implementation details. They must not become callable by authenticated users
  -- or service_role; only the guarded public approve/pay wrappers are entry points.
  select string_agg(
           format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
           ', ' order by p.proname
         )
    into v_internal_leaks
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = any(v_d002_internal)
     and p.prosecdef
     and (
       has_function_privilege('authenticated', p.oid, 'EXECUTE')
       or has_function_privilege('service_role', p.oid, 'EXECUTE')
     );

  if v_internal_leaks is not null then
    raise exception 'S02-T10 internal D-002 function became externally executable: %', v_internal_leaks;
  end if;

  -- Any scoped SECURITY DEFINER function that IS deliberately callable by the
  -- authenticated browser role must derive/validate company context in its own
  -- body. Internal-only helpers are excluded because authenticated cannot invoke
  -- them directly. This is an executable catalog guard against cross-company
  -- predicate regressions, not a generated markdown heuristic.
  select string_agg(
           format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
           ', ' order by p.proname, pg_get_function_identity_arguments(p.oid)
         )
    into v_company_guard_gaps
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = any(v_scope)
     and p.prosecdef
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and (
       position('current_company_id' in lower(pg_get_functiondef(p.oid))) = 0
       or position('company_id' in lower(pg_get_functiondef(p.oid))) = 0
     );

  if v_company_guard_gaps is not null then
    raise exception 'S02-T10 authenticated SECURITY DEFINER function lacks explicit company guard: %', v_company_guard_gaps;
  end if;
end $$;

-- Behavioral no-JWT proof for the two guarded lifecycle wrappers added/retained by
-- D-002. EXECUTE is granted to authenticated, but a browser role without JWT/user
-- context must still fail with the authorization SQLSTATE before any effect.
set local role authenticated;

do $$
begin
  begin
    perform public.approve_owner_settlement_atomic('{}'::jsonb);
    raise exception 'approve_owner_settlement_atomic accepted authenticated role without JWT context';
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.pay_owner_settlement_atomic('{}'::jsonb);
    raise exception 'pay_owner_settlement_atomic accepted authenticated role without JWT context';
  exception when sqlstate '42501' then null;
  end;
end $$;

reset role;

select pass('S02-T10 SECURITY DEFINER anonymous/company boundary enumeration holds');
select * from finish();

rollback;
