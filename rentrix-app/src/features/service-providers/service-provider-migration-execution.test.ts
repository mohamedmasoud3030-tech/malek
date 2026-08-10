import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const COMPANY_A = "10000000-0000-4000-8000-00000000000a";
const COMPANY_B = "10000000-0000-4000-8000-00000000000b";
const USER_ID = "10000000-0000-4000-8000-000000000001";

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create role anon;
    create role authenticated;
    create role service_role;
    create function auth.uid() returns uuid language sql stable as $$ select '${USER_ID}'::uuid $$;
    create table public.companies(id uuid primary key);
    create table public.users(id uuid primary key, role text);
    create table public.user_permission_grants(id uuid default gen_random_uuid(), company_id uuid, user_id uuid, permission text, revoked_at timestamptz);
    create table public.permission_requests(id uuid default gen_random_uuid(), permission text, status text, decision_reason text, decided_at timestamptz, updated_at timestamptz);
    create table public.app_permission_catalog(permission text primary key, label_ar text not null, admin_only boolean not null default false, requestable boolean not null default true);
    create table public.audit_log(id uuid primary key default gen_random_uuid(), ts bigint, user_id uuid, action text, entity text, entity_id text, note text, "table" text, details text, created_at timestamptz default now());
    create function public.current_company_id() returns uuid language sql stable as $$ select nullif(current_setting('app.company_id', true), '')::uuid $$;
    create function public.require_company_id() returns uuid language sql stable as $$ select public.current_company_id() $$;
    create function public.current_user_has_effective_app_permission(text) returns boolean language sql stable as $$ select true $$;
    create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
    create function public.role_has_app_permission(text,text) returns boolean language sql stable as $$ select true $$;
    create table public.properties(id text primary key, company_id uuid, deleted_at timestamptz);
    create table public.units(id text primary key, property_id text, company_id uuid, deleted_at timestamptz);
    create table public.maintenance_records(
      id uuid primary key default gen_random_uuid(), company_id uuid, property_id text, unit_id text,
      title text, description text, priority text, assigned_to text, technician_name text,
      scheduled_date date, attachment_url text, request_id text, status text, request_date date,
      deleted_at timestamptz, updated_at timestamptz, created_at timestamptz, reference text
    );
    create table public.vault_documents(id uuid primary key, related_entity_type text, related_entity_id text, updated_at timestamptz);
    create function public.create_maintenance_atomic(text,text,text,text,text,text,text,date,text,text)
      returns jsonb language sql as $$ select '{}'::jsonb $$;
    insert into public.companies(id) values('${COMPANY_A}'),('${COMPANY_B}');
  `);
  for (const file of [
    "../../../../supabase/migrations/20260810170000_service_providers_production_grade.sql",
    "../../../../supabase/migrations/20260810171000_service_provider_atomic_writes.sql",
  ]) {
    await db.exec(readFileSync(resolve(import.meta.dirname, file), "utf8"));
  }
  await db.exec(`
    select set_config('app.company_id','${COMPANY_A}',false);
    insert into public.service_provider_categories(id,company_id,name)
      values('20000000-0000-4000-8000-00000000000a','${COMPANY_A}','HVAC A'),
            ('20000000-0000-4000-8000-00000000001a','${COMPANY_A}','Plumbing A'),
            ('20000000-0000-4000-8000-00000000000b','${COMPANY_B}','HVAC B');
    insert into public.service_providers(id,company_id,name)
      values('30000000-0000-4000-8000-00000000000a','${COMPANY_A}','Provider A'),
            ('30000000-0000-4000-8000-00000000000b','${COMPANY_B}','Provider B');
    insert into public.service_provider_category_links(company_id,service_provider_id,category_id)
      values('${COMPANY_A}','30000000-0000-4000-8000-00000000000a','20000000-0000-4000-8000-00000000000a'),
            ('${COMPANY_B}','30000000-0000-4000-8000-00000000000b','20000000-0000-4000-8000-00000000000b');
    insert into public.properties(id,company_id) values('property-a','${COMPANY_A}');
    insert into public.maintenance_records(id,company_id,property_id,title,priority,status)
      values('40000000-0000-4000-8000-00000000000a','${COMPANY_A}','property-a','Job A','medium','open');
  `);
}, 30_000);

afterAll(async () => db.close());

describe("Service Provider migration execution", () => {
  it("applies both forward migrations and registers the canonical permissions", async () => {
    const result = await db.query<{ permission: string }>(
      `select permission from public.app_permission_catalog where permission like 'service_providers.%' order by permission`,
    );
    expect(result.rows.map((row) => row.permission)).toEqual([
      "service_providers.view",
      "service_providers.write",
    ]);
  });

  it("enforces active-company RLS for reads and writes", async () => {
    await db.exec(
      `select set_config('app.company_id','${COMPANY_A}',false); set role authenticated;`,
    );
    try {
      const visible = await db.query<{ name: string }>(
        "select name from public.service_providers order by name",
      );
      expect(visible.rows.map((row) => row.name)).toEqual(["Provider A"]);
      await expect(
        db.exec(
          `insert into public.service_providers(company_id,name) values('${COMPANY_B}','Cross-company')`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await db.exec("reset role");
    }
  });

  it("writes provider details and category assignments atomically", async () => {
    await db.exec(
      `select set_config('app.company_id','${COMPANY_A}',false); set role authenticated;`,
    );
    try {
      await db.query(`select public.save_service_provider_atomic(
        null,
        '{"name":"Atomic Provider","phone":"90000000","is_active":true}'::jsonb,
        array['20000000-0000-4000-8000-00000000000a'::uuid]
      )`);
    } finally {
      await db.exec("reset role");
    }
    const result = await db.query<{ providers: number; links: number }>(`
      select
        (select count(*)::int from public.service_providers where name='Atomic Provider') providers,
        (select count(*)::int from public.service_provider_category_links link join public.service_providers provider on provider.id=link.service_provider_id where provider.name='Atomic Provider') links
    `);
    expect(result.rows[0]).toEqual({ providers: 1, links: 1 });
  });

  it("rejects cross-company and unsupported Maintenance assignments", async () => {
    await expect(
      db.exec(
        `update public.maintenance_records set service_provider_id='30000000-0000-4000-8000-00000000000b' where id='40000000-0000-4000-8000-00000000000a'`,
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      db.exec(
        `update public.maintenance_records set service_provider_id='30000000-0000-4000-8000-00000000000a',service_provider_category_id='20000000-0000-4000-8000-00000000001a' where id='40000000-0000-4000-8000-00000000000a'`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("accepts a same-company provider that supports the selected service type", async () => {
    await expect(
      db.exec(
        `update public.maintenance_records set service_provider_id='30000000-0000-4000-8000-00000000000a',service_provider_category_id='20000000-0000-4000-8000-00000000000a' where id='40000000-0000-4000-8000-00000000000a'`,
      ),
    ).resolves.toBeDefined();
  });
});
