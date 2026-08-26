#!/usr/bin/env node
/**
 * Authoritative frontend ↔ database contract entry point.
 *
 * Runs fail-closed drift self-tests first, then validates the current production
 * frontend against the generated database contract. This keeps one documented
 * command while proving both the checker itself and the repository contract.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const selfTestPath = fileURLToPath(new URL('./check-frontend-db-contract.test.mjs', import.meta.url));
const checkerPath = fileURLToPath(new URL('./check-frontend-db-contract.mjs', import.meta.url));

function run(label, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(process.execPath, args, {
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.signal) {
    console.error(`${label} terminated by ${result.signal}.`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('Contract gate self-tests', ['--test', selfTestPath]);
run('Repository frontend/database parity', [checkerPath]);
