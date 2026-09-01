import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = new URL('./production-demo-preflight.mjs', import.meta.url);
const LIVE_REF = 'nnggcnpcuomwfuupupwg';
const DEMO_REF = 'abcdefghijklmnopqrst';

function run(overrides = {}) {
  const env = {
    ...process.env,
    VERCEL_ENV: 'production',
    MALEK_DEPLOYMENT_PROFILE: 'production-demo',
    PRODUCTION_DEMO_APPROVED: '1',
    PRODUCTION_SUPABASE_PROJECT_REF: LIVE_REF,
    DEMO_SUPABASE_PROJECT_REF: DEMO_REF,
    VITE_SUPABASE_URL: `https://${DEMO_REF}.supabase.co`,
    ...overrides,
  };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key];
  }
  return spawnSync(process.execPath, [script.pathname], { env, encoding: 'utf8' });
}

test('preview builds are not blocked by the production-demo gate', () => {
  const result = run({
    VERCEL_ENV: 'preview',
    MALEK_DEPLOYMENT_PROFILE: undefined,
    PRODUCTION_DEMO_APPROVED: undefined,
    DEMO_SUPABASE_PROJECT_REF: undefined,
    VITE_SUPABASE_URL: 'https://example.supabase.co',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"status":"not-applicable"/);
});

test('Vercel Production requires the explicit production-demo profile', () => {
  const result = run({ MALEK_DEPLOYMENT_PROFILE: undefined });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /MALEK_DEPLOYMENT_PROFILE=production-demo/);
});

test('production demo requires explicit release approval', () => {
  const result = run({ PRODUCTION_DEMO_APPROVED: undefined });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PRODUCTION_DEMO_APPROVED=1/);
});

test('production demo refuses the canonical MALEK live Supabase project', () => {
  const result = run({
    DEMO_SUPABASE_PROJECT_REF: LIVE_REF,
    VITE_SUPABASE_URL: `https://${LIVE_REF}.supabase.co`,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /physically separate from MALEK live Production/);
});

test('production demo refuses a URL that does not match the declared demo ref', () => {
  const result = run({ VITE_SUPABASE_URL: 'https://differentprojectref.supabase.co' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must exactly target the declared Demo project/);
});

test('production demo refuses a falsified production ref', () => {
  const result = run({ PRODUCTION_SUPABASE_PROJECT_REF: 'not-the-live-project' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must identify the canonical MALEK live project/);
});

test('production demo accepts an explicitly approved, physically separate demo project', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"status":"approved"/);
  assert.match(result.stdout, new RegExp(`"targetProjectRef":"${DEMO_REF}"`));
});
