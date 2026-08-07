-- S04-T03 v2 contract lifecycle structure and activation-gate contract tests.
begin;
select plan(17);

select has_column('public','contracts','maker_user_id');
select has_column('public','contracts','checker_user_id');
select has_column('public','contracts','maker_signature');
select has_column('public','contracts','checker_signature');
select has_column('public','contracts','approval_status');
select has_column('public','contracts','submitted_at');
select has_column('public','contracts','approved_at');
select has_column('public','contracts','rejected_at');
select has_column('public','contracts','rejection_reason');
select has_column('public','contracts','approval_evidence');

select has_function('public','submit_contract_for_approval_atomic', array['text','text']);
select has_function('public','approve_contract_atomic', array['text','text']);
select has_function('public','reject_contract_atomic', array['text','text','text']);
select has_function('public','activate_contract_with_agreement_snapshot_atomic', array['text']);

select ok(
  position('MAKER_CHECKER_MUST_BE_DISTINCT' in pg_get_functiondef('public.approve_contract_atomic(text,text)'::regprocedure)) > 0,
  'approval rejects same maker/checker identity'
);

select ok(
  position('CONTRACT_APPROVAL_REQUIRED' in pg_get_functiondef('public.activate_contract_with_agreement_snapshot_atomic(text)'::regprocedure)) > 0,
  'activation is denied until maker-checker approval is complete'
);

select ok(
  position('CONTRACT_SIGNATURE_EVIDENCE_REQUIRED' in pg_get_functiondef('public.activate_contract_with_agreement_snapshot_atomic(text)'::regprocedure)) > 0,
  'activation requires complete maker/checker signature evidence'
);

select * from finish();
rollback;
