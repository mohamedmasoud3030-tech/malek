-- S02-T10 — final SECURITY DEFINER / cross-company exposure sweep.
--
-- Runtime PostgreSQL contract. It runs after every migration in the isolated
-- Supabase replay and fails closed on PUBLIC/anon exposure, browser access to
-- internal settlement helpers, or loss of explicit company scoping on an
-- authenticated financial SECURITY DEFINER entry point.
--
-- Scope intentionally stays inside S02 financial/security database boundaries.

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
    -- D-002 internal implementations/guard retained after the public wrappers.
    'approve_owner_settlement_atomic_s02_base',
    'pay_owner_settlement_atomic_s02_base',
    'assert_owner_settlement_totals_fresh'
  ];
  v_fa003_system_internal text[] := array[
    'owner_settlement_reservable_expenses',
    'owner_settlement_reservable_payments',
    'assert_owner_settlement_links_backfillable',
    'backfill_owner_settlement_links'
  ];
  v_d002_private_internal text[] := array[
    'approve_owner_settlement_atomic_s02_base',
    'pay_owner_settlement_atomic_s02_base',
    'assert_owner_settlement_totals_fresh'
  ];
  v_missing text;
  v_leaks text;
  v_internal_leaks text;
  v_service_gaps text;
  v_company_guard_gaps text;
  v_definer_count integer;
begin
  -- Canonical names must exist. Invoker trigger helpers remain in the inventory
  -- for completeness; the ACL sweep itself enumerates only prosecdef=true rows.
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

  -- Every SECURITY DEFINER overload in scope must be closed to PUBLIC and anon.
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

  -- FA-003 source-set/backfill helpers are system-only. service_role is the
  -- approved external system caller; authenticated browser execution is forbidden.
  select string_agg(
           format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
           ', ' order by p.proname
         )
    into v_internal_leaks
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = any(v_fa003_system_internal)
     and p.prosecdef
     and has_function_privilege('authenticated', p.oid, 'EXECUTE');

  if v_internal_leaks is not null then
    raise exception 'S02-T10 FA-003 internal helper exposed to authenticated: %', v_internal_leaks;
  end if;

  select string_agg(
           format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
           ', ' order by p.proname
         )
    into v_service_gaps
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = any(v_fa003_system_internal)
     and p.prosecdef
     and not has_function_privilege('service_role', p.oid, 'EXECUTE');

  if v_service_gaps is not null then
    raise exception 'S02-T10 FA-003 system helper lost approved service_role EXECUTE: %', v_service_gaps;
  end if;

  -- D-002 preserved bodies/freshness guard are private implementation details.
  -- Neither the browser nor service_role may bypass the guarded public wrappers.
  select string_agg(
           format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
           ', ' order by p.proname
         )
    into v_internal_leaks
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = any(v_d002_private_internal)
     and p.prosecdef
     and (
       has_function_privilege('authenticated', p.oid, 'EXECUTE')
       or has_function_privilege('service_role', p.oid, 'EXECUTE')
     );

  if v_internal_leaks is not null then
    raise exception 'S02-T10 private D-002 function became externally executable: %', v_internal_leaks;
  end if;

  -- Authenticated financial SECURITY DEFINER entry points must carry an explicit
  -- company predicate AND derive/validate caller identity through one of the
  -- trusted patterns already used by the reviewed S02 RPCs:
  --   current_company_id(), require_company_id(), or auth.uid() + company predicate.
  -- This catches company-scope regression without falsely requiring one specific
  -- helper spelling. Cross-company behavior is additionally exercised by the
  -- existing owner-agreement, bank-import and lifecycle pgTAP suites in the same
  -- isolated replay.
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
       position('company_id' in lower(pg_get_functiondef(p.oid))) = 0
       or (
         position('current_company_id' in lower(pg_get_functiondef(p.oid))) = 0
         and position('require_company_id' in lower(pg_get_functiondef(p.oid))) = 0
         and position('auth.uid()' in lower(pg_get_functiondef(p.oid))) = 0
       )
     );

  if v_company_guard_gaps is not null then
    raise exception 'S02-T10 authenticated SECURITY DEFINER function lacks explicit company/identity guard: %', v_company_guard_gaps;
  end if;
end $$;

-- Behavioral no-JWT proof for the guarded owner-settlement lifecycle wrappers.
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
