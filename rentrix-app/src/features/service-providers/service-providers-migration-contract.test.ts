import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../supabase/migrations/20260810170000_service_providers_production_grade.sql",
  ),
  "utf8",
).toLowerCase();
const atomicWritesMigration = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../supabase/migrations/20260810171000_service_provider_atomic_writes.sql",
  ),
  "utf8",
).toLowerCase();
const rollback = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../supabase/rollback/20260810170000_rollback_service_providers_production_grade.sql",
  ),
  "utf8",
).toLowerCase();
const atomicWritesRollback = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../supabase/rollback/20260810171000_rollback_service_provider_atomic_writes.sql",
  ),
  "utf8",
).toLowerCase();

describe("Service Providers database contract", () => {
  it("creates one canonical provider table and normalized maintainable categories", () => {
    expect(migration).toContain("create table public.service_providers");
    expect(migration).toContain(
      "create table public.service_provider_categories",
    );
    expect(migration).toContain(
      "create table public.service_provider_category_links",
    );
    expect(migration).toContain("service_provider_category_links_unique");
    expect(migration).not.toContain("provider_type text not null check");
  });

  it("uses the active-company and semantic-permission architecture on every provider table", () => {
    for (const table of [
      "service_providers",
      "service_provider_categories",
      "service_provider_category_links",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
    expect(migration).toContain(
      "current_user_has_effective_app_permission('service_providers.view')",
    );
    expect(migration).toContain(
      "current_user_has_effective_app_permission('service_providers.write')",
    );
    expect(migration).toContain("company_id = public.current_company_id()");
    expect(migration).toContain(
      "('service_providers.view', 'عرض مزودي الخدمات'",
    );
    expect(migration).toContain(
      "('service_providers.write', 'إضافة وتعديل وأرشفة مزودي الخدمات'",
    );
  });

  it("makes Maintenance assignments company-safe and capability-safe", () => {
    expect(migration).toContain("maintenance_service_provider_company_fk");
    expect(migration).toContain(
      "foreign key (service_provider_id, company_id)",
    );
    expect(migration).toContain(
      "maintenance_service_provider_category_company_fk",
    );
    expect(migration).toContain(
      "validate_maintenance_service_provider_assignment",
    );
    expect(migration).toContain(
      "drop function if exists public.create_maintenance_atomic",
    );
    expect(migration).toContain(
      "p_service_provider_category_id uuid default null",
    );
    expect(migration).toContain("p_service_provider_id uuid default null");
    expect(migration).toContain("service_provider_category_links link");
  });

  it("extends the existing document platform instead of creating provider attachments", () => {
    expect(migration).toContain("'service_provider'");
    expect(migration).toContain("alter table public.vault_documents");
    expect(migration).not.toContain(
      "create table public.service_provider_documents",
    );
    expect(migration).not.toContain(
      "create table public.service_provider_attachments",
    );
  });

  it("records provider master-data changes without storing provider contact PII in audit details", () => {
    expect(migration).toContain("audit_service_provider_change");
    expect(migration).toContain(
      "jsonb_build_object('company_id', v_company_id, 'category_id', v_category_id)",
    );
    expect(migration).not.toContain("jsonb_build_object('email'");
    expect(migration).not.toContain("jsonb_build_object('phone'");
  });

  it("keeps provider and category assignment writes in one server transaction", () => {
    expect(atomicWritesMigration).toContain("save_service_provider_atomic");
    expect(atomicWritesMigration).toContain(
      "current_user_has_effective_app_permission('service_providers.write')",
    );
    expect(atomicWritesMigration).toContain(
      "delete from public.service_provider_category_links",
    );
    expect(atomicWritesMigration).toContain(
      "insert into public.service_provider_category_links",
    );
    expect(atomicWritesMigration).toContain(
      "set search_path = public, pg_temp",
    );
    expect(atomicWritesRollback).toContain(
      "drop function if exists public.save_service_provider_atomic",
    );
  });

  it("ships a manual rollback that restores the prior Maintenance RPC and document contract", () => {
    expect(rollback).toContain("manual rollback");
    expect(rollback).toContain("not auto-applied");
    expect(rollback).toContain(
      "drop table if exists public.service_provider_category_links",
    );
    expect(rollback).toContain("drop column if exists service_provider_id");
    expect(rollback).toContain(
      "create function public.create_maintenance_atomic",
    );
    expect(rollback).not.toContain("p_service_provider_id uuid");
  });
});
