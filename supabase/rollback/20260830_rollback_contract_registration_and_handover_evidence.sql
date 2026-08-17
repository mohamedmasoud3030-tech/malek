-- Manual emergency rollback — not auto-applied; run by hand only after review.
-- Rollback for: 20260830010000_contract_registration_and_handover_evidence.sql
-- Safe only before real registration/inspection evidence exists; otherwise retain history and use a forward correction.

begin;

do $$
begin
  if exists(select 1 from public.contract_registration_records limit 1)
     or exists(select 1 from public.contract_inspections limit 1) then
    raise exception 'Rollback blocked: contract evidence exists. Preserve history and use a forward migration.';
  end if;
end $$;

drop function if exists public.create_deposit_application_claim_with_inspection_atomic(jsonb);
do $$ begin
  if to_regprocedure('public.create_deposit_application_claim_atomic(jsonb)') is not null then
    execute 'grant execute on function public.create_deposit_application_claim_atomic(jsonb) to authenticated';
  end if;
end $$;
do $$ begin
  if to_regclass('public.deposit_application_claims') is not null then
    drop index if exists public.deposit_application_claims_inspection_idx;
    alter table public.deposit_application_claims drop column if exists inspection_id;
  end if;
end $$;

drop function if exists public.review_contract_inspection_atomic(jsonb);
drop function if exists public.complete_contract_inspection_atomic(jsonb);
drop function if exists public.save_contract_inspection_draft_atomic(jsonb);
drop function if exists public.contract_inspection_validate_checklist(jsonb,jsonb,boolean);
drop function if exists public.decide_contract_registration_atomic(jsonb);
drop function if exists public.submit_contract_registration_atomic(jsonb);
drop function if exists public.get_contract_evidence_state(uuid);
drop function if exists public.contract_evidence_assert_documents(uuid,uuid,uuid[]);
drop function if exists public.contract_evidence_actor_can_verify();
drop function if exists public.contract_evidence_actor_can_operate();

drop table if exists public.contract_evidence_events;
drop table if exists public.contract_inspections;
drop table if exists public.contract_inspection_templates;
drop table if exists public.contract_registration_records;
drop table if exists public.contract_registration_requirement_profiles;

commit;
