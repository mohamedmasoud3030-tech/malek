-- S06 — Master lease GL lifecycle release + behavioral contract.
begin;
create extension if not exists pgtap with schema extensions;
select plan(65);

-- Static schema / ACL / accounting contract (1..38) --------------------------
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
select ok(pg_get_functiondef('public.gl_ml_post_period(jsonb)'::regprocedure) like '%post_journal_event%' and pg_get_functiondef('public.gl_ml_post_period(jsonb)'::regprocedure) like '%''1600''%' and pg_get_functiondef('public.gl_ml_post_period(jsonb)'::regprocedure) like '%''6200''%' and pg_get_functiondef('public.gl_ml_post_period(jsonb)'::regprocedure) like '%''6300''%' and pg_get_functiondef('public.gl_ml_post_period(jsonb)'::regprocedure) like '%GL_ML_PERIOD_BLOCKED_BY_PENDING_REMEASUREMENT%','period uses net ROU account and blocks stale remeasurement drafts');
select ok(pg_get_functiondef('public.gl_ml_create_remeasurement(jsonb)'::regprocedure) like '%GL_ML_REMEASUREMENT_REQUIRES_POSTED_PERIOD_BOUNDARY%' and pg_get_functiondef('public.gl_ml_create_remeasurement(jsonb)'::regprocedure) like '%closing_liability%' and pg_get_functiondef('public.gl_ml_create_remeasurement(jsonb)'::regprocedure) like '%closing_rou_asset%','remeasurement derives posted carrying values');
select ok(pg_get_functiondef('public.gl_ml_post_remeasurement(jsonb)'::regprocedure) like '%post_journal_event%' and pg_get_functiondef('public.gl_ml_post_remeasurement(jsonb)'::regprocedure) like '%''4400''%' and pg_get_functiondef('public.gl_ml_post_remeasurement(jsonb)'::regprocedure) like '%''6400''%' and pg_get_functiondef('public.gl_ml_post_remeasurement(jsonb)'::regprocedure) like '%GL_ML_REMEASUREMENT_DRAFT_STALE%','remeasurement uses gain/loss accounts and stale-draft defense');
select ok(pg_get_functiondef('public.gl_ml_post_sublease_receipt(jsonb)'::regprocedure) like '%master_lease%' and pg_get_functiondef('public.gl_ml_post_sublease_receipt(jsonb)'::regprocedure) like '%''4000''%' and pg_get_functiondef('public.gl_ml_post_sublease_receipt(jsonb)'::regprocedure) not like '%''2000''%','sublease is principal revenue, never owner payable');

-- Full behavioral lifecycle (39..65) -----------------------------------------
insert into public.companies(id,name,slug) values
 ('c6000000-0000-4000-8000-000000000001','S06 pgTAP Company A','s06-pgtap-company-a'),
 ('c6000000-0000-4000-8000-000000000002','S06 pgTAP Company B','s06-pgtap-company-b');
insert into public.owners(id,full_name,company_id)
values('06000000-0000-4000-8000-000000000001','S06 Owner','c6000000-0000-4000-8000-000000000001');
insert into public.properties(id,title,type,address,status,company_id)
values('16000000-0000-4000-8000-000000000001','S06 Property','residential','Muscat','active','c6000000-0000-4000-8000-000000000001');
insert into public.property_owners(id,property_id,owner_id,ownership_percentage,is_primary,starts_on,ends_on,company_id)
values('16000000-0000-4000-8000-000000000002','16000000-0000-4000-8000-000000000001','06000000-0000-4000-8000-000000000001',100,true,date '2025-01-01',null,'c6000000-0000-4000-8000-000000000001');
insert into public.owner_agreements(id,owner_id,property_id,agreement_type,commission_type,commission_value,starts_on,ends_on,company_id)
values('26000000-0000-4000-8000-000000000001','06000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000001','master_lease','FIXED_MONTHLY',0,date '2026-08-01',date '2027-12-31','c6000000-0000-4000-8000-000000000001');
insert into public.units(id,name,property_id,unit_number,status,company_id)
values('36000000-0000-4000-8000-000000000001','S06 Unit','16000000-0000-4000-8000-000000000001','ML-1','available','c6000000-0000-4000-8000-000000000001');
insert into public.people(id,full_name,type,company_id)
values('46000000-0000-4000-8000-000000000001','S06 Tenant','tenant','c6000000-0000-4000-8000-000000000001');
insert into public.contracts(id,property_id,unit_id,tenant_id,start_date,end_date,rent_amount,payment_cycle,status,agreement_id,company_id)
values('56000000-0000-4000-8000-000000000001','16000000-0000-4000-8000-000000000001','36000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001',date '2026-08-01',date '2027-07-31',80,'monthly','active','26000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001');
insert into public.accounting_periods(company_id,name,start_date,end_date,status) values
 ('c6000000-0000-4000-8000-000000000001','S06-HORIZON',date '2026-08-01',date '2027-12-31','OPEN'),
 ('c6000000-0000-4000-8000-000000000002','S06-HORIZON',date '2026-08-01',date '2027-12-31','OPEN');

