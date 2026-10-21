#!/usr/bin/env node
/**
 * MALEK — credential-free local gate.
 *
 * Purpose
 * -------
 * Agents in a sandbox without Docker, hosted Supabase credentials or browsers can still prove a
 * large part of the repository. Historically each agent retyped eight to twelve commands, guessed
 * which ones needed `--base origin/main`, and had no artifact to point at afterwards.
 *
 * This runner invokes the existing repository scripts unchanged. It adds no governance logic, grants
 * no stage credit and never touches hosted environments. It only sequences, times and records.
 *
 * Modes
 * -----
 *   --quick   governance guards + typecheck only            (~30 s)
 *   (none)    quick + app typecheck/tests contracts + PGlite database gates   (~2.5 min)
 *   --full    default + full application suite + production build             (~12 min)
 *
 * Output
 * ------
 * Human summary on stdout, exit code 1 if any step failed, and machine-readable evidence at
 * `.gate/last-run.json` (gitignored) so a report can cite an artifact instead of prose.
 *
 * Usage
 * -----
 *   corepack pnpm gate:local
 *   corepack pnpm gate:local --quick
 *   corepack pnpm gate:local --full
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const GATE_DIR = resolve(ROOT, '.gate');
const APP_FILTER = ['--filter', './malek-app'];

const modes = new Set(['--quick', '--full']);
const unknownArgs = process.argv.slice(2).filter((arg) => !modes.has(arg));
if (unknownArgs.length > 0) {
  console.error(`Unknown argument(s): ${unknownArgs.join(' ')}`);
  console.error('Usage: node scripts/agent-local-gate.mjs [--quick|--full]');
  process.exit(2);
}

const mode = process.argv.includes('--full')
  ? 'full'
  : process.argv.includes('--quick')
    ? 'quick'
    : 'default';

/** Each step runs `corepack pnpm` so the repository-pinned package manager is always used. */
const STEP_LIBRARY = {
  'check:docs': { pnpmArgs: ['run', 'check:docs'], timeoutMs: 300_000 },
  'check:wiki': { pnpmArgs: ['run', 'check:wiki'], timeoutMs: 300_000 },
  'check:business-rules': { pnpmArgs: ['run', 'check:business-rules'], timeoutMs: 300_000 },
  'check:execution-plan': { pnpmArgs: ['run', 'check:execution-plan'], timeoutMs: 300_000 },
  'check:migration-hygiene': { pnpmArgs: ['run', 'check:migration-hygiene'], timeoutMs: 300_000 },
  'check:enterprise-freeze': { pnpmArgs: ['run', 'check:enterprise-freeze'], timeoutMs: 300_000 },
  'check:gl-write-boundary': { pnpmArgs: ['run', 'check:gl-write-boundary'], timeoutMs: 300_000 },
  'check:workflow-honesty': { pnpmArgs: ['run', 'check:workflow-honesty'], timeoutMs: 300_000 },
  'check:sensitive-writes': { pnpmArgs: ['run', 'check:sensitive-writes'], timeoutMs: 300_000 },
  'check:sensitive-writes-tests': { pnpmArgs: ['run', 'test:sensitive-writes'], timeoutMs: 300_000 },
  typecheck: { pnpmArgs: ['run', 'typecheck'], timeoutMs: 900_000 },
  'app:architecture': {
    pnpmArgs: [...APP_FILTER, 'run', 'check:architecture'],
    timeoutMs: 300_000,
  },
  'app:typecheck-tests': { pnpmArgs: [...APP_FILTER, 'run', 'typecheck:test'], timeoutMs: 600_000 },
  'app:a11y-primitives': {
    pnpmArgs: [...APP_FILTER, 'run', 'test:a11y-primitives'],
    timeoutMs: 600_000,
  },
  'app:frontend-db-contract': {
    pnpmArgs: [...APP_FILTER, 'run', 'check:frontend-db-contract'],
    timeoutMs: 900_000,
  },
  'db0:gate': { pnpmArgs: ['run', 'db0:gate'], timeoutMs: 1_500_000 },
  'app:test': { pnpmArgs: [...APP_FILTER, 'run', 'test'], timeoutMs: 2_400_000 },
  build: { pnpmArgs: ['run', 'build'], timeoutMs: 1_200_000 },
};

/**
 * Guard: an argv element must never contain whitespace.
 *
 * `corepack pnpm` receives argv verbatim, unlike a shell. A step written as
 * `['--filter ./malek-app', ...]` looks correct in source, fails with
 * "Unknown option: 'filter ./malek-app'", and reports four green=false steps that
 * have nothing to do with the repository. This fail-fast makes that mistake
 * impossible to ship quietly.
 */
for (const [id, step] of Object.entries(STEP_LIBRARY)) {
  for (const arg of step.pnpmArgs) {
    if (/\s/.test(arg)) {
      throw new Error(
        `Local gate step "${id}" has an argv element containing whitespace: ${JSON.stringify(arg)}. ` +
          'Split it into separate elements.',
      );
    }
  }
}

