#!/usr/bin/env node
// S02-T01 inventory generator.
// Static, source-based inventory of SECURITY DEFINER financial/contract RPCs in
// the S02 scope. Resolves the *latest* definition of each function across
// forward migrations (applied in filename order), then classifies:
//   - security : DEFINER | INVOKER
//   - search_path : explicit 'public, pg_temp' | none
//   - company predicate : derived company-id guard / RLS reliance
//   - grants : anon / authenticated / service_role execute
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function baseSha() {
  try {
    return execSync('git rev-parse origin/main 2>/dev/null || git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migDir = join(root, 'supabase', 'migrations');
const outDir = join(root, 'docs', 'execution');

const S02_SCOPE = [
  'update_owner_agreement_atomic',
  'create_owner_agreement_atomic',
  'create_property_with_agreement',
  'create_owner_settlement_draft_atomic',
  'approve_owner_settlement_atomic',
  'cancel_owner_settlement_atomic',
  'pay_owner_settlement_atomic',
  'owner_settlement_reservable_payments',
  'owner_settlement_reservable_expenses',
  'enforce_owner_settlement_link_company_consistency',
  'assert_owner_settlement_links_backfillable',
  'backfill_owner_settlement_links',
  'diagnose_owner_settlement_duplication',
  'record_invoice_payment_atomic',
  'post_receipt_atomic',
  'void_receipt_atomic',
  'create_expense_with_journal_atomic',
  'update_expense_with_journal_atomic',
  'create_commission_atomic',
  'update_commission_atomic',
  'cancel_commission_atomic',
  'pay_commission_atomic',
  'reverse_commission_atomic',
  'guard_commission_financial_fields',
  'import_bank_statement_batch_atomic',
];

const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
const latest = new Map();

function extractFunction(txt, name, start) {
  // from the create..( ... ) header
  const rest = txt.slice(start);
  // find the 'as $tag' or 'AS $tag' body opener
  const tagRe = /as\s+\$([A-Za-z0-9_]*)\$/i;
  const tagM = tagRe.exec(rest);
  if (!tagM) return null;
  const tag = tagM[1];
  const openPos = tagM.index + tagM[0].length; // right after opening $tag$
  const closeRe = new RegExp(`\\$${tag}\\$\\s*;`);
  const closeM = closeRe.exec(rest.slice(openPos));
  if (!closeM) return null;
  const body = rest.slice(openPos, openPos + closeM.index);
  // header: from the create keyword to the body opener (carries security
  // definer / set search_path / language attributes)
  const header = rest.slice(0, tagM.index);
  return { header, body };
}

for (const file of files) {
  const txt = readFileSync(join(migDir, file), 'utf8');
  const re = /create\s+or\s+replace\s+function\s+(public\.)([a-z0-9_]+)\s*\(/gi;
  let m;
  while ((m = re.exec(txt)) !== null) {
    const name = m[2];
    if (!S02_SCOPE.includes(name)) continue;
    const ext = extractFunction(txt, name, m.index);
    if (ext === null) continue;
    latest.set(name, { file, ...ext, start: m.index });
  }
}

function classify(name, body, file, start) {
  const isDefiner = /\bsecurity\s+definer\b/i.test(body);
  const sp = (body.match(/set\s+search_path\s+(?:=|to)\s*([^;\n]+)/i) || [])[1]?.trim().replace(/\s+/g, ' ') || 'NOT SET';
  const fileTxt = readFileSync(join(migDir, file), 'utf8');
  const grantSegment = fileTxt.slice(Math.max(0, start - 200), start + 20000);
  const grantAnon = /revoke\s+all\s+on\s+function[\s\S]{0,1500}?from\s+public\s*,?\s*anon/i.test(grantSegment)
    || /revoke\s+execute\s+on\s+function[\s\S]{0,1500}?from\s+(?:public|anon)/i.test(grantSegment);
  const grantAuth = /grant\s+execute\s+on\s+function[\s\S]{0,1500}?to\s+authenticated/i.test(grantSegment);
  const grantService = /grant\s+execute\s+on\s+function[\s\S]{0,1500}?to\s+service_role/i.test(grantSegment);
  const grantAnonExec = /grant\s+execute\s+on\s+function[\s\S]{0,1500}?to\s+anon/i.test(grantSegment);

  const usesRequire = /\brequire_company_id\s*\(/.test(body);
  const usesCurrent = /\bcurrent_company_id\s*\(/.test(body);
  const companyScopedWrite =
    /\bcompany_id\s*=\s*v_company_id/i.test(body)
    || /\bwhere\b[\s\S]{0,120}\bcompany_id\s*=\s*\w+/i.test(body)
    || /\band\s+\w+\.company_id\s*=\s*\w+/i.test(body);

  let pred;
  if (usesRequire && companyScopedWrite) pred = 'require_company_id() + company_id scoped write';
  else if (usesCurrent && companyScopedWrite) pred = 'current_company_id() + company_id scoped write';
  else if (usesRequire) pred = 'require_company_id()';
  else if (usesCurrent) pred = 'current_company_id()';
  else if (companyScopedWrite) pred = 'company_id scoped write (derivation source unknown)';
  else pred = 'NOT DETECTED (RLS reliance risk for DEFINER)';

  return { isDefiner, sp, grantAnon, grantAuth, grantService, grantAnonExec, pred };
}

const rows = [...latest.keys()].sort().map((name) => {
  const { file, header, body, start } = latest.get(name);
  return { name, file, ...classify(name, header + '\n' + body, file, start) };
});

const now = new Date().toISOString().slice(0, 10);
let md = `# S02-T01 — SECURITY DEFINER inventory (S02 scope)

> Generated by \`scripts/generate-s02-security-definer-inventory.mjs\` on ${now}.
> Base: latest \`origin/main\` at \`${baseSha()}\`.
> Method: static resolution of the *latest* definition of each S02-scope
> function across forward migrations (applied in filename order). Runtime
> behavior is confirmed separately by pgTAP/PGLite replay tests in
> \`supabase/tests/\`.

Scope: owner agreements, owner settlements, settlement payments, settlement
expenses, bank CSV import, and financial browser writes (receipts, invoice
payments, expenses, commissions).

## Inventory

| Function | Latest migration | Security | search_path | Company predicate | anon EXECUTE | authenticated EXECUTE |
|---|---|---|---|---|---|---|
`;

for (const r of rows) {
  const sec = r.isDefiner ? 'DEFINER' : 'invoker';
  const anon = r.grantAnonExec ? 'YES (flag)' : r.grantAnon ? 'revoked' : 'n/a';
  const auth = r.grantAuth ? 'yes' : 'no';
  md += `| \`${r.name}\` | ${r.file} | ${sec} | ${r.sp} | ${r.pred} | ${anon} | ${auth} |\n`;
}

md += `
## Classification notes

- \`DEFINER\` functions execute with the function owner's privileges and bypass
  the caller's RLS unless the body re-establishes the company boundary. Every
  S02-scope write RPC must derive the company from the JWT context
  (\`require_company_id()\` / \`current_company_id()\`) and scope every read and
  write by \`company_id\` inside the body.
- \`search_path\` must be pinned to \`public, pg_temp\` to prevent search-path
  hijacking (see \`20260718163419_pin_set_updated_at_search_path.sql\` precedent).
- \`anon\` and \`public\` EXECUTE must be revoked for every financial write RPC;
  writes are restricted to \`authenticated\` (+ optional \`service_role\`).
- A \`NOT DETECTED\` company predicate or \`NOT SET\` search_path is a review
  flag to confirm, not an assertion of a live vulnerability.
- \`enforce_owner_settlement_link_company_consistency\` and
  \`guard_commission_financial_fields\` are \`SECURITY INVOKER\` helper guards;
  they are listed for completeness.
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'S02_SECURITY_DEFINER_INVENTORY.md'), md);
console.log(`Wrote ${rows.length} rows -> docs/execution/S02_SECURITY_DEFINER_INVENTORY.md`);
for (const r of rows) {
  console.log(`${r.name}\t${r.isDefiner ? 'DEFINER' : 'invoker'}\tsearch=${r.sp}\t${r.pred}\tanonExec=${r.grantAnonExec}${r.grantAnon ? '/' : ''}${r.grantAnon ? 'revoked' : ''}`);
}
