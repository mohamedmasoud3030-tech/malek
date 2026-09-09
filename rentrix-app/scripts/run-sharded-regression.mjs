/**
 * Sequential sharded runner for the full Vitest suite.
 *
 * This sandbox has ~2 GB of RAM. A single Vitest process that loads all 545
 * test files accumulates enough retained heap (mostly PGlite instances) to be
 * SIGKILLed by the OOM killer part-way through — which is a RESOURCE failure,
 * not a test result, and must never be reported as either a pass or a
 * meaningful failure.
 *
 * This runner executes the same suite, with the same config and the same
 * exclusions, in N sequential Vitest invocations. Each shard is a fresh
 * process, so heap is reclaimed between shards. Results are summed and any
 * shard that dies from a signal is reported explicitly as INFRA, distinct from
 * a genuine test failure.
 *
 * Usage: node scripts/run-sharded-regression.mjs [shardCount]
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SHARDS = Number(process.argv[2] ?? 12);
const ROOT = new URL('..', import.meta.url).pathname;
const EXCLUDED = new Set(['src/components/ui/primitives.axe.test.tsx']);

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      collect(full, out);
    } else if (/\.test\.(ts|tsx)$/.test(entry)) {
      const rel = relative(ROOT, full);
      if (!EXCLUDED.has(rel)) out.push(rel);
    }
  }
  return out;
}

const files = collect(join(ROOT, 'src')).sort();
const shards = Array.from({ length: SHARDS }, () => []);
// Round-robin keeps heavy PGlite suites spread across shards.
files.forEach((file, index) => shards[index % SHARDS].push(file));

let totalFiles = 0;
let totalTests = 0;
let failedShards = 0;
let infraShards = 0;
const failures = [];

for (const [index, shard] of shards.entries()) {
  if (shard.length === 0) continue;
  process.stdout.write(`\n===== SHARD ${index + 1}/${SHARDS} — ${shard.length} files =====\n`);
  const result = spawnSync(
    'node',
    [
      join(ROOT, 'node_modules/vitest/vitest.mjs'),
      'run',
      '--config', join(ROOT, 'vite.config.ts'),
      '--pool=threads',
      '--poolOptions.threads.singleThread=true',
      '--maxWorkers=1',
      '--reporter=default',
      ...shard,
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=512 --max-semi-space-size=8',
      },
    },
  );

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);

  if (result.signal) {
    infraShards += 1;
    failures.push(`SHARD ${index + 1}: INFRA — killed by ${result.signal} (resource limit, not a test verdict)`);
    continue;
  }

  const fileLine = output.match(/Test Files\s+(?:(\d+) failed \| )?(\d+) passed(?: \| (\d+) skipped)?\s+\((\d+)\)/);
  const testLine = output.match(/Tests\s+(?:(\d+) failed \| )?(\d+) passed(?: \| (\d+) skipped)?\s+\((\d+)\)/);
  if (fileLine) totalFiles += Number(fileLine[4]);
  if (testLine) totalTests += Number(testLine[4]);

  if (result.status !== 0) {
    failedShards += 1;
    for (const line of output.split('\n')) {
      if (/^\s*(FAIL|×)\s/.test(line)) failures.push(`SHARD ${index + 1}: ${line.trim()}`);
    }
  }
}

process.stdout.write('\n\n================ SHARDED REGRESSION SUMMARY ================\n');
process.stdout.write(`Test files executed : ${totalFiles}\n`);
process.stdout.write(`Tests executed      : ${totalTests}\n`);
process.stdout.write(`Shards with failures: ${failedShards}\n`);
process.stdout.write(`Shards killed (INFRA): ${infraShards}\n`);
if (failures.length > 0) {
  process.stdout.write('\nDetails:\n');
  for (const failure of failures) process.stdout.write(`  ${failure}\n`);
}
process.stdout.write(
  failedShards === 0 && infraShards === 0
    ? '\nRESULT: PASS\n'
    : '\nRESULT: NOT CLEAN — see details above\n',
);
process.exit(failedShards === 0 && infraShards === 0 ? 0 : 1);
