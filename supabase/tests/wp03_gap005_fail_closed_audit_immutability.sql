-- =============================================================================
-- WP-03 / GAP-005 follow-up — fail-closed requirement validators + immutable
-- onboarding audit ledger.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- 1-5. Preserve historical replay for the already-authorized canonical codes,
-- while any new/unknown required code remains fail-closed. This reproduces the
-- shape of 20260818000000's idempotent upsert (completion_source omitted).
select lives_ok(
  $$ insert into public.onboarding_requirement_templates
       (code, label_ar, required, waiver_policy, sort_order)
     values ('owner', 'إضافة أول مالك', true, 'NON_WAIVABLE', 1)
     on conflict (code) do update
       set label_ar = excluded.label_ar,
           required = excluded.required,
           waiver_policy = excluded.waiver_policy,
           sort_order = excluded.sort_order $$,
  '1. historical canonical upsert without completion_source remains replay-safe'
);

select is(
  (select completion_source from public.onboarding_requirement_templates where code = 'owner'),
  'OWNER_EXISTS',
  '2. canonical owner mapping remains server-verifiable after replay-shaped upsert'
);

select throws_ok(
  $$ insert into public.onboarding_requirement_templates
       (code, label_ar, required, waiver_policy, sort_order, completion_source)
     values
       ('test_required_null', 'اختبار مطلوب بلا مصدر', true, 'NON_WAIVABLE', 990, null) $$,
  '23514', null,
  '3. unknown required onboarding requirement rejects NULL completion_source'
);

select throws_ok(
  $$ insert into public.onboarding_requirement_templates
       (code, label_ar, required, waiver_policy, sort_order, completion_source)
     values
       ('test_required_none', 'اختبار مطلوب بلا تحقق', true, 'NON_WAIVABLE', 991, 'NONE') $$,
  '23514', null,
  '4. unknown required onboarding requirement rejects NONE completion_source'
);

select lives_ok(
  $$ insert into public.onboarding_requirement_templates
       (code, label_ar, required, waiver_policy, sort_order, completion_source)
     values
       ('test_optional_none', 'اختبار اختياري', false, 'ADMIN_WAIVABLE', 992, 'NONE') $$,
  '5. optional onboarding requirement may use NONE completion_source'
);

-- 6-8. Audit events are immutable at the database boundary, not merely by API
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
  '6. onboarding audit event UPDATE is rejected by trigger'
);

select throws_ok(
  $$ delete from public.company_onboarding_events
     where id = '0c000000-0000-4000-8000-000000000ed1' $$,
  '55000', 'ONBOARDING_EVENT_IMMUTABLE',
  '7. onboarding audit event DELETE is rejected by trigger'
);

select is(
  (select count(*)::int from public.company_onboarding_events
   where id = '0c000000-0000-4000-8000-000000000ed1'
     and reason = 'fixture'),
  1,
  '8. original onboarding audit evidence remains unchanged'
);

select * from finish();
rollback;
