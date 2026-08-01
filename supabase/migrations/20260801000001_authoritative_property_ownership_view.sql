-- ============================================================================
-- 20260801000001_authoritative_property_ownership_view.sql
-- Purpose: Establish one authoritative property-ownership model by providing
-- a canonical view (public.current_property_ownership) that reconciles legal
-- ownership (property_owners) with management agreements (owner_agreements).
--
-- Authoritative Model Rules:
-- 1. property_owners: legal/economic ownership and ownership percentages over time.
-- 2. owner_agreements: property-management agreement between office and owner.
-- 3. properties.owner_id: backward-compatibility reference maintained by trigger;
--    never treated as an independent source of truth.
--
-- Grants & Security:
-- - View is created with (security_invoker = true) so PostgreSQL enforces the
--   calling user's RLS policies on properties, property_owners, and owners.
-- - View is granted to authenticated and service_role.
--
-- Rollback: supabase/rollback/20260801_rollback_authoritative_property_ownership_view.sql
-- ============================================================================

begin;

create or replace view public.current_property_ownership
with (security_invoker = true)
as
select
  pr.id as property_id,
  pr.title as property_title,
  pr.company_id as company_id,
  po.id as property_owner_id,
  po.owner_id as owner_id,
  coalesce(nullif(btrim(o.display_name), ''), nullif(btrim(o.full_name), ''), o.name) as owner_name,
  po.ownership_percentage as ownership_percentage,
  po.is_primary as is_primary,
  po.starts_on as ownership_starts_on,
  po.ends_on as ownership_ends_on,
  oa.id as agreement_id,
  oa.agreement_type as agreement_type,
  oa.commission_type as commission_type,
  oa.commission_value as commission_value,
  oa.starts_on as agreement_starts_on,
  oa.ends_on as agreement_ends_on
from public.properties pr
join public.property_owners po on po.property_id = pr.id
join public.owners o on o.id = po.owner_id
left join public.owner_agreements oa
  on oa.property_id = pr.id
 and oa.owner_id = po.owner_id
 and (oa.starts_on is null or oa.starts_on <= current_date)
 and (oa.ends_on is null or oa.ends_on >= current_date)
where pr.deleted_at is null
  and o.deleted_at is null
  and o.is_active
  and (po.starts_on is null or po.starts_on <= current_date)
  and (po.ends_on is null or po.ends_on >= current_date);

comment on view public.current_property_ownership is
  'Canonical view resolving active property ownership (property_owners) and management agreement (owner_agreements) per property as of CURRENT_DATE.';

grant select on public.current_property_ownership to authenticated, service_role;

commit;
