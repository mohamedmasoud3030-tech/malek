import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = new URL('./production-demo-preflight.mjs', import.meta.url);
const PRESENTATION_REF = 'nnggcnpcuomwfuupupwg';

function makeJwt(ref = PRESENTATION_REF) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ ref, role: 'anon' })).toString('base64url');
  return `${header}.${payload}.signature`;
}

function run(overrides = {}) {
  const env = {
    ...process.env,
    VERCEL_ENV: 'production',
    VITE_SUPABASE_URL: `https://${PRESENTATION_REF}.supabase.co`,
    VITE_SUPABASE_ANON_KEY: makeJwt(),
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
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: undefined,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"status":"not-applicable"/);
});

test('Vercel Production requires the Supabase URL', () => {
  const result = run({ VITE_SUPABASE_URL: undefined });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /VITE_SUPABASE_URL is required/);
});

test('Vercel Production requires the public Supabase key', () => {
  const result = run({ VITE_SUPABASE_ANON_KEY: undefined });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /VITE_SUPABASE_ANON_KEY is required/);
});

test('production demo requires HTTPS', () => {
  const result = run({ VITE_SUPABASE_URL: `http://${PRESENTATION_REF}.supabase.co` });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must use HTTPS/);
});

test('production demo rejects drift to a different Supabase project', () => {
  const result = run({ VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must remain pinned to the approved presentation project/);
});

test('production demo rejects a JWT key from another Supabase project', () => {
  const result = run({ VITE_SUPABASE_ANON_KEY: makeJwt('abcdefghijklmnopqrst') });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /belongs to a different Supabase project/);
});

test('production demo accepts the owner-approved current Supabase main dataset', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"status":"approved"/);
  assert.match(result.stdout, /"datasetMode":"shared-current-main-demo"/);
  assert.match(result.stdout, new RegExp(`"targetProjectRef":"${PRESENTATION_REF}"`));
});
