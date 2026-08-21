#!/usr/bin/env node
// Database Guardian V1 — unified runner.
//
//   node scripts/guardian/run.mjs [--json PATH] [--base REF] [--quiet]
//
// Runs every Guardian check in order and emits:
//   * human report on stdout
//   * machine-readable report at .guardian/report.json (or --json PATH)
//
// Exit code:
//   0  no CRITICAL/HIGH findings
//   1  one or more CRITICAL/HIGH findings (CI blocks merge)
//   2  runner error (could not complete checks)

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderReport, summarise, BLOCKING_SEVERITIES, SEVERITY } from './lib/findings.mjs';
import { runInventoryChecks } from './lib/inventory.mjs';
import { runBehavioralChecks } from './lib/behavioral.mjs';
import { runIntegrityChecks } from './lib/integrity.mjs';
import { runOperationMap } from './lib/operation-map.mjs';
import { runMigrationChecks } from './lib/migration.mjs';
import { runGovernanceChecks } from './lib/governance.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const args = process.argv.slice(2);
const jsonIdx = args.indexOf('--json');
const JSON_PATH = jsonIdx >= 0 ? args[jsonIdx + 1] : join(ROOT, '.guardian', 'report.json');
const BASE_REF = process.env.GUARDIAN_BASE_REF || (args.includes('--base') ? args[args.indexOf('--base') + 1] : null);
const QUIET = args.includes('--quiet');
const ONLY = (() => {
  const i = args.indexOf('--only');
  return i >= 0 ? new Set(args[i + 1].split(',')) : null;
})();

const log = (...a) => !QUIET && console.log(...a);

function gate(name, fn) {
  if (ONLY && !ONLY.has(name)) return { name, skipped: true, findings: [], meta: null, ms: 0 };
  const started = Date.now();
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then((r) => ({ name, skipped: false, ...r, ms: Date.now() - started }));
    }
    return { name, skipped: false, ...result, ms: Date.now() - started };
  } catch (error) {
    return {
      name, skipped: false, findings: [{
        id: 'DG-RUNNER', severity: SEVERITY.CRITICAL, category: 'runner',
        title: `Check ${name} threw`, evidence: String(error?.stack ?? error),
      }], meta: null, ms: Date.now() - started,
    };
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const gates = [];

  log('Database Guardian V1');
  log('='.repeat(72));

  // 1. Inventory + canonical contract (replays migrations, introspects)
  process.stdout.write('\n[1/5] Inventory & canonical contract ... ');
  const inv = await gate('inventory', runInventoryChecks);
  log(`${inv.findings.length} finding(s) (${inv.ms}ms)`);
  gates.push(inv);

  // 2. Behavioral RLS / cross-company / financial RPC tests
  process.stdout.write('[2/5] Behavioral RLS + financial RPC tests ... ');
  const beh = await gate('behavioral', runBehavioralChecks);
  log(`${beh.findings.length} finding(s), ${beh.checks?.length ?? 0} checks (${beh.ms}ms)`);
  gates.push(beh);

  // 3. Data + financial integrity detectors
  process.stdout.write('[3/5] Data & financial integrity detectors ... ');
  const integ = await gate('integrity', runIntegrityChecks);
  log(`${integ.findings.length} finding(s), ${integ.detectorsRun ?? 0} detectors (${integ.ms}ms)`);
  gates.push(integ);

  // 4. Operation map (frontend -> RPC -> table)
  process.stdout.write('[4/5] Operation map & write-path audit ... ');
  const opmap = await gate('operation-map', runOperationMap);
  log(`${opmap.findings.length} finding(s) (${opmap.ms}ms)`);
  gates.push(opmap);

  // 5. Governance (six-role authorization matrix)
  process.stdout.write('[5/6] Governance & authorization matrix ... ');
  const gov = await gate('governance', runGovernanceChecks);
  log(`${gov.findings.length} finding(s) (${gov.ms}ms)`);
  gates.push(gov);

  // 6. Migration hygiene
  process.stdout.write('[6/6] Migration hygiene ... ');
  const mig = await gate('migration', () => runMigrationChecks({ baseRef: BASE_REF }));
  log(`${mig.findings.length} finding(s) (${mig.ms}ms)`);
  gates.push(mig);

  const allFindings = gates.flatMap((g) => g.findings);
  const summary = summarise(allFindings);

  log('');
  log(renderReport(allFindings, { title: 'MALEK Database Guardian' }));

  log('Gate timings:');
  for (const g of gates) {
    log(`  ${g.skipped ? 'SKIP ' : 'DONE '} ${g.name.padEnd(16)} ${String(g.ms).padStart(5)}ms  findings=${g.findings.length}`);
  }
  log('');

  const report = {
    version: 1,
    generatedAt: startedAt,
    finishedAt: new Date().toISOString(),
    baseRef: BASE_REF,
    summary: {
      total: summary.total,
      bySeverity: summary.bySeverity,
      byCategory: summary.byCategory,
      blocking: summary.blocking.length,
    },
    inventory: inv.inventory ?? null,
    behavioral: {
      checksRun: beh.checks?.length ?? 0,
      passed: (beh.checks ?? []).filter((c) => c.pass).length,
      failed: (beh.checks ?? []).filter((c) => !c.pass).length,
      results: beh.checks ?? [],
    },
    integrity: {
      detectorsRun: integ.detectorsRun ?? 0,
      violations: integ.violations ?? 0,
    },
    operationMap: opmap.map ?? null,
    migrations: { count: mig.migrationCount ?? null, baseRef: BASE_REF },
    findings: allFindings,
  };

  await mkdir(dirname(JSON_PATH), { recursive: true });
  await writeFile(JSON_PATH, JSON.stringify(report, null, 2));
  log(`Machine-readable report: ${JSON_PATH}`);

  const blocking = allFindings.filter((f) => BLOCKING_SEVERITIES.has(f.severity));
  log('');
  if (blocking.length) {
    log(`GUARDIAN: FAIL — ${blocking.length} blocking finding(s) (CRITICAL/HIGH). Merge must be blocked.`);
    process.exit(1);
  }
  log('GUARDIAN: PASS — no blocking findings.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Guardian runner crashed:', error);
  process.exit(2);
});
