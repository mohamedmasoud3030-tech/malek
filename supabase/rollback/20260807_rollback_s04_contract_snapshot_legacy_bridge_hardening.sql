-- Manual rollback note for 20260807203500_s04_contract_snapshot_legacy_bridge_hardening.sql.
--
-- This hardening can create contractual version/snapshot evidence from legacy
-- rows. Such evidence must never be deleted to simulate rollback. The parent
-- T02 rollback is already fail-closed whenever any contract snapshot exists.
-- If no snapshot/version history was created, rolling back the parent T02
-- migration removes the helper and snapshot schema. Otherwise remediation must
-- be forward-only.

begin;

do $$ begin
  if exists (select 1 from public.contracts where agreement_version_id is not null)
     or exists (select 1 from public.owner_agreement_versions where version_no > 1) then
    raise exception 'S04_LEGACY_BRIDGE_HISTORY_EXISTS_ROLLBACK_FORBIDDEN' using errcode='55000';
  end if;
end $$;

-- No destructive DML: version rows and contractual snapshots are evidence.
-- Function/schema removal is owned by the guarded parent T02 rollback.

commit;
