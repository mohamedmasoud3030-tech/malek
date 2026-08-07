-- Rollback for S04-T03: maker-checker lifecycle.
-- Guarded: refuse to remove columns if any contract has approval_status = 'APPROVED'

begin;

do $$
declare
  v_approved_count integer;
begin
  select count(*) into v_approved_count
  from public.contracts
  where approval_status = 'APPROVED';

  if v_approved_count > 0 then
    raise exception 'ROLLBACK_REFUSED_APPROVED_CONTRACTS_EXIST: % approved contracts would lose evidence', v_approved_count
      using errcode = '22023';
  end if;

  drop function if exists public.approve_contract_atomic(text, text);
  drop function if exists public.reject_contract_atomic(text, text, text);

  alter table if exists public.contracts drop constraint if exists contracts_maker_checker_distinct_chk;
  alter table if exists public.contracts
    drop column if exists approval_evidence,
    drop column if exists approved_at,
    drop column if exists approval_status,
    drop column if exists checker_signature,
    drop column if exists maker_signature,
    drop column if exists checker_user_id,
    drop column if exists maker_user_id;
end
$$;

commit;
