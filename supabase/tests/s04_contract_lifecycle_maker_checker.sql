-- S04-T03: maker-checker lifecycle tests (pgTAP)
begin;
select plan(8);
select has_column('public','contracts','maker_user_id');
select has_column('public','contracts','checker_user_id');
select has_column('public','contracts','maker_signature');
select has_column('public','contracts','checker_signature');
select has_column('public','contracts','approval_status');
select has_column('public','contracts','approved_at');
select has_column('public','contracts','approval_evidence');
select has_function('public','approve_contract_atomic', array['text','text']);
select has_function('public','reject_contract_atomic', array['text','text','text']);
select * from finish();
rollback;
