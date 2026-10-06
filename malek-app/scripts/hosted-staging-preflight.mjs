const required = ['E2E_BASE_URL', 'E2E_EXPECTED_SHA', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'E2E_TEST_EMAIL', 'E2E_TEST_PASSWORD'];
for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required for hosted staging proof.`);
}

const baseUrl = new URL(process.env.E2E_BASE_URL.trim());
if (baseUrl.protocol !== 'https:') throw new Error('Hosted staging must use HTTPS.');

const expectedSha = process.env.E2E_EXPECTED_SHA.trim();
let actualSha = null;
let lastError = null;
for (let attempt = 1; attempt <= 40; attempt += 1) {
  try {
    const response = await fetch(new URL('/build-proof.json', baseUrl), { redirect: 'follow', cache: 'no-store' });
    if (!response.ok) throw new Error(`build-proof returned ${response.status}`);
    const payload = await response.json();
    actualSha = typeof payload?.sha === 'string' ? payload.sha.trim() : null;
    if (actualSha === expectedSha) break;
    lastError = new Error(`staging SHA ${actualSha ?? '<missing>'} != expected ${expectedSha}`);
  } catch (error) {
    lastError = error;
  }
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}

if (actualSha !== expectedSha) throw lastError ?? new Error('Could not prove staging SHA.');

const supabaseUrl = new URL(process.env.VITE_SUPABASE_URL.trim());
if (supabaseUrl.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS.');

console.log(JSON.stringify({ hostedStagingPreflight: 'passed', baseUrl: baseUrl.origin, sha: actualSha, supabaseHost: supabaseUrl.host }));