do $seed$
begin
  perform public.provision_company_chart_of_accounts('c6000000-0000-4000-8000-000000000001'::uuid);
  perform public.provision_company_chart_of_accounts('c6000000-0000-4000-8000-000000000002'::uuid);
  perform public.gl_ml_provision_supporting_accounts('c6000000-0000-4000-8000-000000000001'::uuid);
  perform public.gl_ml_provision_supporting_accounts('c6000000-0000-4000-8000-000000000002'::uuid);
end
$seed$;

create function pg_temp.s06_account_net(p_company uuid,p_no text)
returns numeric language sql stable as $helper$
  select round(coalesce(sum(l.debit-l.credit),0),3)
  from public.journal_lines l
  join public.journal_batches b on b.id=l.batch_id
  join public.accounts a on a.id=l.account_id
  where b.company_id=p_company and b.status='POSTED' and a.no=p_no
$helper$;

select throws_ok($test$select public.gl_ml_create_initial_measurement('{"company_id":"c6000000-0000-4000-8000-000000000002","owner_agreement_id":"26000000-0000-4000-8000-000000000001","request_id":"s06-cross-company","effective_date":"2026-08-01","annual_discount_rate_bps":0,"periods_per_year":12,"payments":[{"period":1,"amount":100},{"period":2,"amount":100}]}'::jsonb)$test$,'42501','GL_ML_AGREEMENT_NOT_FOUND_OR_NOT_MASTER_LEASE','cross-company master-lease agreement use is rejected');
select lives_ok($test$select public.gl_ml_create_initial_measurement('{"company_id":"c6000000-0000-4000-8000-000000000001","owner_agreement_id":"26000000-0000-4000-8000-000000000001","request_id":"s06-initial","effective_date":"2026-08-01","annual_discount_rate_bps":0,"periods_per_year":12,"payments":[{"period":1,"amount":100},{"period":2,"amount":100}]}'::jsonb)$test$,'initial measurement is created');
select lives_ok($test$select public.gl_ml_create_initial_measurement('{"company_id":"c6000000-0000-4000-8000-000000000001","owner_agreement_id":"26000000-0000-4000-8000-000000000001","request_id":"s06-initial","effective_date":"2026-08-01","annual_discount_rate_bps":0,"periods_per_year":12,"payments":[{"period":1,"amount":100},{"period":2,"amount":100}]}'::jsonb)$test$,'identical initial request is idempotent');
select is((select count(*)::integer from public.master_lease_measurements where owner_agreement_id='26000000-0000-4000-8000-000000000001'::uuid),1::integer,'idempotent retry creates one measurement');
select is((select initial_liability from public.master_lease_measurements where request_id='s06-initial'),200.000::numeric,'initial liability is server-derived at 200 OMR');
select lives_ok($test$select public.gl_ml_post_initial_recognition(jsonb_build_object('company_id','c6000000-0000-4000-8000-000000000001','measurement_id',(select id from public.master_lease_measurements where request_id='s06-initial'),'cash_account_no','1120'))$test$,'initial recognition posts through canonical GL');
select is(pg_temp.s06_account_net('c6000000-0000-4000-8000-000000000001'::uuid,'1600'),200.000::numeric,'initial ROU net asset is 200 debit');
select is(pg_temp.s06_account_net('c6000000-0000-4000-8000-000000000001'::uuid,'2500'),-200.000::numeric,'initial lease liability is 200 credit');
select lives_ok($test$select public.gl_ml_post_period(jsonb_build_object('company_id','c6000000-0000-4000-8000-000000000001','measurement_id',(select id from public.master_lease_measurements where request_id='s06-initial'),'period_no',1,'cash_account_no','1120'))$test$,'first lease period posts');
select is(pg_temp.s06_account_net('c6000000-0000-4000-8000-000000000001'::uuid,'1600'),100.000::numeric,'period depreciation reduces net ROU to 100');
select is(pg_temp.s06_account_net('c6000000-0000-4000-8000-000000000001'::uuid,'2500'),-100.000::numeric,'period payment reduces liability to 100 credit');
select is(pg_temp.s06_account_net('c6000000-0000-4000-8000-000000000001'::uuid,'6200'),100.000::numeric,'ROU depreciation expense is 100 debit');
select lives_ok($test$select public.gl_ml_create_remeasurement('{"company_id":"c6000000-0000-4000-8000-000000000001","owner_agreement_id":"26000000-0000-4000-8000-000000000001","request_id":"s06-remeasure","effective_date":"2026-09-01","annual_discount_rate_bps":0,"periods_per_year":12,"scope_reduction_bps":0,"payments":[{"period":1,"amount":60},{"period":2,"amount":60}]}'::jsonb)$test$,'remeasurement freezes posted carrying values');
select is((select initial_rou_asset from public.master_lease_measurements where request_id='s06-remeasure'),120.000::numeric,'remeasured ROU carrying value is 120');
select throws_ok($test$select public.gl_ml_post_period(jsonb_build_object('company_id','c6000000-0000-4000-8000-000000000001','measurement_id',(select id from public.master_lease_measurements where request_id='s06-initial'),'period_no',2,'cash_account_no','1120'))$test$,'22023','GL_ML_PERIOD_BLOCKED_BY_PENDING_REMEASUREMENT','pending remeasurement blocks future old-schedule posting');
select lives_ok($test$select public.gl_ml_post_remeasurement(jsonb_build_object('company_id','c6000000-0000-4000-8000-000000000001','measurement_id',(select id from public.master_lease_measurements where request_id='s06-remeasure')))$test$,'remeasurement posts through canonical GL');
select is(pg_temp.s06_account_net('c6000000-0000-4000-8000-000000000001'::uuid,'1600'),120.000::numeric,'remeasurement raises net ROU to 120');
select lives_ok($test$select public.gl_ml_post_period(jsonb_build_object('company_id','c6000000-0000-4000-8000-000000000001','measurement_id',(select id from public.master_lease_measurements where request_id='s06-remeasure'),'period_no',1,'cash_account_no','1120'))$test$,'first revised period posts');
select is(pg_temp.s06_account_net('c6000000-0000-4000-8000-000000000001'::uuid,'1600'),60.000::numeric,'revised depreciation is rebased to new carrying ROU');
select lives_ok($test$select public.gl_ml_post_sublease_receipt('{"company_id":"c6000000-0000-4000-8000-000000000001","contract_id":"56000000-0000-4000-8000-000000000001","source_id":"s06-sublease","amount":80,"effective_date":"2026-10-01","cash_account_no":"1120"}'::jsonb)$test$,'sublease receipt posts as principal revenue');
select is(pg_temp.s06_account_net('c6000000-0000-4000-8000-000000000001'::uuid,'4000'),-80.000::numeric,'sublease rental revenue is 80 credit');
select is(pg_temp.s06_account_net('c6000000-0000-4000-8000-000000000001'::uuid,'2000'),0.000::numeric,'master lease never touches Owner Funds Payable');
select lives_ok($test$select public.gl_ml_create_remeasurement('{"company_id":"c6000000-0000-4000-8000-000000000001","owner_agreement_id":"26000000-0000-4000-8000-000000000001","request_id":"s06-terminate","effective_date":"2026-10-01","annual_discount_rate_bps":0,"periods_per_year":12,"scope_reduction_bps":10000,"payments":[]}'::jsonb)$test$,'full termination draft is created at posted boundary');
select lives_ok($test$select public.gl_ml_post_remeasurement(jsonb_build_object('company_id','c6000000-0000-4000-8000-000000000001','measurement_id',(select id from public.master_lease_measurements where request_id='s06-terminate')))$test$,'full termination posts');
select is((select status from public.master_lease_measurements where request_id='s06-terminate'),'TERMINATED'::text,'full termination closes lifecycle');
select is(pg_temp.s06_account_net('c6000000-0000-4000-8000-000000000001'::uuid,'1600'),0.000::numeric,'full termination clears net ROU asset');
select is(pg_temp.s06_account_net('c6000000-0000-4000-8000-000000000001'::uuid,'2500'),0.000::numeric,'full termination clears lease liability');

select * from finish();
rollback;
