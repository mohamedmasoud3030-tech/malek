-- Manual rollback for 20260817110000_wp02_gap010_tax_authority.sql
-- Not auto-applied by Clean Replay / CI. Run by hand only, after an authorized
-- governance decision. Forward-only production history is never edited.

begin;

drop function if exists public.post_taxable_collection_atomic(jsonb);
drop function if exists public.approve_tax_profile_atomic(jsonb);
drop function if exists public.create_tax_profile_atomic(jsonb);
drop function if exists public.compute_tax_amount(numeric, numeric);
drop function if exists public.resolve_active_tax_profile(uuid, date);

drop table if exists public.taxable_line_tax_snapshots;
drop table if exists public.company_tax_profiles;
delete from public.tax_code_catalog where code in ('VAT', 'VAT_ZERO');

commit;
