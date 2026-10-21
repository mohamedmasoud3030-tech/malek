#!/usr/bin/env node
/**
 * MALEK — live evidence runner.
 *
 * Turns "the gap register says the engineering is complete" into "these proof units passed at this
 * exact SHA", and states precisely what remains outside local reach.
 *
 * What it is NOT: hosted proof. There is no Supabase Auth service, no PostgREST, no Storage and no
 * browser here. Every artifact it writes labels itself accordingly, and each gap carries the
 * `remaining` boundary copied from the registry.
 *
 * Usage:
 *   node scripts/live-evidence/run.mjs                 # run every mapped unit
 *   node scripts/live-evidence/run.mjs --only GAP-018  # one gap
 *   node scripts/live-evidence/run.mjs --offline       # verify registry integrity only
 *
 * Outputs:
 *   .gate/live-evidence.json            machine-readable artifact (gitignored)
 *   docs/evidence/live-evidence.md      committed, dated, SHA-stamped report
 *
 * Exit codes: 0 = all mapped units passed, 1 = a unit failed, 2 = usage/registry error.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import process from 'node:process';

import { CLOSED_GAPS, GAP_EVIDENCE, PROOF_UNITS } from './registry.mjs';

const ROOT = process.cwd();
const REPORT_PATH = 'docs/evidence/live-evidence.md';
const JSON_PATH = '.gate/live-evidence.json';

function parseArgs(argv) {
  const options = { only: [], offline: false, writeReport: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--only') options.only.push(argv[++i]);
    else if (arg === '--offline') options.offline = true;
    else if (arg === '--no-report') options.writeReport = false;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return options;
}

function sh(command, args, cwd = ROOT) {
  const started = Date.now();
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 1_800_000 });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    durationMs: Date.now() - started,
  };
}

const options = parseArgs(process.argv.slice(2));

/* ------------------------------------------------------------------ registry integrity */

const registryErrors = [];
for (const [gapId, entry] of Object.entries(GAP_EVIDENCE)) {
  for (const unitId of entry.units) {
    const unit = PROOF_UNITS[unitId];
    if (!unit) {
      registryErrors.push(`${gapId} references unknown proof unit "${unitId}"`);
      continue;
    }
    if (unit.kind === 'vitest' && !existsSync(resolve(ROOT, unit.file))) {
      registryErrors.push(`${gapId}/${unitId}: missing file ${unit.file}`);
    }
    if (unit.kind === 'script') {
      const scriptPath = unit.command.find((arg) => arg.endsWith('.mjs'));
      if (!scriptPath || !existsSync(resolve(ROOT, scriptPath))) {
        registryErrors.push(`${gapId}/${unitId}: missing script ${scriptPath ?? '(none)'}`);
      }
    }
  }
  if (!entry.remaining) registryErrors.push(`${gapId} has no "remaining" boundary statement`);
}
for (const gapId of CLOSED_GAPS) {
  if (GAP_EVIDENCE[gapId]) registryErrors.push(`${gapId} is closed but still has an evidence entry`);
}

if (registryErrors.length > 0) {
  console.error('Evidence registry is inconsistent:');
  for (const error of registryErrors) console.error(`  - ${error}`);
  process.exit(2);
}

const selectedGaps = options.only.length > 0 ? options.only : Object.keys(GAP_EVIDENCE);
for (const gapId of selectedGaps) {
  if (!GAP_EVIDENCE[gapId]) {
    console.error(`Unknown gap: ${gapId}. Known: ${Object.keys(GAP_EVIDENCE).join(', ')}`);
    process.exit(2);
  }
}

if (options.offline) {
  console.log(`Evidence registry OK — ${selectedGaps.length} gap(s), no execution requested.`);
  process.exit(0);
}

/* ------------------------------------------------------------------ execution */

const headSha = (sh('git', ['rev-parse', 'HEAD']).stdout || '').trim();
const dirty = (sh('git', ['status', '--porcelain']).stdout || '').trim() !== '';

const neededUnits = [...new Set(selectedGaps.flatMap((gapId) => GAP_EVIDENCE[gapId].units))];
const vitestUnits = neededUnits.filter((id) => PROOF_UNITS[id].kind === 'vitest');
const scriptUnits = neededUnits.filter((id) => PROOF_UNITS[id].kind === 'script');

console.log(`Live evidence run — ${selectedGaps.length} gap(s), ${neededUnits.length} proof unit(s)`);
console.log(`  revision : ${headSha.slice(0, 12)}${dirty ? ' (working tree dirty)' : ''}`);
console.log(`  engine   : PGlite (PostgreSQL 18 in WASM) for database units`);
console.log('');

