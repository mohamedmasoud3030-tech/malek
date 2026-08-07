-- Manual guarded rollback for 20260807200000_s04_owner_agreement_versioning.sql.
--
-- This rollback is intentionally fail-closed after a second version exists.
-- Dropping the version stream after production version history has started
-- would destroy contractual evidence.

begin;

do $$
begin
  if to_regclass('public.owner_agreement_versions') is not null
     and exists (
       select 1
       from public.owner_agreement_versions
       where version_no > 1
     ) then
    raise exception 'S04_VERSION_HISTORY_EXISTS_ROLLBACK_FORBIDDEN'
      using errcode = '55000';
  end if;
end
$$;

drop function if exists public.create_owner_agreement_version_atomic(uuid,jsonb);

alter table public.owner_agreements
  drop constraint if exists owner_agreements_current_version_fkey;

alter table public.owner_agreements
  drop column if exists current_version_id;

drop table if exists public.owner_agreement_versions;

commit;
