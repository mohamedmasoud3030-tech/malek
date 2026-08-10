import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./agent-qa-preflight.mjs', import.meta.url));
const databaseScript = fileURLToPath(new URL('./verify-agent-qa-database-contracts.sh', import.meta.url));
const baseEnvironment = {
  PATH: process.env.PATH,
  QA_ENVIRONMENT_KIND: 'qa',
  QA_SUPABASE_PROJECT_REF: 'qa-project',
  PRODUCTION_SUPABASE_PROJECT_REF: 'production-project',
  VITE_SUPABASE_URL: 'https://qa-project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'public-qa-key',
  QA_ADMIN_EMAIL: 'qa-admin@example.invalid',
  QA_ADMIN_PASSWORD: 'not-a-real-password',
};

function run(overrides = {}) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...baseEnvironment, ...overrides },
  });
}

describe('agent QA preflight fail-closed guards', () => {
  it('requires a declared Production ref before any network request', () => {
    const result = run({ PRODUCTION_SUPABASE_PROJECT_REF: '' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PRODUCTION_SUPABASE_PROJECT_REF is required/);
  });

  it('rejects a QA ref that matches Production before any network request', () => {
    const result = run({
      QA_SUPABASE_PROJECT_REF: 'production-project',
      VITE_SUPABASE_URL: 'https://production-project.supabase.co',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must never equal PRODUCTION_SUPABASE_PROJECT_REF/);
  });

  it('rejects a URL that is not exactly the declared QA project before any network request', () => {
    const result = run({ VITE_SUPABASE_URL: 'https://different-project.supabase.co' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must point exactly to QA_SUPABASE_PROJECT_REF over HTTPS/);
  });

  it('does not run a database probe without the dedicated QA contract inputs', () => {
    const result = spawnSync('bash', [databaseScript], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /QA_ENVIRONMENT_KIND is required/);
  });
});
