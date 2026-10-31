/**
 * Self-test for the deployment identity verifier.
 *
 * The verifier is release-critical: a bug that lets it exit zero on a mismatch
 * would silently certify the wrong build. Exercise both a matching deployed
 * artifact and fail-closed mismatch paths by replacing only the test process's
 * fetch implementation with an in-memory response.
 *
 * This does NOT prove a hosted deployment: it proves the verifier's decision
 * logic. Hosted release validation must still fetch the real /build-proof.json.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { strict as assert } from 'node:assert';

const here = dirname(fileURLToPath(import.meta.url));
const verifier = join(here, 'verify-deployment-identity.mjs');

const REVIEWED_SHA = 'e7943a5e4e91afc730ae80992b44984b8788fcf2';
const OTHER_SHA = '0000000000000000000000000000000000000000';
const TARGET_URL = 'https://release-check.example.invalid';
const expectedArgs = [
  '--base-url', TARGET_URL,
  '--expected-sha', REVIEWED_SHA,
  '--expected-edition', 'property-operations',
  '--expected-schema-digest', 'abc123',
];

function mockedFetchImport({ payload = {}, status = 200, invalidJson = false } = {}) {
  // --import preloads this mock in a child process; no runtime verifier code is
  // changed and there is no network activity in the simulated proof cases.
  const jsonBody = invalidJson
    ? "throw new SyntaxError('invalid JSON')"
    : `return ${JSON.stringify(payload)}`;
  const loader = `globalThis.fetch = async (url, options) => {
    if (new URL(url).pathname !== '/build-proof.json') throw new Error('wrong proof path');
    if (options?.cache !== 'no-store') throw new Error('proof must bypass cache');
    return {
      ok: ${status >= 200 && status < 300},
      status: ${status},
      json: async () => { ${jsonBody}; }
    };
  };`;
  return `data:text/javascript,${encodeURIComponent(loader)}`;
}

function run(args, mockResponse) {
  const preload = mockResponse === undefined ? [] : ['--import', mockedFetchImport(mockResponse)];
  try {
    const stdout = execFileSync(process.execPath, [...preload, verifier, ...args], { encoding: 'utf8' });
    return { code: 0, output: stdout };
  } catch (error) {
    return {
      code: typeof error.status === 'number' ? error.status : 1,
      output: `${error.stdout ?? ''}${error.stderr ?? ''}`,
    };
  }
}

const validProof = {
  sha: REVIEWED_SHA,
  productEdition: 'property-operations',
  schemaDigest: 'abc123',
  migrationCount: 112,
  builtAt: '2026-10-31T00:00:00.000Z',
};

// Argument validation must fail before fetch, including HTTPS enforcement.
assert.equal(run([]).code, 1, 'no arguments must fail');
assert.equal(run(['--base-url', TARGET_URL]).code, 1, 'a missing SHA must fail');
assert.equal(
  run(['--base-url', TARGET_URL, '--expected-sha', 'abc']).code,
  1, 'an abbreviated SHA must fail',
);
const invalidEdition = run([
  '--base-url', TARGET_URL, '--expected-sha', REVIEWED_SHA,
  '--expected-edition', 'enterprise',
]);
assert.equal(invalidEdition.code, 1, 'unknown editions must fail');
assert.match(invalidEdition.output, /expected-edition must be standard or property-operations/);
const insecureUrl = run([
  '--base-url', 'http://127.0.0.1:3000', '--expected-sha', REVIEWED_SHA,
]);
assert.equal(insecureUrl.code, 1, 'plain HTTP must be refused');
assert.match(insecureUrl.output, /HTTPS/i);

// A valid response proves the verifier can actually exit zero for the reviewed
// SHA, edition and migration digest — the previous test never covered this.
const accepted = run(expectedArgs, { payload: validProof });
assert.equal(accepted.code, 0, `the matching proof must pass: ${accepted.output}`);
assert.match(accepted.output, /DEPLOYMENT IDENTITY: PASS/);

const wrongSha = run(expectedArgs, { payload: { ...validProof, sha: OTHER_SHA } });
assert.equal(wrongSha.code, 1, 'a different deployed SHA must fail');
assert.match(wrongSha.output, /NOT the reviewed revision/);

const wrongEdition = run(expectedArgs, { payload: { ...validProof, productEdition: 'standard' } });
assert.equal(wrongEdition.code, 1, 'a different edition must fail');
assert.match(wrongEdition.output, /does not match expected edition/);

const wrongSchema = run(expectedArgs, { payload: { ...validProof, schemaDigest: 'different' } });
assert.equal(wrongSchema.code, 1, 'a mismatched schema digest must fail');
assert.match(wrongSchema.output, /does not match the reviewed migration manifest/);

const missingSha = run(expectedArgs, { payload: { ...validProof, sha: '' } });
assert.equal(missingSha.code, 1, 'a missing proof SHA must fail');
assert.match(missingSha.output, /carries no "sha" field/);

const serverError = run(expectedArgs, { status: 503, payload: validProof });
assert.equal(serverError.code, 1, 'HTTP errors must fail');
assert.match(serverError.output, /HTTP 503/);

const invalidJson = run(expectedArgs, { invalidJson: true });
assert.equal(invalidJson.code, 1, 'invalid JSON must fail');
assert.match(invalidJson.output, /not valid JSON/);

// Unreachable hosted target must fail closed without a mocked fetch.
const unreachable = run([
  '--base-url', 'https://127.0.0.1:1', '--expected-sha', REVIEWED_SHA,
]);
assert.equal(unreachable.code, 1, 'an unreachable deployment must fail');

console.log('Deployment identity verifier: matching proof PASS; SHA, edition, schema, missing/invalid proof and HTTPS failures PASS');
