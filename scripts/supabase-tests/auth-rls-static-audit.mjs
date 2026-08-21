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
const failures = [];

function requireInvariant(condition, message) {
  if (!condition) failures.push(message);
}

const tables = [...baseline.matchAll(
  /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"public"\."([^"]+)"\s+\(([\s\S]*?)\n\);/g,
)].map((match) => ({ name: match[1], definition: match[2] }));
const rlsTables = new Set(
  [...baseline.matchAll(
    /ALTER TABLE(?: ONLY)?\s+"public"\."([^"]+)"\s+ENABLE ROW LEVEL SECURITY;/g,
  )].map((match) => match[1]),
);

requireInvariant(tables.length > 0, "No public tables were found in the baseline.");
for (const table of tables) {
  requireInvariant(rlsTables.has(table.name), "RLS must be enabled for public." + table.name + ".");
  requireInvariant(
    /"company_id"/.test(table.definition),
    "public." + table.name + " must retain an explicit company_id tenancy key.",
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
