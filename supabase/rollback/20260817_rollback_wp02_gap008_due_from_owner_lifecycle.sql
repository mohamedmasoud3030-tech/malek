-- Manual rollback for 20260817100000_wp02_gap008_due_from_owner_lifecycle.sql
-- Not auto-applied by Clean Replay / CI. Run by hand only, and only after an
-- authorized governance decision. Forward-only production history is never
-- edited; this script exists solely to undo an undeployed/aborted migration.
--
-- Rollback order: drop dependent objects first, then the source tables.

begin;

drop function if exists public.reverse_owner_receivable_offset_atomic(jsonb);
drop function if exists public.reverse_owner_receivable_recovery_atomic(jsonb);
drop function if exists public.reverse_owner_receivable_atomic(jsonb);
drop function if exists public.offset_owner_receivable_atomic(jsonb);
drop function if exists public.recover_owner_receivable_atomic(jsonb);
drop function if exists public.create_owner_receivable_atomic(jsonb);
drop function if exists public.wp02_gap008_round_omr(numeric);

drop table if exists public.due_from_owner_offsets;
drop table if exists public.due_from_owner_recoveries;
drop table if exists public.due_from_owners;

commit;