const QUICK_STEPS = [
  'check:docs',
  'check:wiki',
  'check:business-rules',
  'check:execution-plan',
  'check:migration-hygiene',
  'check:enterprise-freeze',
  'check:gl-write-boundary',
  'check:workflow-honesty',
  'check:sensitive-writes',
  'check:sensitive-writes-tests',
  'typecheck',
];

const DEFAULT_STEPS = [
  ...QUICK_STEPS,
  'app:architecture',
  'app:typecheck-tests',
  'app:a11y-primitives',
  'app:frontend-db-contract',
  'db0:gate',
];

const FULL_STEPS = [...DEFAULT_STEPS, 'app:test', 'build'];

const steps = mode === 'quick' ? QUICK_STEPS : mode === 'full' ? FULL_STEPS : DEFAULT_STEPS;

function run(command, args, timeoutMs) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: timeoutMs,
    env: { ...process.env, CI: process.env.CI ?? 'false' },
  });
  const durationMs = Date.now() - startedAt;

  if (result.error?.code === 'ETIMEDOUT') {
    return { status: 'fail', exitCode: null, durationMs, note: `timed out after ${timeoutMs} ms` };
  }
  if (result.error) {
    return { status: 'fail', exitCode: null, durationMs, note: result.error.message };
  }
  return {
    status: result.status === 0 ? 'pass' : 'fail',
    exitCode: result.status,
    durationMs,
  };
}

function readGit(args, fallback = 'unknown') {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) return fallback;
  return result.stdout.trim() || fallback;
}

function formatDuration(ms) {
  if (ms < 1_000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
}

if (!existsSync(resolve(ROOT, 'node_modules'))) {
  console.error('Dependencies are not installed.');
  console.error('');
  console.error('Bootstrap (the sequence CI uses):');
  console.error('  corepack pnpm install --frozen-lockfile --ignore-scripts');
  console.error('  corepack pnpm rebuild esbuild');
  console.error('');
  console.error('Then re-run: corepack pnpm gate:local');
  process.exit(2);
}

const dependencyResult = spawnSync('corepack', ['pnpm', '--version'], {
  cwd: ROOT,
  encoding: 'utf8',
});

const headSha = readGit(['rev-parse', 'HEAD']);
const branch = readGit(['rev-parse', '--abbrev-ref', 'HEAD']);
const dirty = readGit(['status', '--porcelain'], '') !== '';

console.log('='.repeat(72));
console.log(`MALEK local gate — mode: ${mode}`);
console.log(`  repository : ${readGit(['config', '--get', 'remote.origin.url'])}`);
console.log(`  revision   : ${headSha} (${branch})${dirty ? ' — working tree dirty' : ''}`);
console.log(`  toolchain  : node ${process.version}, pnpm ${dependencyResult.stdout?.trim() ?? 'unknown'}`);
console.log('  scope      : credential-free checks only. No Docker, hosted Supabase or browser proof.');
console.log('='.repeat(72));

const results = [];
for (const id of steps) {
  const step = STEP_LIBRARY[id];
  const label = `corepack pnpm ${step.pnpmArgs.join(' ')}`;
  console.log('');
  console.log('─'.repeat(72));
  console.log(`▶ ${id}   (${label})`);
  console.log('─'.repeat(72));

  const outcome = run('corepack', ['pnpm', ...step.pnpmArgs], step.timeoutMs);
  results.push({ id, command: label, ...outcome });

  console.log(`  → ${outcome.status.toUpperCase()} in ${formatDuration(outcome.durationMs)}`);
  if (outcome.status === 'fail' && outcome.note) console.log(`  → ${outcome.note}`);
}

const passed = results.filter((result) => result.status === 'pass');
const failed = results.filter((result) => result.status === 'fail');

console.log('');
console.log('='.repeat(72));
console.log('LOCAL GATE SUMMARY');
console.log('='.repeat(72));
for (const result of results) {
  console.log(
    `  ${result.status === 'pass' ? 'PASS' : 'FAIL'}  ${result.id.padEnd(26)} ${formatDuration(result.durationMs).padStart(8)}`,
  );
}
console.log('─'.repeat(72));
console.log(`  ${passed.length} passed, ${failed.length} failed, ${results.length} total`);

const artifact = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  mode,
  repository: readGit(['config', '--get', 'remote.origin.url']),
  headSha,
  branch,
  workingTreeDirty: dirty,
  toolchain: {
    node: process.version,
    pnpm: dependencyResult.stdout?.trim() ?? 'unknown',
  },
  scope: 'credential-free local checks only; no Docker, hosted Supabase or browser proof',
  steps: results,
  summary: {
    total: results.length,
    passed: passed.length,
    failed: failed.length,
  },
};

mkdirSync(GATE_DIR, { recursive: true });
writeFileSync(resolve(GATE_DIR, 'last-run.json'), `${JSON.stringify(artifact, null, 2)}\n`);
console.log('');
console.log(`Evidence written to .gate/last-run.json (gitignored).`);
console.log(`Cite it as: gate ${mode} at ${headSha.slice(0, 12)} — ${passed.length}/${results.length} passed.`);

if (failed.length > 0) {
  console.log('');
  console.error(`FAILED: ${failed.map((result) => result.id).join(', ')}`);
  process.exit(1);
}
