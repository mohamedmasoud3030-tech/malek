/**
 * PRODUCTION SMOKE / DEPLOYMENT IDENTITY VERIFICATION
 *
 * Proves, from outside the deployment, that the surface a user actually
 * reaches was built from the exact reviewed Git revision — not from a UI
 * version string and not from a human claim.
 *
 * It is deliberately STRICT: every missing input is a hard failure. A release
 * verification step that cannot prove identity must go red, never quietly pass.
 *
 * Usage:
 *   node verify-deployment-identity.mjs --base-url https://malek-plus.vercel.app \
 *                                       --expected-sha <40-hex> \
 *                                       [--expected-schema-digest <hex>]
 *
 * Exit codes: 0 proven · 1 failed / unprovable.
 */

const args = process.argv.slice(2);
function arg(name) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}

function fail(message) {
  console.error(`DEPLOYMENT IDENTITY: FAIL — ${message}`);
  process.exit(1);
}

const baseUrl = arg('base-url')?.trim();
const expectedSha = arg('expected-sha')?.trim();
const expectedSchemaDigest = arg('expected-schema-digest')?.trim();

if (!baseUrl) fail('--base-url is required. A deployment cannot be verified without a target.');
if (!expectedSha) fail('--expected-sha is required. Refusing to verify an unnamed revision.');
if (!/^[0-9a-f]{40}$/.test(expectedSha)) fail(`--expected-sha must be a full 40-character lowercase Git SHA, got "${expectedSha}".`);

let origin;
try {
  origin = new URL(baseUrl);
} catch {
  fail(`--base-url is not a valid absolute URL: "${baseUrl}".`);
}
if (origin.protocol !== 'https:') fail('the verified deployment must be served over HTTPS.');

// The artifact is requested with cache busting and no-store so a stale CDN
// edge can never be mistaken for the current deployment.
const proofUrl = new URL('/build-proof.json', origin);
proofUrl.searchParams.set('verify', expectedSha);

let response;
try {
  response = await fetch(proofUrl, { redirect: 'follow', cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
} catch (error) {
  fail(`could not reach ${origin.origin}/build-proof.json (${error instanceof Error ? error.message : String(error)}).`);
}
if (!response.ok) fail(`${origin.origin}/build-proof.json returned HTTP ${response.status}.`);

let payload;
try {
  payload = await response.json();
} catch {
  fail(`${origin.origin}/build-proof.json is not valid JSON.`);
}

const actualSha = typeof payload?.sha === 'string' ? payload.sha.trim() : '';
if (!actualSha) fail('the deployed build-proof carries no "sha" field.');

const lines = [
  `deployment identity check (${origin.origin})`,
  `  expected sha        : ${expectedSha}`,
  `  deployed sha        : ${actualSha}`,
  `  deployed builtAt    : ${payload?.builtAt ?? '<absent>'}`,
  `  deployed schema     : ${payload?.schemaDigest ?? '<absent>'} (${payload?.migrationCount ?? '?'} migrations)`,
  `  expected schema     : ${expectedSchemaDigest ?? '<not asserted>'}`,
];

if (actualSha !== expectedSha) {
  console.error(lines.join('\n'));
  fail(`deployed revision ${actualSha} is NOT the reviewed revision ${expectedSha}. Do not release.`);
}

if (expectedSchemaDigest && payload?.schemaDigest !== expectedSchemaDigest) {
  console.error(lines.join('\n'));
  fail(
    `deployed schema digest ${payload?.schemaDigest ?? '<absent>'} does not match the reviewed migration manifest ${expectedSchemaDigest}. `
    + 'The deployment was built from a different database manifest than the one under review.',
  );
}

if (actualSha === 'local') fail('the deployed proof reports "local"; a real deployment must stamp a Git revision.');

console.log(lines.join('\n'));
console.log('DEPLOYMENT IDENTITY: PASS — built artifact SHA equals deployed SHA equals reviewed SHA.');
