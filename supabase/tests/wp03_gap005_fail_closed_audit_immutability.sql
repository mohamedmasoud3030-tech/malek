-- =============================================================================
-- WP-03 / GAP-005 follow-up — fail-closed requirement validators + immutable
-- onboarding audit ledger.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

-- 1-3. Required requirements must never silently fall through the completion
-- RPC's NONE/unknown fallback. Optional rows may still be informational.
select throws_ok(
  $$ insert into public.onboarding_requirement_templates
       (code, label_ar, required, waiver_policy, sort_order, completion_source)
     values
       ('test_required_null', 'اختبار مطلوب بلا مصدر', true, 'NON_WAIVABLE', 990, null) $$,
  '23514', null,
  '1. required onboarding requirement rejects NULL completion_source'
);

select throws_ok(
  $$ insert into public.onboarding_requirement_templates
       (code, label_ar, required, waiver_policy, sort_order, completion_source)
     values
       ('test_required_none', 'اختبار مطلوب بلا تحقق', true, 'NON_WAIVABLE', 991, 'NONE') $$,
  '23514', null,
  '2. required onboarding requirement rejects NONE completion_source'
);

select lives_ok(
  $$ insert into public.onboarding_requirement_templates
       (code, label_ar, required, waiver_policy, sort_order, completion_source)
     values
       ('test_optional_none', 'اختبار اختياري', false, 'ADMIN_WAIVABLE', 992, 'NONE') $$,
  '3. optional onboarding requirement may use NONE completion_source'
);

-- 4-6. Audit events are immutable at the database boundary, not merely by API
-- grants. Use table-owner context so the trigger itself is the asserted guard.
insert into public.companies (id, name, slug, currency, is_active)
values ('0c000000-0000-4000-8000-0000000000d1', 'GAP005 Immutable Audit', 'gap005-immutable', 'OMR', true)
on conflict (id) do nothing;

insert into public.company_onboarding_events (
  id, company_id, requirement_code, action, actor, authority, reason
) values (
  '0c000000-0000-4000-8000-000000000ed1',
  '0c000000-0000-4000-8000-0000000000d1',
  null,
  'COMPLETE',
  '0c000000-0000-0000-0000-000000000ad1',
  'ADMIN',
  'fixture'
);

select throws_ok(
  $$ update public.company_onboarding_events
     set reason = 'tampered'
     where id = '0c000000-0000-4000-8000-000000000ed1' $$,
  '55000', 'ONBOARDING_EVENT_IMMUTABLE',
  '4. onboarding audit event UPDATE is rejected by trigger'
);

select throws_ok(
  $$ delete from public.company_onboarding_events
     where id = '0c000000-0000-4000-8000-000000000ed1' $$,
  '55000', 'ONBOARDING_EVENT_IMMUTABLE',
  '5. onboarding audit event DELETE is rejected by trigger'
);

select is(
  (select count(*)::int from public.company_onboarding_events
   where id = '0c000000-0000-4000-8000-000000000ed1'
     and reason = 'fixture'),
  1,
  '6. original onboarding audit evidence remains unchanged'
);

select * from finish();
rollback;
