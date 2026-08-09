-- S06 — Master lease GL lifecycle release contract.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

select ok(to_regclass('public.master_lease_measurements') is not null,'measurements table exists');
select ok(to_regclass('public.master_lease_schedule_rows') is not null,'schedule table exists');
select ok((select relrowsecurity from pg_class where oid='public.master_lease_measurements'::regclass),'measurements RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.master_lease_schedule_rows'::regclass),'schedule RLS enabled');
select is((select numeric_scale::integer from information_schema.columns where table_schema='public' and table_name='master_lease_measurements' and column_name='initial_liability'),3::integer,'liability is OMR 3dp');
select is((select numeric_scale::integer from information_schema.columns where table_schema='public' and table_name='master_lease_schedule_rows' and column_name='interest_amount'),3::integer,'interest is OMR 3dp');
select is((select numeric_scale::integer from information_schema.columns where table_schema='public' and table_name='master_lease_schedule_rows' and column_name='rou_depreciation'),3::integer,'depreciation is OMR 3dp');

select ok(has_table_privilege('authenticated','public.master_lease_measurements','SELECT') and not has_table_privilege('authenticated','public.master_lease_measurements','INSERT') and not has_table_privilege('authenticated','public.master_lease_measurements','UPDATE') and not has_table_privilege('authenticated','public.master_lease_measurements','DELETE'),'authenticated measurements read-only');
select ok(has_table_privilege('authenticated','public.master_lease_schedule_rows','SELECT') and not has_table_privilege('authenticated','public.master_lease_schedule_rows','INSERT') and not has_table_privilege('authenticated','public.master_lease_schedule_rows','UPDATE') and not has_table_privilege('authenticated','public.master_lease_schedule_rows','DELETE'),'authenticated schedule read-only');
select ok(not has_table_privilege('service_role','public.master_lease_measurements','INSERT') and not has_table_privilege('service_role','public.master_lease_measurements','UPDATE') and not has_table_privilege('service_role','public.master_lease_measurements','DELETE'),'service_role cannot directly mutate measurements');
select ok(not has_table_privilege('service_role','public.master_lease_schedule_rows','INSERT') and not has_table_privilege('service_role','public.master_lease_schedule_rows','UPDATE') and not has_table_privilege('service_role','public.master_lease_schedule_rows','DELETE'),'service_role cannot directly mutate schedules');
select ok(exists(select 1 from pg_trigger where tgrelid='public.master_lease_measurements'::regclass and tgname='guard_master_lease_measurement_immutable' and not tgisinternal),'measurement immutability trigger exists');
select ok(exists(select 1 from pg_trigger where tgrelid='public.master_lease_schedule_rows'::regclass and tgname='guard_master_lease_schedule_immutable' and not tgisinternal),'schedule immutability trigger exists');
select ok(exists(select 1 from pg_trigger where tgrelid='public.master_lease_measurements'::regclass and tgname='guard_master_lease_measurement_parent' and not tgisinternal),'parent/company trigger exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='master_lease_measurements_one_active_uidx'),'one active measurement index exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='master_lease_measurements_one_draft_uidx'),'one draft measurement index exists');

select ok(to_regprocedure('public.gl_ml_create_initial_measurement(jsonb)') is not null,'create initial RPC exists');
select ok(to_regprocedure('public.gl_ml_post_initial_recognition(jsonb)') is not null,'post initial RPC exists');
select ok(to_regprocedure('public.gl_ml_post_period(jsonb)') is not null,'post period RPC exists');
select ok(to_regprocedure('public.gl_ml_create_remeasurement(jsonb)') is not null,'create remeasurement RPC exists');
select ok(to_regprocedure('public.gl_ml_post_remeasurement(jsonb)') is not null,'post remeasurement RPC exists');
select ok(to_regprocedure('public.gl_ml_post_sublease_receipt(jsonb)') is not null,'sublease receipt RPC exists');
select ok((select prosecdef from pg_proc where oid='public.gl_ml_create_initial_measurement(jsonb)'::regprocedure) and (select prosecdef from pg_proc where oid='public.gl_ml_post_initial_recognition(jsonb)'::regprocedure) and (select prosecdef from pg_proc where oid='public.gl_ml_post_period(jsonb)'::regprocedure) and (select prosecdef from pg_proc where oid='public.gl_ml_create_remeasurement(jsonb)'::regprocedure) and (select prosecdef from pg_proc where oid='public.gl_ml_post_remeasurement(jsonb)'::regprocedure) and (select prosecdef from pg_proc where oid='public.gl_ml_post_sublease_receipt(jsonb)'::regprocedure),'business RPCs SECURITY DEFINER');
select ok(not has_function_privilege('authenticated','public.gl_ml_create_initial_measurement(jsonb)','EXECUTE') and not has_function_privilege('anon','public.gl_ml_create_initial_measurement(jsonb)','EXECUTE') and not has_function_privilege('public','public.gl_ml_create_initial_measurement(jsonb)','EXECUTE') and has_function_privilege('service_role','public.gl_ml_create_initial_measurement(jsonb)','EXECUTE'),'initial measurement service-only');
select ok(not has_function_privilege('authenticated','public.gl_ml_post_period(jsonb)','EXECUTE') and has_function_privilege('service_role','public.gl_ml_post_period(jsonb)','EXECUTE'),'period posting service-only');
select ok(not has_function_privilege('authenticated','public.gl_ml_create_remeasurement(jsonb)','EXECUTE') and has_function_privilege('service_role','public.gl_ml_create_remeasurement(jsonb)','EXECUTE'),'remeasurement creation service-only');
select ok(not has_function_privilege('authenticated','public.gl_ml_post_remeasurement(jsonb)','EXECUTE') and has_function_privilege('service_role','public.gl_ml_post_remeasurement(jsonb)','EXECUTE'),'remeasurement posting service-only');
select ok(not has_function_privilege('authenticated','public.gl_ml_post_sublease_receipt(jsonb)','EXECUTE') and has_function_privilege('service_role','public.gl_ml_post_sublease_receipt(jsonb)','EXECUTE'),'sublease posting service-only');
select ok(not has_function_privilege('service_role','public.gl_ml_insert_schedule_rows(uuid,uuid,date,jsonb,integer,numeric,numeric,numeric,boolean)','EXECUTE'),'internal schedule writer hidden from service_role');

