begin;

drop trigger if exists contracts_workflow_invariants on public.contracts;
drop function if exists public.enforce_contract_workflow_invariants();

-- update_contract_atomic remains hardened because restoring a cross-company
-- lookup and response path is not a safe rollback.

commit;
