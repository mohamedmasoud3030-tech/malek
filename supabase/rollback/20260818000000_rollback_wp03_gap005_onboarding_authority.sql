-- Manual rollback for 20260818000000_wp03_gap005_onboarding_authority.sql
-- Not auto-applied by Clean Replay / CI. Run by hand only, after an authorized
-- governance decision. Forward-only production history is never edited.

begin;

drop function if exists public.get_company_onboarding_state();
drop function if exists public.waive_onboarding_requirement_atomic(text, text, text);
drop function if exists public.revoke_onboarding_waiver_atomic(text);
drop function if exists public.complete_company_onboarding_atomic();
drop function if exists public.reset_company_onboarding_atomic();

drop table if exists public.company_onboarding_completion;
drop table if exists public.company_onboarding_waivers;
drop table if exists public.onboarding_requirement_templates;

commit;