/** unitId → { status, passed, failed, detail } */
const unitResults = new Map();

if (vitestUnits.length > 0) {
  // Absolute paths: this runs with cwd=malek-app, so repo-relative paths would resolve twice.
  const files = vitestUnits.map((id) => resolve(ROOT, PROOF_UNITS[id].file));
  const outputFile = resolve(ROOT, '.gate/vitest-live-evidence.json');
  mkdirSync(dirname(outputFile), { recursive: true });
  console.log(`Running ${files.length} Vitest file(s)…`);
  const vitestBin = [
    resolve(ROOT, 'malek-app/node_modules/vitest/vitest.mjs'),
    resolve(ROOT, 'node_modules/vitest/vitest.mjs'),
  ].find((candidate) => existsSync(candidate));
  if (!vitestBin) {
    console.error('Vitest is not installed. Run: corepack pnpm install --frozen-lockfile --ignore-scripts');
    process.exit(2);
  }
  const run = sh(
    process.execPath,
    [
      vitestBin,
      'run',
      '--config',
      'vite.config.ts',
      '--reporter=json',
      `--outputFile=${outputFile}`,
      ...files,
    ],
    resolve(ROOT, 'malek-app'),
  );

  let parsed = null;
  try {
    parsed = JSON.parse(readFileSync(outputFile, 'utf8'));
  } catch {
    parsed = null;
  }

  if (!parsed) {
    for (const id of vitestUnits) {
      unitResults.set(id, {
        status: 'error',
        passed: 0,
        failed: 0,
        detail: `Vitest produced no JSON report (exit ${run.status}): ${(run.stderr || run.stdout).slice(-400)}`,
      });
    }
  } else {
    const byFile = new Map();
    for (const file of parsed.testResults ?? []) {
      // Normalise to repo-relative so it matches the registry, which uses 'malek-app/...' paths.
      const relativePath = file.name.slice(ROOT.length + 1).split(sep).join('/');
      byFile.set(relativePath, file);
    }
    for (const id of vitestUnits) {
      const file = byFile.get(PROOF_UNITS[id].file);
      if (!file) {
        unitResults.set(id, { status: 'missing', passed: 0, failed: 0, detail: 'file not present in Vitest report' });
        continue;
      }
      const assertions = file.assertionResults ?? [];
      const passed = assertions.filter((assertion) => assertion.status === 'passed').length;
      const failed = assertions.filter((assertion) => assertion.status === 'failed').length;
      const skipped = assertions.filter((assertion) => assertion.status === 'skipped' || assertion.status === 'pending').length;
      unitResults.set(id, {
        status: failed > 0 ? 'failed' : passed > 0 ? 'passed' : 'empty',
        passed,
        failed,
        skipped,
        detail: failed > 0 ? assertions.filter((a) => a.status === 'failed').map((a) => a.title).join(' | ') : undefined,
      });
    }
  }
}

for (const id of scriptUnits) {
  const unit = PROOF_UNITS[id];
  const run = sh(unit.command[0] === 'node' ? process.execPath : unit.command[0], unit.command.slice(1));
  const text = `${run.stdout}\n${run.stderr}`;
  const passLines = (text.match(/\bPASS\b/g) ?? []).length;
  const failLines = (text.match(/\bFAIL\b/g) ?? []).length;
  unitResults.set(id, {
    status: run.status === 0 ? 'passed' : 'failed',
    passed: run.status === 0 ? Math.max(passLines, 1) : 0,
    failed: run.status === 0 ? 0 : Math.max(failLines, 1),
    detail: run.status === 0 ? undefined : text.slice(-500),
  });
}

/* ------------------------------------------------------------------ aggregation */

const gaps = selectedGaps.map((gapId) => {
  const entry = GAP_EVIDENCE[gapId];
  const units = entry.units.map((unitId) => ({
    id: unitId,
    title: PROOF_UNITS[unitId].title,
    ...unitResults.get(unitId),
  }));

  const failed = units.filter((unit) => ['failed', 'error', 'missing'].includes(unit.status));
  const passedCount = units.filter((unit) => unit.status === 'passed').length;

  let status;
  if (units.length === 0) status = 'NO_LOCAL_PROOF';
  else if (failed.length > 0) status = 'FAILED';
  else if (passedCount === units.length) status = 'PROVEN_LOCALLY';
  else status = 'PARTIAL';

  return {
    id: gapId,
    status,
    proofUnits: units,
    assertionsPassed: units.reduce((sum, unit) => sum + (unit.passed ?? 0), 0),
    remaining: entry.remaining,
    authority: entry.authority,
  };
});

const counts = gaps.reduce((acc, gap) => {
  acc[gap.status] = (acc[gap.status] ?? 0) + 1;
  return acc;
}, {});

