const required = [
  'E2E_BASE_URL',
  'E2E_TEST_EMAIL',
  'E2E_TEST_PASSWORD',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'E2E_ENVIRONMENT_KIND',
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`BLOCKED: missing release-blocker environment values: ${missing.join(', ')}`);
  console.error('Authenticated launch-blocker tests are not allowed to skip when staging configuration is absent.');
  process.exit(1);
}

if (process.env.E2E_ENVIRONMENT_KIND !== 'staging') {
  console.error('BLOCKED: E2E_ENVIRONMENT_KIND must equal "staging". Production is not an approved release-blocker test target.');
  process.exit(1);
}

let baseUrl;
let supabaseUrl;
try {
  baseUrl = new URL(process.env.E2E_BASE_URL);
  supabaseUrl = new URL(process.env.VITE_SUPABASE_URL);
} catch {
  console.error('BLOCKED: E2E_BASE_URL and VITE_SUPABASE_URL must be valid absolute URLs.');
  process.exit(1);
}

if (baseUrl.protocol !== 'https:' || supabaseUrl.protocol !== 'https:') {
  console.error('BLOCKED: staging application and Supabase URLs must use HTTPS.');
  process.exit(1);
}

if (['localhost', '127.0.0.1'].includes(baseUrl.hostname)) {
  console.error('BLOCKED: real authentication tests require a deployed staging target, not a local mock server.');
  process.exit(1);
}

console.log('Release-blocker environment preflight passed. Values remain redacted.');
