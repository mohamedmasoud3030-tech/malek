const PRESENTATION_SUPABASE_PROJECT_REF = 'nnggcnpcuomwfuupupwg';

const env = {
  vercelEnvironment: process.env.VERCEL_ENV?.trim().toLowerCase(),
  url: process.env.VITE_SUPABASE_URL?.trim(),
  anonKey: process.env.VITE_SUPABASE_ANON_KEY?.trim(),
};

function fail(message) {
  throw new Error(`MALEK production-demo preflight: ${message}`);
}

// Preview/local builds remain untouched. The production gate exists to pin the
// public presentation surface to the owner-approved current Supabase main
// dataset and to prevent silent environment drift.
if (env.vercelEnvironment !== 'production') {
  console.log(JSON.stringify({
    gate: 'production-demo-preflight',
    status: 'not-applicable',
    environment: env.vercelEnvironment ?? 'local',
  }));
  process.exit(0);
}

if (!env.url) fail('VITE_SUPABASE_URL is required for Vercel Production.');
if (!env.anonKey) fail('VITE_SUPABASE_ANON_KEY is required for Vercel Production.');

let target;
try {
  target = new URL(env.url);
} catch {
  fail('VITE_SUPABASE_URL must be a valid URL.');
}
if (target.protocol !== 'https:') fail('VITE_SUPABASE_URL must use HTTPS.');

const expectedHost = `${PRESENTATION_SUPABASE_PROJECT_REF}.supabase.co`;
if (target.hostname !== expectedHost) {
  fail(`VITE_SUPABASE_URL must remain pinned to the approved presentation project (${expectedHost}).`);
}

// Legacy Supabase anon keys are JWTs that carry the project ref. Validate it
// when available; newer publishable-key formats are opaque and are accepted
// after the URL pin above.
const parts = env.anonKey.split('.');
if (parts.length === 3) {
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload?.ref && payload.ref !== PRESENTATION_SUPABASE_PROJECT_REF) {
      fail(`VITE_SUPABASE_ANON_KEY belongs to a different Supabase project (${payload.ref}).`);
    }
  } catch (error) {
    if (String(error?.message ?? '').startsWith('MALEK production-demo preflight:')) throw error;
    fail('VITE_SUPABASE_ANON_KEY looks like a JWT but its payload cannot be validated.');
  }
}

console.log(JSON.stringify({
  gate: 'production-demo-preflight',
  status: 'approved',
  datasetMode: 'shared-current-main-demo',
  targetProjectRef: PRESENTATION_SUPABASE_PROJECT_REF,
  environmentDriftBlocked: true,
}));