const artifact = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  headSha,
  workingTreeDirty: dirty,
  engine: 'PGlite (PostgreSQL 18 in WASM) replayed from supabase/migrations',
  notCovered: [
    'Supabase Auth service (JWT issuance, sessions, hooks)',
    'PostgREST HTTP layer',
    'Supabase Storage',
    'Browser rendering and Playwright journeys',
    'Hosted configuration, secrets, grants at the deployed SHA',
    'Legal opinion and pilot operations',
  ],
  summary: { gaps: gaps.length, byStatus: counts, proofUnits: unitResults.size },
  gaps,
};

mkdirSync(resolve(ROOT, dirname(JSON_PATH)), { recursive: true });
writeFileSync(resolve(ROOT, JSON_PATH), `${JSON.stringify(artifact, null, 2)}\n`);

/* ------------------------------------------------------------------ console */

console.log('');
console.log(`${'GAP'.padEnd(9)}${'STATUS'.padEnd(18)}${'UNITS'.padEnd(8)}${'ASSERTIONS'.padEnd(12)}REMAINING AUTHORITY`);
for (const gap of gaps) {
  console.log(
    `${gap.id.padEnd(9)}${gap.status.padEnd(18)}${String(gap.proofUnits.length).padEnd(8)}${String(gap.assertionsPassed).padEnd(12)}${gap.authority}`,
  );
  for (const unit of gap.proofUnits) {
    if (unit.status !== 'passed') console.log(`    ${unit.status.toUpperCase()} ${unit.id} — ${unit.detail ?? ''}`);
  }
}

console.log('');
for (const [status, count] of Object.entries(counts)) console.log(`  ${status}: ${count}`);
console.log('');
console.log(`Evidence written to ${JSON_PATH}`);

/* ------------------------------------------------------------------ report */

if (options.writeReport) {
  const lines = [];
  lines.push('# Live evidence report');
  lines.push('');
  lines.push('> **Generated artifact — do not edit by hand.** Regenerate with `pnpm evidence:live`.');
  lines.push(`> **Revision:** \`${headSha}\`${dirty ? ' (working tree dirty)' : ''}`);
  lines.push(`> **Generated:** ${artifact.generatedAt}`);
  lines.push('> **Engine:** PGlite (PostgreSQL 18 in WASM), schema replayed from `supabase/migrations`.');
  lines.push('');
  lines.push('## What this report proves — and what it does not');
  lines.push('');
  lines.push('A `PROVEN_LOCALLY` gap means every mapped proof unit executed and passed **at this revision,');
  lines.push('against a real PostgreSQL engine**. It does **not** mean the gap is closed.');
  lines.push('');
  lines.push('This environment has no Supabase Auth service, no PostgREST, no Storage, no browser and no');
  lines.push('hosted project. The following cannot be established here, for any gap:');
  lines.push('');
  for (const item of artifact.notCovered) lines.push(`- ${item}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Status | Gaps |');
  lines.push('| --- | ---: |');
  for (const [status, count] of Object.entries(counts)) lines.push(`| ${status} | ${count} |`);
  lines.push('');
  lines.push('## Per-gap evidence');
  lines.push('');
  lines.push('| Gap | Status | Assertions | Proof units | Remaining (cannot be shown locally) | Authority |');
  lines.push('| --- | --- | ---: | --- | --- | --- |');
  for (const gap of gaps) {
    const units = gap.proofUnits.map((unit) => `\`${unit.id}\``).join(', ') || '—';
    lines.push(
      `| ${gap.id} | ${gap.status} | ${gap.assertionsPassed} | ${units} | ${gap.remaining} | ${gap.authority} |`,
    );
  }
  lines.push('');
  lines.push('## Reproducing');
  lines.push('');
  lines.push('```bash');
  lines.push('corepack pnpm install --frozen-lockfile --ignore-scripts && corepack pnpm rebuild esbuild');
  lines.push('corepack pnpm evidence:live');
  lines.push('```');
  lines.push('');
  lines.push('A failure is a defect, not an evidence gap. `FAILED` must be fixed before any release claim.');
  lines.push('');
  mkdirSync(resolve(ROOT, dirname(REPORT_PATH)), { recursive: true });
  writeFileSync(resolve(ROOT, REPORT_PATH), `${lines.join('\n')}`);
  console.log(`Report written to ${REPORT_PATH}`);
}

const failures = gaps.filter((gap) => gap.status === 'FAILED');
if (failures.length > 0) {
  console.error('');
  console.error(`FAILED: ${failures.map((gap) => gap.id).join(', ')} — a mapped proof unit failed.`);
  process.exit(1);
}
