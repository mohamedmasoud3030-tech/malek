-- WP-03 / GAP-005 follow-up hardening.
--
-- Closes two residual authority/audit defects after PR #1467:
--   1. A future required onboarding requirement could be created with a NULL or
--      NONE completion_source. complete_company_onboarding_atomic() treats
--      unrecognised/NONE sources as satisfied, so that shape would fail open.
--      Required requirements must now carry an explicit server-verifiable
--      completion source. Optional requirements may still use NONE.
--   2. company_onboarding_events was described as append-only but immutability
--      was enforced only by API grants. A privileged/service write could still
--      UPDATE or DELETE history. A table trigger now makes the ledger immutable
--      at the database boundary for every normal SQL role, including
--      service_role paths.
--
-- DP-5 remains open: this migration does not invent the canonical seven-step
-- catalog or property-level safety evidence. It only guarantees that any future
-- required step cannot silently become satisfied without an explicit validator.
--
-- Rollback:
-- supabase/rollback/20260818050000_rollback_wp03_gap005_fail_closed_requirement_and_event_immutability.sql

begin;

-- Every REQUIRED requirement must have a concrete server-side validator.
-- PostgreSQL CHECK constraints accept UNKNOWN/NULL, so the IS NOT NULL clause
-- is intentional: without it a required row with NULL completion_source would
-- still pass the constraint and recreate the fail-open path.
alter table public.onboarding_requirement_templates
  drop constraint if exists onboarding_required_completion_source_guard;

alter table public.onboarding_requirement_templates
  add constraint onboarding_required_completion_source_guard
  check (
    not required
    or (
      completion_source is not null
      and completion_source in (
        'OWNER_EXISTS',
        'PROPERTY_EXISTS',
        'UNIT_EXISTS',
        'CONTRACT_EXISTS',
        'INVOICE_EXISTS'
      )
    )
  );

-- Database-enforced append-only audit ledger.
create or replace function public.guard_company_onboarding_events_immutable()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  raise exception 'ONBOARDING_EVENT_IMMUTABLE'
    using errcode = '55000';
end;
$function$;

revoke all on function public.guard_company_onboarding_events_immutable()
  from public, anon, authenticated;

drop trigger if exists company_onboarding_events_immutable
  on public.company_onboarding_events;

create trigger company_onboarding_events_immutable
before update or delete on public.company_onboarding_events
for each row execute function public.guard_company_onboarding_events_immutable();

commit;
