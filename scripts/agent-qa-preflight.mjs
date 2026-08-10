/**
 * Authenticated, read-only proof that an agent is connected to the intended
 * hosted QA project. This deliberately never accepts a production project.
 *
 * Required environment (provided by the agent runtime, never committed):
 * QA_ENVIRONMENT_KIND=qa
 * QA_SUPABASE_PROJECT_REF=<QA project ref>
 * PRODUCTION_SUPABASE_PROJECT_REF=<production project ref; comparison only>
 * VITE_SUPABASE_URL=https://<QA project ref>.supabase.co
 * VITE_SUPABASE_ANON_KEY=<publishable/anon key>
 * QA_ADMIN_EMAIL=<seeded QA admin>
 * QA_ADMIN_PASSWORD=<seeded QA admin password>
 */

const required = [
  'QA_ENVIRONMENT_KIND',
  'QA_SUPABASE_PROJECT_REF',
  'PRODUCTION_SUPABASE_PROJECT_REF',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'QA_ADMIN_EMAIL',
  'QA_ADMIN_PASSWORD',
];

for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required for the hosted QA preflight.`);
}

if (process.env.QA_ENVIRONMENT_KIND.trim().toLowerCase() !== 'qa') {
  throw new Error('QA_ENVIRONMENT_KIND must be exactly qa. This preflight refuses unknown environments.');
}

const qaRef = process.env.QA_SUPABASE_PROJECT_REF.trim();
const productionRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF.trim();
if (qaRef === productionRef) {
  throw new Error('QA_SUPABASE_PROJECT_REF must never equal PRODUCTION_SUPABASE_PROJECT_REF.');
}

let supabaseUrl;
try {
  supabaseUrl = new URL(process.env.VITE_SUPABASE_URL.trim());
} catch {
  throw new Error('VITE_SUPABASE_URL must be an absolute HTTPS URL.');
}
if (supabaseUrl.protocol !== 'https:' || supabaseUrl.hostname !== `${qaRef}.supabase.co`) {
  throw new Error('VITE_SUPABASE_URL must point exactly to QA_SUPABASE_PROJECT_REF over HTTPS.');
}

const anonKey = process.env.VITE_SUPABASE_ANON_KEY.trim();
const email = process.env.QA_ADMIN_EMAIL.trim();
const password = process.env.QA_ADMIN_PASSWORD.trim();

async function request(path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(new URL(path, supabaseUrl), { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function headers(accessToken) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken ?? anonKey}`,
    Accept: 'application/json',
  };
}

async function expectOk(label, response) {
  if (response.ok) return response;
  const body = (await response.text()).slice(0, 400);
  throw new Error(`${label} failed with HTTP ${response.status}: ${body || 'no response body'}`);
}

// Verify the public key can reach Auth before attempting a password grant.
await expectOk('Auth settings', await request('/auth/v1/settings', { headers: headers() }));

const signIn = await expectOk('QA admin sign-in', await request('/auth/v1/token?grant_type=password', {
  method: 'POST',
  headers: { ...headers(), 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
}));
const session = await signIn.json();
if (!session.access_token || !session.user?.id) throw new Error('QA admin sign-in returned no usable session.');

const token = session.access_token;
try {
  const company = await expectOk('current_company_id RPC', await request('/rest/v1/rpc/current_company_id', {
    method: 'POST',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: '{}',
  }));
  const companyId = await company.json();
  if (!companyId) throw new Error('current_company_id returned an empty value for the QA admin.');

  const membership = await expectOk('active company membership query', await request(
    `/rest/v1/company_members?select=company_id,role,is_active&user_id=eq.${encodeURIComponent(session.user.id)}&is_active=eq.true&limit=2`,
    { headers: headers(token) },
  ));
  const memberships = await membership.json();
  if (!Array.isArray(memberships) || !memberships.some((row) => row.company_id === companyId)) {
    throw new Error('QA admin has no active membership for its current company.');
  }

  // These are deliberately GET-only table probes. An empty QA dataset is valid;
  // a schema/RLS/API mismatch is not.
  for (const table of ['properties', 'units', 'contracts', 'invoices', 'receipts']) {
    await expectOk(`${table} read probe`, await request(`/rest/v1/${table}?select=id&limit=1`, { headers: headers(token) }));
  }

  console.log(JSON.stringify({
    ok: true,
    environment: 'qa',
    projectRef: qaRef,
    userId: session.user.id,
    companyId,
    membershipCount: memberships.length,
    checkedAt: new Date().toISOString(),
  }));
} finally {
  // A password grant creates a refresh-token session. Revoke it even though no
  // data was mutated, so repeated agent checks do not accumulate sessions.
  await request('/auth/v1/logout', { method: 'POST', headers: headers(token) }).catch(() => undefined);
}
