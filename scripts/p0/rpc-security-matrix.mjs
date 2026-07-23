#!/usr/bin/env node
/**
 * P0 — Per-function security matrix (static analysis, latest definition wins).
 *
 * Extracts the latest full definition (signature + options + dollar-quoted body)
 * of every public function across supabase/migrations/**.sql, then evaluates the
 * multi-tenant security baseline required by this project:
 *
 *   A. SECURITY DEFINER presence
 *   B. `SET search_path` pinning
 *   C. company derivation — body calls public.current_company_id()
 *   D. company spoof surface — accepts `company_id` from caller payload/args
 *   E. client-trusted money — amounts read from p_payload (settlement-class risk)
 *   F. REVOKE ALL FROM public, anon + explicit GRANTs
 *
 * Consumes evidence/p0/inventory.json (run scripts/p0/inventory.mjs first).
 * Outputs evidence/p0/rpc-security-matrix.{json,md}.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migDir = join(repoRoot, 'supabase', 'migrations');
const outDir = join(repoRoot, 'evidence', 'p0');
const inventory = JSON.parse(readFileSync(join(outDir, 'inventory.json'), 'utf8'));

const migFiles = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();

// ---- Latest-definition extraction (dollar-quote aware) ----------------------
const defs = new Map(); // name -> { file, text }
const headRe = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\(/gi;

function extractDefinition(sql, startIdx) {
  const dq = /\$([a-z_0-9]*)\$/i;
  const rest = sql.slice(startIdx);
  const open = dq.exec(rest);
  if (!open) return sql.slice(startIdx, startIdx + 4000);
  const tag = open[0];
  const bodyStart = startIdx + open.index + tag.length;
  const close = sql.indexOf(tag, bodyStart);
  if (close === -1) return sql.slice(startIdx, startIdx + 4000);
  // include trailing function options after body close (search_path, security)
  const tail = sql.slice(close + tag.length, close + tag.length + 600);
  const tailEnd = tail.indexOf(';');
  return sql.slice(startIdx, close + tag.length + (tailEnd === -1 ? 400 : tailEnd + 1));
}

for (const file of migFiles) {
  const sql = readFileSync(join(migDir, file), 'utf8');
  for (const m of sql.matchAll(headRe)) {
    defs.set(m[1].toLowerCase(), { file, text: extractDefinition(sql, sql.indexOf(m[0])) });
  }
}

// ---- Evaluation --------------------------------------------------------------
const moneyKeys = ['amount', 'gross_collected', 'office_fee', 'net_payable', 'owner_expenses', 'tax_amount', 'cost', 'p_cost'];
const idKeysFromPayload = /->>?\s*'[a-z_]*(_id|id)'/i;

const grantsByName = new Map(inventory.functions.map((f) => [f.name, f]));
const classifyFn = (name) => grantsByName.get(name)?.kind ?? 'helper-or-other';
const calledByFrontend = (name) => grantsByName.get(name)?.calledByFrontend ?? false;

const rows = [];
for (const [name, def] of [...defs.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const t = def.text;
  const rec = grantsByName.get(name) ?? { grants: [], revokes: [], kind: classifyFn(name) };
  const securityDefiner = /security\s+definer/i.test(t);
  const searchPathPinned = /set\s+search_path/i.test(t);
  // Company derivation: either the project helper or the inline JWT claim
  // extraction pattern used by the 2026-07-22/23 hardening migrations.
  const derivesCompany =
    /current_company_id\s*\(/i.test(t) ||
    /auth\.jwt\s*\(\s*\)\s*->\s*'app_metadata'\s*->>?\s*'company_id'/i.test(t);
  // Spoof surface: caller-controlled company_id arriving via payload/args —
  // JWT claim reads above are legitimate and intentionally excluded.
  const spoofCompany = /(p_payload|payload)\s*->>?\s*'company_id'/i.test(t) || /\bp_company_id\b/i.test(t);
  const moneyFromPayload = moneyKeys.filter((k) => new RegExp(`(p_payload|payload)\\s*->>?\\s*'${k}'`, 'i').test(t));
  const idsFromPayload = idKeysFromPayload.test(t);
  const revokedPublicAnon = rec.revokes.includes('public') && rec.revokes.includes('anon');
  const grants = rec.grants;

  const kind = rec.kind;
  const isExposure = kind === 'report-read' || kind === 'financial-write';

  let status = '✅ سليم ساكنًا';
  const gaps = [];
  if (isExposure) {
    if (!securityDefiner && kind === 'financial-write') gaps.push('ليس SECURITY DEFINER');
    if (securityDefiner && !derivesCompany) gaps.push('لا يشتق company_id');
    if (spoofCompany) gaps.push('سطح انتحال شركة من الحمولة');
    if (moneyFromPayload.length) gaps.push(`مبالغ موثوقة من العميل: ${moneyFromPayload.join(', ')}`);
    if (!searchPathPinned) gaps.push('search_path غير مثبّت');
    if (!revokedPublicAnon) gaps.push('REVOKE public/anon غير مؤكد');
    if (!grants.includes('authenticated')) gaps.push('GRANT authenticated غير مؤكد');
    if (gaps.length) status = '⚠️ فجوات — يخضع للفحص السلوكي';
  } else if (!securityDefiner && /security/i.test(t) === false) {
    status = 'ℹ️ داخلي/مساعد';
  }

  rows.push({
    name,
    kind,
    latestDefinition: def.file,
    calledByFrontend: calledByFrontend(name),
    securityDefiner,
    searchPathPinned,
    derivesCompanyId: derivesCompany,
    companySpoofSurface: spoofCompany,
    clientTrustedMoney: moneyFromPayload,
    idsFromPayload,
    revokedFromPublicAnon: revokedPublicAnon,
    grantedTo: grants,
    status,
    gaps,
  });
}

const needsBehavioral = rows.filter((r) => r.status.startsWith('⚠️'));
const summary = {
  generatedAt: new Date().toISOString(),
  totalFunctions: rows.length,
  exposureFunctions: rows.filter((r) => r.kind === 'report-read' || r.kind === 'financial-write').length,
  staticFailed: needsBehavioral.map((r) => r.name),
  financialIntegrityRisks: rows.filter((r) => r.clientTrustedMoney.length && r.kind === 'financial-write').map((r) => r.name),
  spoofSurfaces: rows.filter((r) => r.companySpoofSurface).map((r) => r.name),
};

writeFileSync(join(outDir, 'rpc-security-matrix.json'), JSON.stringify({ summary, rows }, null, 2));

const md = [
  '# P0 — مصفوفة أمان الدوال (فحص ساكن، أحدث تعريف)',
  `أُنشئ: ${summary.generatedAt}`,
  '',
  `الدوال: ${summary.totalFunctions} · منكشفة (تقارير/كتابة مالية): ${summary.exposureFunctions} · بحاجة لفحص سلوكي: ${summary.staticFailed.length}`,
  '',
  '| الدالة | النوع | secdef | search_path | اشتقاق شركة | انتحال شركة | مبالغ من العميل | REVOKE p/a | منح | الحالة |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) =>
    `| \`${r.name}\` | ${r.kind} | ${r.securityDefiner ? '✅' : '—'} | ${r.searchPathPinned ? '✅' : '⚠️'} | ${r.derivesCompanyId ? '✅' : '—'} | ${r.companySpoofSurface ? '🔴' : '—'} | ${r.clientTrustedMoney.length ? '🔴 ' + r.clientTrustedMoney.join(',') : '—'} | ${r.revokedFromPublicAnon ? '✅' : '⚠️'} | ${r.grantedTo.join(',') || '—'} | ${r.status} |`,
  ),
  '',
  '> تُستكمل هذه المصفوفة بالفحص السلوكي (PGlite isolated replay) في `behavioral-isolation.*`.',
].join('\n');
writeFileSync(join(outDir, 'rpc-security-matrix.md'), md);
console.log(JSON.stringify(summary, null, 2));
