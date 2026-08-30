#!/usr/bin/env node
// Unified local Supabase proof runner.
//
// Executes the smallest high-confidence set that this repository can prove
// without Docker, hosted credentials, or production data:
//   1. privileged-key exposure
//   2. current-schema RLS / auth / integrity matrix (PGlite)
//   3. focused client/UI Vitest files for session, visibility, functions
//
// Hosted Auth HTTP, Storage HTTP, Realtime reconnect, and production smoke
// stay outside this process and are reported as not-executable here.

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const layers = [
  {
    id: 'privileged-keys',
    title: 'Privileged-key exposure protection',
    cmd: ['node', [join(HERE, 'privileged-key-scan.mjs')]],
  },
  {
    id: 'rls-matrix',
    title: 'Current-schema RLS / auth / integrity matrix',
    cmd: ['node', [join(HERE, 'rls-matrix.mjs')]],
  },
  {
    id: 'internal-gl-rpc-boundary',
    title: 'Internal GL posting/helper RPC browser EXECUTE boundary',
    cmd: ['node', [join(HERE, 'internal-gl-rpc-browser-boundary.mjs')]],
  },
  {
    id: 'client-visibility',
    title: 'Client session, data-visibility, and function contracts',
    cmd: [
      'pnpm',
      [
        '--filter',
        './rentrix-app',
        'exec',
        'vitest',
        'run',
        '--config',
        'vite.config.ts',
        'src/lib/supabase-client-boundary.test.ts',
        'src/lib/env-validation.test.ts',
        'src/services/auth-service.test.ts',
        'src/features/supabase-data-visibility/critical-page-states.test.ts',
        'src/features/dashboard/dashboard-page.test.tsx',
        'src/features/contracts/ContractsListPage.test.tsx',
        'src/features/properties/properties-list-page-states.test.tsx',
        'src/features/auth/login-page.test.tsx',
        'src/features/auth/password-recovery-page.test.tsx',
        'src/features/auth/r5-authorization-matrix.test.ts',
        'src/features/ai-assistant/services/ai-assistant-edge-function.test.ts',
        'src/hooks/use-company.test.tsx',
        'src/hooks/use-company-regression.test.ts',
      ],
    ],
  },
];

function parseVitestCounts(output) {
  const match = output.match(/Tests\s+(\d+)\s+passed(?:\s+\|\s+(\d+)\s+failed)?(?:\s+\|\s+(\d+)\s+skipped)?/i)
    || output.match(/(\d+)\s+passed(?:\s+\|\s+(\d+)\s+failed)?(?:\s+\|\s+(\d+)\s+skipped)?/);
  if (!match) return { passed: output.includes('FAIL') ? 0 : null, failed: output.includes('FAIL') ? 1 : 0, skipped: 0 };
  return {
    passed: Number(match[1] ?? 0),
    failed: Number(match[2] ?? 0),
    skipped: Number(match[3] ?? 0),
  };
}

function parseMatrixCounts(output) {
  const match = output.match(/(\d+)\s+passed\s+(\d+)\s+failed\s+(\d+)\s+skipped/);
  if (!match) return { passed: output.includes('PASS') && !output.includes('FAIL') ? 1 : 0, failed: output.includes('FAIL') ? 1 : 0, skipped: 0 };
  return { passed: Number(match[1]), failed: Number(match[2]), skipped: Number(match[3]) };
}

const summary = [];
for (const layer of layers) {
  process.stdout.write(`\n${'='.repeat(70)}\n[${layer.id}] ${layer.title}\n${'='.repeat(70)}\n`);
  const started = Date.now();
  const res = spawnSync(layer.cmd[0], layer.cmd[1], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, VITEST: 'true' },
    maxBuffer: 20 * 1024 * 1024,
  });
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  process.stdout.write(output);
  const counts = layer.id === 'client-visibility' ? parseVitestCounts(output) : parseMatrixCounts(output);
  if (layer.id === 'privileged-keys') {
    counts.passed = res.status === 0 ? 1 : 0;
    counts.failed = res.status === 0 ? 0 : 1;
    counts.skipped = 0;
  }
  summary.push({
    id: layer.id,
    title: layer.title,
    ok: res.status === 0,
    status: res.status,
    seconds: ((Date.now() - started) / 1000).toFixed(1),
    ...counts,
    tail: output.trim().split('\n').slice(-12).join('\n'),
  });
}

const artifact = {
  generatedAt: new Date().toISOString(),
  environment: {
    docker: false,
    psql: false,
    hostedSupabase: false,
    runner: 'scripts/supabase-tests/run.mjs',
  },
  layers: summary,
};

writeFileSync(join(HERE, 'last-run.json'), JSON.stringify(artifact, null, 2));

console.log(`\n${'='.repeat(70)}\nSUPABASE TEST SUITE\n${'='.repeat(70)}`);
for (const layer of summary) {
  console.log(
    `  ${layer.ok ? 'PASS' : 'FAIL'}  ${layer.id.padEnd(22)} ${layer.seconds}s  ${layer.passed ?? '?'} passed / ${layer.failed ?? '?'} failed / ${layer.skipped ?? 0} skipped`,
  );
}

process.exit(summary.some((layer) => !layer.ok) ? 1 : 0);
