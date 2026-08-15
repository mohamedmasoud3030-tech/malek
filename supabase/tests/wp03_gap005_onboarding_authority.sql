-- =============================================================================
-- WP-03 / GAP-005 — Authoritative, backend-driven company onboarding state.
-- Canonical rules: OPS-004, DOM-002, DOM-003; locked decision D12.
-- Proves: templates exist; state is company-scoped; NON_WAIVABLE identity/
-- authority gates fail closed; ADMIN_WAIVABLE steps require an admin + reason;
-- completion is a single audited company fact; cross-company isolation.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

insert into public.companies (id, name, slug, currency, is_active) values
  ('0a000000-0000-4000-8000-0000000000d1', 'GAP005 Company A', 'gap005-a', 'OMR', true),
  ('0b000000-0000-4000-8000-0000000000d1', 'GAP005 Company B', 'gap005-b', 'OMR', true)
on conflict (id) do update set is_active = true;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
  ('0a000000-0000-0000-0000-000000000dd1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap005-admin@test.invalid', 'x', now(), now(), now(), '{}', '{}'),
  ('0a000000-0000-0000-0000-000000000dd2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap005-manager@test.invalid', 'x', now(), now(), now(), '{}', '{}'),
  ('0b000000-0000-0000-0000-000000000dd1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gap005-b@test.invalid', 'x', now(), now(), now(), '{}', '{}')
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active) values
  ('0a000000-0000-0000-0000-000000000dd1', 'gap005-admin@test.invalid', 'GAP005 Admin', 'ADMIN', 'ACTIVE', true),
  ('0a000000-0000-0000-0000-000000000dd2', 'gap005-manager@test.invalid', 'GAP005 Manager', 'MANAGER', 'ACTIVE', true),
  ('0b000000-0000-0000-0000-000000000dd1', 'gap005-b@test.invalid', 'GAP005 B', 'ADMIN', 'ACTIVE', true)
on conflict (id) do update set role='ADMIN', status='ACTIVE', is_active=true;

insert into public.company_members (company_id, user_id, role) values
  ('0a000000-0000-4000-8000-0000000000d1', '0a000000-0000-0000-0000-000000000dd1', 'ADMIN'),
  ('0a000000-0000-4000-8000-0000000000d1', '0a000000-0000-0000-0000-000000000dd2', 'MANAGER'),
  ('0b000000-0000-4000-8000-0000000000d1', '0b000000-0000-0000-0000-000000000dd1', 'ADMIN')
on conflict (company_id, user_id) do update set role='ADMIN';

-- ── Structure ────────────────────────────────────────────────────────────────
select has_table('public', 'onboarding_requirement_templates', 'templates table');
select has_table('public', 'company_onboarding_waivers', 'waivers table');
select has_table('public', 'company_onboarding_completion', 'completion table');
select has_function('public', 'get_company_onboarding_state', array[]::text[]);
select has_function('public', 'waive_onboarding_requirement_atomic', array['text','text','text']);
select has_function('public', 'complete_company_onboarding_atomic', array[]::text[]);

-- ── Admin context for company A ──────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000dd1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000d1"}}', true);
set local role authenticated;

-- ── 1. Fresh company sees the seeded operating order, nothing waived/completed
select is(
  (select jsonb_array_length((public.get_company_onboarding_state()->'requirements')))::int,
  5,
  '1. fresh company receives the 5 seeded requirement templates'
);
select is(
  (public.get_company_onboarding_state()->'completed')::boolean,
  false,
  '2. fresh company is not completed'
);

-- ── 2. NON_WAIVABLE identity/authority gates fail closed
select throws_ok(
  $$ select public.waive_onboarding_requirement_atomic('owner', 'نحتاج تخطيها') $$,
  '23514', null,
  '3. owner (identity) gate is NON_WAIVABLE'
);
select throws_ok(
  $$ select public.waive_onboarding_requirement_atomic('property', 'نحتاج تخطيها') $$,
  '23514', null,
  '4. property (authority) gate is NON_WAIVABLE'
);

-- ── 3. ADMIN_WAIVABLE requires admin + reason
select throws_ok(
  $$ select public.waive_onboarding_requirement_atomic('unit', '   ') $$,
  '22023', null,
  '5. blank waiver reason is rejected'
);
select lives_ok(
  $$ select public.waive_onboarding_requirement_atomic('unit', 'الوحدة تُدار عبر نظام خارجي', 'ext-ref-1') $$,
  '6. admin waives an ADMIN_WAIVABLE step with a reason + evidence'
);
select is(
  (public.get_company_onboarding_state()->'requirements'->2->>'waived'),
  'true',
  '7. waived step is reported as waived'
);
select is(
  (public.get_company_onboarding_state()->'requirements'->2->>'waiver_authority'),
  'ADMIN',
  '8. waiver records the granting authority'
);

-- ── 4. Non-admin cannot waive
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000dd2","role":"authenticated","app_metadata":{"user_role":"MANAGER","company_id":"0a000000-0000-4000-8000-0000000000d1"}}', true);
select throws_ok(
  $$ select public.waive_onboarding_requirement_atomic('contract', 'تخطي') $$,
  '42501', null,
  '9. non-admin waiver is rejected'
);

-- ── 5. Completion is a single audited company fact
select set_config('request.jwt.claims', '{"sub":"0a000000-0000-0000-0000-000000000dd1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0a000000-0000-4000-8000-0000000000d1"}}', true);
select lives_ok(
  $$ select public.complete_company_onboarding_atomic() $$,
  '10. admin records onboarding completion'
);
select is(
  (public.get_company_onboarding_state()->'completed')::boolean,
  true,
  '11. completion is visible as a company-scoped fact'
);

-- ── 6. Waiver revoke restores a step; reset clears both
select lives_ok(
  $$ select public.revoke_onboarding_waiver_atomic('unit') $$,
  '12. admin revokes a waiver'
);
select is(
  (public.get_company_onboarding_state()->'requirements'->2->>'waived'),
  'false',
  '13. revoked waiver is cleared'
);
select lives_ok(
  $$ select public.reset_company_onboarding_atomic() $$,
  '14. admin resets onboarding state'
);
select is(
  (public.get_company_onboarding_state()->'completed')::boolean,
  false,
  '15. reset clears completion'
);

-- ── 7. Cross-company isolation
select set_config('request.jwt.claims', '{"sub":"0b000000-0000-0000-0000-000000000dd1","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"0b000000-0000-4000-8000-0000000000d1"}}', true);
select is(
  (public.get_company_onboarding_state()->'company_id')::text,
  '0b000000-0000-4000-8000-0000000000d1',
  '16. company B state resolves to company B'
);
select is(
  (public.get_company_onboarding_state()->'completed')::boolean,
  false,
  '17. company B does not inherit company A completion'
);
select is(
  (public.get_company_onboarding_state()->'requirements'->2->>'waived'),
  'false',
  '18. company B does not inherit company A waivers'
);

select * from finish();
rollback;
