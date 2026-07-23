const required = [
  'E2E_TEST_EMAIL',
  'E2E_TEST_PASSWORD',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'E2E_ENVIRONMENT_KIND',
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`BLOCKED: missing release-blocker environment values: ${missing.join(', ')}`);
  console.error('Authenticated read-only verification must fail, not skip, when credentials are absent.');
  process.exit(1);
}

if (process.env.E2E_ENVIRONMENT_KIND !== 'production-readonly') {
  console.error('BLOCKED: E2E_ENVIRONMENT_KIND must equal "production-readonly" for the deployed Auth verification job.');
  console.error('All financial and storage write rehearsals run only on the isolated ephemeral Supabase stack.');
  process.exit(1);
}

const fallbackEmailDomain = 'gmail.com';
const rawTestEmail = process.env.E2E_TEST_EMAIL.trim();
const testEmail = rawTestEmail.endsWith('@') ? `${rawTestEmail}${fallbackEmailDomain}` : rawTestEmail;
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
  console.error('BLOCKED: E2E_TEST_EMAIL must be a syntactically valid email address. The value remains redacted.');
  process.exit(1);
}

let supabaseUrl;
try {
  supabaseUrl = new URL(process.env.VITE_SUPABASE_URL);
} catch {
  console.error('BLOCKED: VITE_SUPABASE_URL must be a valid absolute URL.');
  process.exit(1);
}

if (supabaseUrl.protocol !== 'https:') {
  console.error('BLOCKED: the live Supabase URL must use HTTPS.');
  process.exit(1);
}

console.log('Read-only PR candidate environment preflight passed. Values remain redacted.');
