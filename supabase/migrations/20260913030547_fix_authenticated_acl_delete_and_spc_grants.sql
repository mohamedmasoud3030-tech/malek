-- Fix authenticated ACL: revoke DELETE, restore service_provider_categories writes.
--
-- CONTEXT
-- The out-of-band `20260912065042_fix_missing_authenticated_write_grants`
-- migration (applied directly to production, not present in this repository)
-- granted authenticated INSERT, UPDATE, AND DELETE on 41 tables, including the
-- 15 tables this repository's own `20260912000001`, `20260912000002`, and
-- `20260912000003` migrations had already scoped to INSERT + UPDATE only (no
-- DELETE, by design: the frontend archives via soft `deleted_at` UPDATEs, not
-- hard deletes). That out-of-band grant also omitted
-- `service_provider_categories` entirely, leaving authenticated without
-- INSERT/UPDATE on that table even though it belongs to the same "outer
-- PostgreSQL gate restore" surface as its 12 siblings in `20260912000003`.
--
-- A live production audit on 2026-09-13 confirmed:
--   * 15 tables (automation_rules, communication_records, company_settings,
--     cost_centers, lands, leads, owners, payment_terms_templates,
--     property_owners, service_provider_categories, utility_bills,
--     utility_meters, vault_documents, units, people) had authenticated
--     DELETE where only INSERT + UPDATE was intended.
--   * maintenance_records had authenticated INSERT where only UPDATE was
--     intended (creation is RPC-only via create_maintenance_atomic).
--   * service_provider_categories was missing authenticated INSERT + UPDATE
--     entirely.
--
-- This migration was applied directly to production on 2026-09-13 as
-- `fix_authenticated_acl_delete_and_spc_grants` (version 20260913030547) and
-- verified against the live ACL (information_schema.role_table_grants)
-- immediately afterward: all 15 tables show INSERT+UPDATE with no DELETE,
-- maintenance_records shows UPDATE only with no INSERT/DELETE, anon and
-- service_role privileges were confirmed unaffected, and no RLS, policy,
-- data, function, or application-code change was made.
--
-- This file is added to source control AFTER the fact, using the exact
-- version/timestamp Supabase generated in production
-- (supabase_migrations.schema_migrations.version = '20260913030547'), per the
-- reconciliation precedent already documented in this directory's README.md
-- ("2026-07-18 canonical ledger reconciliation" — planning timestamps are
-- replaced with their exact live versions rather than invented). Because the
-- production ledger already has a row for this exact version, a future
-- `supabase db push` / clean replay against this same database will treat
-- this file as already applied and skip it — it will not re-run and cannot
-- conflict or double-apply.
--
-- Scope: ACL-only. No RLS, policy, data, schema, function, or application
-- code change. Statements below are copied verbatim from the applied
-- production migration.

REVOKE DELETE ON TABLE
  automation_rules,
  communication_records,
  company_settings,
  cost_centers,
  lands,
  leads,
  owners,
  payment_terms_templates,
  property_owners,
  service_provider_categories,
  utility_bills,
  utility_meters,
  vault_documents,
  units,
  people
FROM authenticated;

REVOKE INSERT, DELETE
ON TABLE maintenance_records
FROM authenticated;

GRANT INSERT, UPDATE
ON TABLE service_provider_categories
TO authenticated;
