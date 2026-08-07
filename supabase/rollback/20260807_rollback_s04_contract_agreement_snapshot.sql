-- Manual guarded rollback for 20260807203000_s04_contract_agreement_snapshot.sql.
-- Refuse rollback once any contract carries an agreement-version snapshot.

begin;

do $$ begin
  if exists (select 1 from public.contracts where agreement_version_id is not null) then
    raise exception 'S04_CONTRACT_SNAPSHOT_HISTORY_EXISTS_ROLLBACK_FORBIDDEN' using errcode='55000';
  end if;
end $$;

drop function if exists public.activate_contract_with_agreement_snapshot_atomic(text);
drop trigger if exists contracts_agreement_snapshot_guard on public.contracts;
drop function if exists public.guard_contract_agreement_snapshot();

alter table public.contracts drop constraint if exists contracts_collection_role_snapshot_check;
alter table public.contracts drop constraint if exists contracts_operating_model_snapshot_check;
alter table public.contracts drop column if exists operating_model_snapshot;
alter table public.contracts drop column if exists collection_role_snapshot;
alter table public.contracts drop column if exists agreement_version_id;

commit;
