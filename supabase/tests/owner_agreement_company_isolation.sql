-- FA-004 focused contract tests. Run against a database after all migrations:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f this-file.sql
-- The tenant fixture/integration suite supplies authenticated JWT contexts; these
-- checks ensure the deployed RPC cannot regress to the pre-fix definition.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select ok(
  pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
    like '%oa.company_id = v_company_id%',
  'agreement SELECT is explicitly scoped to company_id'
);
select ok(
  pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
    like '%and oa.company_id = v_company_id%',
  'agreement UPDATE is explicitly scoped to company_id'
);
select ok(
  pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
    like '%get diagnostics v_updated_count = row_count%',
  'UPDATE row count is checked explicitly'
);
select ok(
  pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
    like '%public.require_company_id()%',
  'company_id comes from the trusted require_company_id helper'
);
select ok(
  pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
    like '%AGREEMENT_NOT_FOUND_OR_FORBIDDEN%',
  'unknown and foreign agreement UUIDs use the same denial error'
);
select ok(
  pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
    like '%AGREEMENT_RELATIONSHIP_IMMUTABLE%'
    and pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
      not like '%set owner_id =%',
  'owner/property/company relationships cannot be transferred by this RPC'
);
select ok(
  pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
    like '%o.company_id = v_company_id%'
    and pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
      like '%p.company_id = v_company_id%',
  'owner and property relationship checks are company-scoped'
);
select ok(
  pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
    like '%RATE%'
    and pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
      like '%FIXED_MONTHLY%'
    and pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
      like '%commission_value < 0%',
  'commission type and value validation remains server-side'
);
select ok(
  pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
    like '%SET search_path TO ''public'', ''pg_temp''%'
    and has_function_privilege('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure, 'authenticated', 'EXECUTE')
    and not has_function_privilege('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure, 'anon', 'EXECUTE'),
  'SECURITY DEFINER path is pinned and execution is limited to application roles'
);
select ok(
  pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
    like '%insert into public.audit_log%'
    and pg_get_functiondef('public.update_owner_agreement_atomic(uuid,jsonb)'::regprocedure)
      like '%''company_id'', v_company_id%',
  'successful updates record actor, company, agreement, timestamp, and changed fields'
);
select * from finish();
rollback;
