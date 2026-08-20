#!/usr/bin/env node
/**
 * Backward-compatible entry point for the authoritative frontend/database gate.
 *
 * Contract inventory and validation live in check-frontend-db-contract.mjs.
 * Keeping this file as a thin process wrapper prevents two independent lists
 * from drifting while preserving the documented command name.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checkerPath = fileURLToPath(new URL('./check-frontend-db-contract.mjs', import.meta.url));
const result = spawnSync(process.execPath, [checkerPath], {
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.signal) {
  console.error(`Frontend/database contract gate terminated by ${result.signal}.`);
  process.exit(1);
}

process.exit(result.status ?? 1);
