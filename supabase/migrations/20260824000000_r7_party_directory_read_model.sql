-- ============================================================================
-- R7 — Party / People / Owner / Tenant Domain: unified party directory
-- ============================================================================
--
-- Roadmap V2 / R7 (forward-only, no breakage). The target model is:
--
--   Party ─ Identity ─ Contact information ─ Documents ─ Roles
--            (Tenant / Owner / Service Provider / Contact)
--
-- Today identity facts live in TWO tables: public.people (tenant/owner/contact)
-- and public.owners (owner profile with its own identity columns). The legacy
-- name/full_name duplication on owners is already neutralized at the DB level
-- by trg_sync_owner_compatibility_fields (they can never diverge), and
-- property.owner_name is a trigger-maintained projection of the temporal
-- property_owners relation — not an independent identity fact.
--
-- R7 (this stage) establishes the ONE party identity READ MODEL the
-- application can consume today, without the destructive table merge the
-- roadmap defers until it can be its own governed migration:
--
--   public.party_directory (view)
--     one row per party identity with its role set:
--       - owners           → role 'owner'   (owner profile is the party source)
--       - people(tenant)   → role 'tenant'
--       - people(contact)  → role 'contact'
--       - people(owner)    → legacy owner-typed person rows are surfaced with
--         role 'owner_legacy_person' so duplicates are VISIBLE, never hidden.
--
-- Invariants guarded by tests (r7 execution suite):
--   * owners.name can never diverge from owners.full_name (sync trigger),
--   * property_owners stays the temporal ownership authority; owner_name is
--     only a projection of it,
--   * tenant history (contracts → people) survives untouched,
--   * the directory never fabricates identities and is company-isolated
--     through the underlying tables' RLS.
-- ============================================================================

begin;

create or replace view public.party_directory
with (security_invoker = true)
as
select
  'owner:' || o.id::text as party_key,
  o.id::text as source_id,
  'owners'::text as source_table,
  'owner'::text as role,
  coalesce(nullif(btrim(o.display_name), ''), nullif(btrim(o.full_name), ''), o.name) as display_name,
  o.full_name,
  o.phone,
  o.email,
  o.national_id,
  o.company_id,
  o.is_active as active,
  (o.deleted_at is null) as live
from public.owners o
union all
select
  'person:' || p.id::text as party_key,
  p.id::text as source_id,
  'people'::text as source_table,
  case p.type
    when 'tenant' then 'tenant'
    when 'contact' then 'contact'
    -- Legacy owner-typed person rows: visible as their own role so identity
    -- duplication with public.owners is surfaced, never silently merged.
    else 'owner_legacy_person'
  end as role,
  p.full_name as display_name,
  p.full_name,
  p.phone,
  p.email,
  p.national_id,
  p.company_id,
  true as active,
  (p.deleted_at is null) as live
from public.people p;

comment on view public.party_directory is
  'R7 unified party identity read model: one row per identity+role across owners/people. '
  'security_invoker: RLS of the underlying tables applies. Legacy owner-typed person rows '
  'surface as owner_legacy_person so duplication is visible pending the governed Party merge.';

-- The view runs with the caller''s rights (security_invoker) so the underlying
-- RLS policies keep applying; grant plain select.
grant select on public.party_directory to authenticated, service_role;
revoke all on public.party_directory from anon, public;

notify pgrst, 'reload schema';

commit;
