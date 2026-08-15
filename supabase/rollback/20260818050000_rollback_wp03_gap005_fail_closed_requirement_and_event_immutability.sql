-- Manual rollback for 20260818050000_wp03_gap005_fail_closed_requirement_and_event_immutability.sql — not auto-applied, run by hand only.

begin;

drop trigger if exists company_onboarding_events_immutable
  on public.company_onboarding_events;

drop function if exists public.guard_company_onboarding_events_immutable();

alter table public.onboarding_requirement_templates
  drop constraint if exists onboarding_required_completion_source_guard;

drop trigger if exists onboarding_requirement_completion_source_normalize
  on public.onboarding_requirement_templates;

drop function if exists public.normalize_onboarding_requirement_completion_source();

commit;