select is((public.gl_ml_measure_payments('[{"period":1,"amount":100.000},{"period":2,"amount":100.000}]'::jsonb,0,12)->>'initial_liability')::numeric,200.000::numeric,'zero-rate PV exact');
select is((public.gl_ml_measure_payments('[{"period":1,"amount":100.000},{"period":2,"amount":100.000}]'::jsonb,0,12)->>'max_period')::integer,2::integer,'max period server-derived');
select throws_ok($$select public.gl_ml_measure_payments('[{"period":1,"amount":10},{"period":1,"amount":20}]'::jsonb,0,12)$$,'22023','GL_ML_PAYMENT_PERIOD_INVALID_OR_DUPLICATE','duplicate periods rejected');
select throws_ok($$select public.gl_ml_measure_payments('[{"period":1,"amount":0}]'::jsonb,0,12)$$,'22023','GL_ML_PAYMENTS_ALL_ZERO','zero payment series rejected');

select ok(pg_get_functiondef('public.gl_ml_post_initial_recognition(jsonb)'::regprocedure) like '%post_journal_event%' and pg_get_functiondef('public.gl_ml_post_initial_recognition(jsonb)'::regprocedure) like '%''1600''%' and pg_get_functiondef('public.gl_ml_post_initial_recognition(jsonb)'::regprocedure) like '%''2500''%','initial recognition uses canonical GL and 1600/2500');
select ok(pg_get_functiondef('public.gl_ml_post_period(jsonb)'::regprocedure) like '%post_journal_event%' and pg_get_functiondef('public.gl_ml_post_period(jsonb)'::regprocedure) like '%''1650''%' and pg_get_functiondef('public.gl_ml_post_period(jsonb)'::regprocedure) like '%''6200''%' and pg_get_functiondef('public.gl_ml_post_period(jsonb)'::regprocedure) like '%''6300''%','period uses canonical GL and lease accounts');
select ok(pg_get_functiondef('public.gl_ml_create_remeasurement(jsonb)'::regprocedure) like '%GL_ML_REMEASUREMENT_REQUIRES_POSTED_PERIOD_BOUNDARY%' and pg_get_functiondef('public.gl_ml_create_remeasurement(jsonb)'::regprocedure) like '%closing_liability%' and pg_get_functiondef('public.gl_ml_create_remeasurement(jsonb)'::regprocedure) like '%closing_rou_asset%','remeasurement derives posted carrying values');
select ok(pg_get_functiondef('public.gl_ml_post_remeasurement(jsonb)'::regprocedure) like '%post_journal_event%' and pg_get_functiondef('public.gl_ml_post_remeasurement(jsonb)'::regprocedure) like '%''4400''%' and pg_get_functiondef('public.gl_ml_post_remeasurement(jsonb)'::regprocedure) like '%''6400''%','remeasurement uses gain/loss accounts through GL');
select ok(pg_get_functiondef('public.gl_ml_post_sublease_receipt(jsonb)'::regprocedure) like '%master_lease%' and pg_get_functiondef('public.gl_ml_post_sublease_receipt(jsonb)'::regprocedure) like '%''4000''%' and pg_get_functiondef('public.gl_ml_post_sublease_receipt(jsonb)'::regprocedure) not like '%''2000''%','sublease is principal revenue, never owner payable');

select * from finish();
rollback;
