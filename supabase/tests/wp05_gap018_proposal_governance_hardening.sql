-- =============================================================================
-- WP-05 GAP-018 — proposal governance hardening behavioral proof
-- =============================================================================
begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into public.companies (id, name, slug, currency, is_active)
values
  ('c0000000-0000-4000-8000-000000000190', 'WP05 Hardening A', 'wp05-hardening-a', 'OMR', true),
  ('d0000000-0000-4000-8000-000000000191', 'WP05 Hardening B', 'wp05-hardening-b', 'OMR', true)
on conflict (id) do update set is_active = true;

select lives_ok(
  $$ select public.provision_company_chart_of_accounts('c0000000-0000-4000-8000-000000000190') $$,
  '1. provision company A chart'
);
select lives_ok(
  $$ select public.provision_company_chart_of_accounts('d0000000-0000-4000-8000-000000000191') $$,
  '2. provision company B chart'
);

insert into public.accounting_periods (id, company_id, name, start_date, end_date, status)
values
  ('c1000000-0000-4000-8000-000000000190', 'c0000000-0000-4000-8000-000000000190', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN'),
  ('d1000000-0000-4000-8000-000000000191', 'd0000000-0000-4000-8000-000000000191', '2026-07', date '2026-07-01', date '2026-07-31', 'OPEN')
on conflict (id) do update set status = 'OPEN';

insert into auth.users (id, email, raw_app_meta_data)
values
  ('c0a00000-0000-4000-8000-000000000190', 'wp05-hardening-maker@example.com', '{}'::jsonb),
  ('c0c00000-0000-4000-8000-000000000190', 'wp05-hardening-checker@example.com', '{}'::jsonb)
on conflict (id) do nothing;

insert into public.users (id, email, name, role, status, is_active)
values
  ('c0a00000-0000-4000-8000-000000000190', 'wp05-hardening-maker@example.com', 'WP05 Hardening Maker', 'MANAGER', 'ACTIVE', true),
  ('c0c00000-0000-4000-8000-000000000190', 'wp05-hardening-checker@example.com', 'WP05 Hardening Checker', 'ACCOUNTANT', 'ACTIVE', true)
on conflict (id) do update set role = excluded.role, status = 'ACTIVE', is_active = true;

insert into public.company_members (company_id, user_id, role, is_active)
values
  ('c0000000-0000-4000-8000-000000000190', 'c0a00000-0000-4000-8000-000000000190', 'MEMBER', true),
  ('c0000000-0000-4000-8000-000000000190', 'c0c00000-0000-4000-8000-000000000190', 'MEMBER', true)
on conflict do nothing;

insert into public.owners (id, full_name, company_id, is_active)
values ('c2200000-0000-4000-8000-000000000190', 'WP05 Hardening Owner', 'c0000000-0000-4000-8000-000000000190', true)
on conflict (id) do update set is_active = true;

insert into public.owner_balances (owner_id, company_id, total_income, total_expenses, commission, net_balance, updated_at)
values ('c2200000-0000-4000-8000-000000000190', 'c0000000-0000-4000-8000-000000000190', 100.000, 0, 0, 100.000, now())
on conflict (owner_id) do update set total_income = 100.000, total_expenses = 0, commission = 0, net_balance = 100.000;

-- Maker raises the initial owner-payables finding.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0a00000-0000-4000-8000-000000000190","role":"authenticated","app_metadata":{"user_role":"MANAGER","company_id":"c0000000-0000-4000-8000-000000000190"}}', true);

select lives_ok(
  $$ select public.wp05_generate_correction_proposals(date '2026-07-31', 'wp05-hardening-run', 'c1000000-0000-4000-8000-000000000190') $$,
  '3. maker raises initial proposal'
);

select is(
  (select count(*)::int from public.wp05_correction_proposals where company_id = 'c0000000-0000-4000-8000-000000000190' and reconciliation_class = 'OWNER_PAYABLES' and status = 'PENDING_APPROVAL'),
  1,
  '4. exactly one active pending owner-payables proposal exists'
);

select is(
  (select variance_amount from public.wp05_correction_proposals where company_id = 'c0000000-0000-4000-8000-000000000190' and reconciliation_class = 'OWNER_PAYABLES' and status = 'PENDING_APPROVAL'),
  100.000::numeric,
  '5. initial proposal freezes the 100.000 variance'
);

-- Underlying evidence changes before checker approval.
reset role;
update public.owner_balances
set total_income = 120.000, net_balance = 120.000, updated_at = now()
where owner_id = 'c2200000-0000-4000-8000-000000000190';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0c00000-0000-4000-8000-000000000190","role":"authenticated","app_metadata":{"user_role":"ACCOUNTANT","company_id":"c0000000-0000-4000-8000-000000000190"}}', true);

select throws_ok(
  $$ select public.wp05_approve_correction_proposal(
       (select id from public.wp05_correction_proposals where reconciliation_class = 'OWNER_PAYABLES' and status = 'PENDING_APPROVAL'),
       'approve stale finding') $$,
  '23514',
  'WP05_PROPOSAL_STALE: diagnosis changed after proposal creation; regenerate before approval',
  '6. stale proposal cannot be approved'
);

-- Re-run the SAME request id after drift. Old pending row must be retained as
-- SUPERSEDED and the new finding becomes the only active pending row.
select set_config('request.jwt.claims', '{"sub":"c0a00000-0000-4000-8000-000000000190","role":"authenticated","app_metadata":{"user_role":"MANAGER","company_id":"c0000000-0000-4000-8000-000000000190"}}', true);

select lives_ok(
  $$ select public.wp05_generate_correction_proposals(date '2026-07-31', 'wp05-hardening-run', 'c1000000-0000-4000-8000-000000000190') $$,
  '7. changed diagnosis can regenerate under the same request id'
);

select is(
  (select count(*)::int from public.wp05_correction_proposals where company_id = 'c0000000-0000-4000-8000-000000000190' and reconciliation_class = 'OWNER_PAYABLES' and status = 'SUPERSEDED'),
  1,
  '8. old pending finding is retained as SUPERSEDED'
);

select is(
  (select count(*)::int from public.wp05_correction_proposals where company_id = 'c0000000-0000-4000-8000-000000000190' and reconciliation_class = 'OWNER_PAYABLES' and status = 'PENDING_APPROVAL'),
  1,
  '9. only one refreshed pending finding remains active'
);

select is(
  (select variance_amount from public.wp05_correction_proposals where company_id = 'c0000000-0000-4000-8000-000000000190' and reconciliation_class = 'OWNER_PAYABLES' and status = 'PENDING_APPROVAL'),
  120.000::numeric,
  '10. refreshed proposal freezes the new 120.000 variance'
);

reset role;
select ok(
  (select count(*)::int from public.audit_log where action = 'WP05_PROPOSAL_SUPERSEDED') >= 1,
  '11. superseding a stale pending proposal emits an audit event'
);

-- Current refreshed finding can be approved by the independent checker.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c0c00000-0000-4000-8000-000000000190","role":"authenticated","app_metadata":{"user_role":"ACCOUNTANT","company_id":"c0000000-0000-4000-8000-000000000190"}}', true);

select lives_ok(
  $$ select public.wp05_approve_correction_proposal(
       (select id from public.wp05_correction_proposals where reconciliation_class = 'OWNER_PAYABLES' and status = 'PENDING_APPROVAL'),
       'current evidence approved') $$,
  '12. current refreshed proposal can be approved'
);

select is(
  (select count(*)::int from public.wp05_correction_proposals where company_id = 'c0000000-0000-4000-8000-000000000190' and reconciliation_class = 'OWNER_PAYABLES' and status = 'APPROVED'),
  1,
  '13. approved proposal is terminal evidence'
);

-- SECURITY DEFINER proof RPC must not use the function-owner current_user as a
-- tenant bypass. A company A actor cannot explicitly inspect company B.
select throws_ok(
  $$ select public.wp05_assert_no_unapproved_correction_postings('d0000000-0000-4000-8000-000000000191') $$,
  '42501',
  'WP05_COMPANY_ISOLATION_VIOLATION',
  '14. proof RPC blocks explicit cross-company access for authenticated caller'
);

select results_eq(
  $$ select (public.wp05_assert_no_unapproved_correction_postings('c0000000-0000-4000-8000-000000000190')->>'success')::boolean $$,
  $$ values (true::boolean) $$,
  '15. proof RPC still works for the caller company'
);

-- A selected period must contain the diagnostic cut-off date.
select set_config('request.jwt.claims', '{"sub":"c0a00000-0000-4000-8000-000000000190","role":"authenticated","app_metadata":{"user_role":"MANAGER","company_id":"c0000000-0000-4000-8000-000000000190"}}', true);
select throws_ok(
  $$ select public.wp05_generate_correction_proposals(date '2026-08-31', 'wp05-hardening-bad-period', 'c1000000-0000-4000-8000-000000000190') $$,
  '23514',
  null,
  '16. proposal as_of cannot be attached to an accounting period that does not contain it'
);

-- Even a privileged direct insert cannot forge an already-approved proposal.
reset role;
select throws_ok(
  $$ insert into public.wp05_correction_proposals (
       company_id, accounting_period_id, as_of, reconciliation_class, account_no,
       reason_code, reason_detail, proposal_type, recommended_action, status,
       subledger_balance, gl_balance, variance_amount, evidence,
       maker_user_id, checker_user_id, decided_at, request_id, idempotency_key
     ) values (
       'c0000000-0000-4000-8000-000000000190', 'c1000000-0000-4000-8000-000000000190', date '2026-07-31',
       'OWNER_PAYABLES', '2000', 'GL_NO_POSTINGS_FOR_ACCOUNT', 'forged', 'MISSING_GL_POSTING', 'forged', 'APPROVED',
       1, 0, 1, '{}'::jsonb,
       'c0a00000-0000-4000-8000-000000000190', 'c0c00000-0000-4000-8000-000000000190', now(),
       'wp05-forged', 'wp05-forged-key'
     ) $$,
  '42501',
  'WP05_PROPOSAL_INITIAL_STATE_INVALID: proposals must be created PENDING_APPROVAL',
  '17. pre-approved proposal injection is blocked'
);

-- The internal lifecycle GUC cannot be abused to rewrite frozen finding text.
select set_config('malik.wp05_proposal_change_authorized', 'true', true);
select throws_ok(
  $$ update public.wp05_correction_proposals
     set reason_detail = 'tampered after decision'
     where company_id = 'c0000000-0000-4000-8000-000000000190'
       and reconciliation_class = 'OWNER_PAYABLES'
       and status = 'APPROVED' $$,
  '42501',
  'WP05_PROPOSAL_IMMUTABLE_FIELD: period and finding metadata are immutable evidence',
  '18. internal authorization GUC cannot mutate frozen finding metadata'
);
select set_config('malik.wp05_proposal_change_authorized', 'false', true);

select * from finish();
rollback;
