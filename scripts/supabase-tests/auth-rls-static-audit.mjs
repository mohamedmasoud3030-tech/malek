#!/usr/bin/env node
// Static regression guard for the canonical Supabase Auth/RLS baseline.
// This complements the behavioural disposable-database matrix; it never
// contacts a hosted Supabase project or reads user data.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const migrationDirectory = resolve(root, "supabase/migrations");
const baseline = await readFile(
  resolve(migrationDirectory, "20260901000000_canonical_baseline.sql"),
  "utf8",
);
const roleMigration = await readFile(
  resolve(migrationDirectory, "20260901000008_company_members_six_role_constraint.sql"),
  "utf8",
);
const roleAuthorityMigration = await readFile(
  resolve(migrationDirectory, "20260901000009_company_members_six_role_authority.sql"),
  "utf8",
);
const authHookMigration = await readFile(
  resolve(migrationDirectory, "20260901000012_harden_custom_access_token_hook_identity.sql"),
  "utf8",
);
const failures = [];

function requireInvariant(condition, message) {
  if (!condition) failures.push(message);
}

const tables = [...baseline.matchAll(
  /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"public"\."([^"]+)"\s+\(([\s\S]*?)\n\);/g,
)].map((match) => ({ name: match[1], definition: match[2] }));
const globalOrIdentityTables = new Set([
  "app_permission_catalog",
  "audit_log",
  "automation_jobs",
  "companies",
  "financial_operation_idempotency",
  "governance",
  "onboarding_requirement_templates",
  "payment_terms_templates",
  "tax_code_catalog",
  "users",
]);
const rlsTables = new Set(
  [...baseline.matchAll(
    /ALTER TABLE(?: ONLY)?\s+"public"\."([^"]+)"\s+ENABLE ROW LEVEL SECURITY;/g,
  )].map((match) => match[1]),
);

requireInvariant(tables.length > 0, "No public tables were found in the baseline.");
for (const table of tables) {
  requireInvariant(rlsTables.has(table.name), "RLS must be enabled for public." + table.name + ".");
  const hasCompanyId = /"company_id"/.test(table.definition);
  requireInvariant(
    hasCompanyId || globalOrIdentityTables.has(table.name),
    "public." + table.name + " must be company-scoped or explicitly classified as global/identity.",
  );
}
requireInvariant(!/DISABLE ROW LEVEL SECURITY;/i.test(baseline), "The canonical baseline must not disable RLS.");

const functionBlocks = baseline
  .split(/\n\nALTER FUNCTION /)
  .map((block) => {
    const match = block.match(/CREATE OR REPLACE FUNCTION "([^"]+)"\."([^"]+)"/);
    return match ? { name: match[1] + "." + match[2], block, securityDefiner: /SECURITY DEFINER/.test(block) } : null;
  })
  .filter(Boolean);

for (const fn of functionBlocks.filter((entry) => entry.securityDefiner)) {
  requireInvariant(
    /SET "search_path" TO/.test(fn.block),
    "SECURITY DEFINER function " + fn.name + " must pin search_path.",
  );
  const functionName = fn.name.split(".")[1].replace(/[.*+?^()|[\]\\]/g, "\\$&");
  const publicGrant = new RegExp(
    'GRANT ALL ON FUNCTION "[^"]+"\\."' + functionName + '"\\([^;]*? TO "(?:anon|PUBLIC)"',
    "i",
  );
  requireInvariant(
    !publicGrant.test(baseline),
    "SECURITY DEFINER function " + fn.name + " must not be executable by anon or PUBLIC.",
  );
}

requireInvariant(
  /REVOKE ALL ON FUNCTION "public"\."custom_access_token_hook"\("event" "jsonb"\) FROM PUBLIC;/.test(baseline),
  "custom_access_token_hook must remain revoked from PUBLIC.",
);
requireInvariant(
  /'ADMIN'::text,[\s\S]*?'MANAGER'::text,[\s\S]*?'ACCOUNTANT'::text,[\s\S]*?'OPERATIONS'::text,[\s\S]*?'USER'::text,[\s\S]*?'VIEWER'::text/.test(roleMigration),
  "company_members must retain the canonical six-role constraint in its forward migration.",
);
requireInvariant(
  /alter column role set default 'USER';/i.test(roleAuthorityMigration),
  "company_members must default new members to USER.",
);
requireInvariant(
  /auth\.uid\(\) is not null[\s\S]*?target_company_id = public\.current_company_id\(\)[\s\S]*?current_user_has_effective_app_permission\('users\.manage'\)/.test(roleAuthorityMigration),
  "Membership management must require an authenticated active-company actor with users.manage.",
);
requireInvariant(
  /revoke all on function app_private\.can_manage_company_members\(uuid\) from public;[\s\S]*?revoke all on function app_private\.can_manage_company_members\(uuid\) from anon;[\s\S]*?grant execute on function app_private\.can_manage_company_members\(uuid\) to authenticated;[\s\S]*?grant execute on function app_private\.can_manage_company_members\(uuid\) to service_role;/i.test(roleAuthorityMigration),
  "Membership authority helper must revoke public/anon and grant only authenticated/service_role.",
);
for (const policyName of [
  "company_members_admin_write_ins",
  "company_members_admin_write_upd",
  "company_members_tenant_write_scope_ins",
  "company_members_tenant_write_scope_upd",
]) {
  requireInvariant(
    baseline.includes('CREATE POLICY "' + policyName + '" ON "public"."company_members"'),
    "company_members must retain " + policyName + ".",
  );
}
requireInvariant(
  /u\.status = 'ACTIVE'[\s\S]*?u\.is_active[\s\S]*?u\.deleted_at is null/i.test(authHookMigration),
  "The token hook must require an active, non-deleted application identity.",
);
requireInvariant(
  /if actor_is_active and user_company is not null then[\s\S]*?else[\s\S]*?claims := claims #- '\{app_metadata,company_id\}'/i.test(authHookMigration),
  "The token hook must clear company_id for inactive or unscoped identities.",
);
requireInvariant(
  /revoke all on function public\.custom_access_token_hook\(jsonb\) from public;[\s\S]*?revoke all on function public\.custom_access_token_hook\(jsonb\) from anon;[\s\S]*?revoke all on function public\.custom_access_token_hook\(jsonb\) from authenticated;[\s\S]*?grant execute on function public\.custom_access_token_hook\(jsonb\) to service_role;[\s\S]*?grant execute on function public\.custom_access_token_hook\(jsonb\) to supabase_auth_admin;/i.test(authHookMigration),
  "The token hook must be callable only by the Auth/server roles.",
);

if (failures.length) {
  console.error("Auth/RLS static audit failed:");
  for (const failure of failures) console.error("- " + failure);
  process.exitCode = 1;
} else {
  console.log(
    "Auth/RLS static audit passed: " + tables.length + " RLS-enabled company tables and " +
      functionBlocks.filter((entry) => entry.securityDefiner).length +
      " pinned SECURITY DEFINER functions.",
  );
}
