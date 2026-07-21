const REQUIRED_ENV = [
  'E2E_BASE_URL',
  'E2E_TEST_EMAIL',
  'E2E_TEST_PASSWORD',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

for (const name of REQUIRED_ENV) {
  if (!process.env[name]?.trim()) {
    throw new Error(`${name} is required for authenticated read-only verification.`);
  }
}

function parseHttpsUrl(name, value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS for deployed verification.`);
  }
  return parsed;
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timeout);
  }
}

const appUrl = parseHttpsUrl('E2E_BASE_URL', process.env.E2E_BASE_URL.trim());
const supabaseUrl = parseHttpsUrl('VITE_SUPABASE_URL', process.env.VITE_SUPABASE_URL.trim());
const anonKey = process.env.VITE_SUPABASE_ANON_KEY.trim();

const appResponse = await fetchWithTimeout(appUrl, { method: 'GET' });
if (!appResponse.ok) {
  throw new Error(`Deployed application preflight failed with HTTP ${appResponse.status}.`);
}

const authSettingsUrl = new URL('/auth/v1/settings', supabaseUrl);
const authResponse = await fetchWithTimeout(authSettingsUrl, {
  method: 'GET',
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  },
});
if (!authResponse.ok) {
  throw new Error(`Supabase Auth read-only preflight failed with HTTP ${authResponse.status}.`);
}

console.log(`Read-only preflight: app=${appResponse.status}, auth=${authResponse.status}`);
