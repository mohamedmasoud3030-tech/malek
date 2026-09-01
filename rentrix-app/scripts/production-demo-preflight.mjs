const CANONICAL_MALEK_PRODUCTION_REF = 'nnggcnpcuomwfuupupwg';

const env = {
  vercelEnvironment: process.env.VERCEL_ENV?.trim().toLowerCase(),
  profile: process.env.MALEK_DEPLOYMENT_PROFILE?.trim().toLowerCase(),
  approved: process.env.PRODUCTION_DEMO_APPROVED?.trim(),
  url: process.env.VITE_SUPABASE_URL?.trim(),
  demoRef: process.env.DEMO_SUPABASE_PROJECT_REF?.trim(),
  productionRef: process.env.PRODUCTION_SUPABASE_PROJECT_REF?.trim(),
};

function fail(message) {
  throw new Error(`MALEK production-demo preflight: ${message}`);
}

// Preview/local builds remain untouched. The hard fail is deliberately scoped
// to Vercel's production environment so PR previews can keep using hermetic
// test values without gaining mutation authority.
if (env.vercelEnvironment !== 'production') {
  console.log(JSON.stringify({
    gate: 'production-demo-preflight',
    status: 'not-applicable',
    environment: env.vercelEnvironment ?? 'local',
  }));
  process.exit(0);
}

if (env.profile !== 'production-demo') {
  fail('Vercel Production must declare MALEK_DEPLOYMENT_PROFILE=production-demo.');
}
if (env.approved !== '1') {
  fail('PRODUCTION_DEMO_APPROVED=1 is required for the presentation deployment.');
}
if (!env.url) fail('VITE_SUPABASE_URL is required.');
if (!env.demoRef) fail('DEMO_SUPABASE_PROJECT_REF is required.');
if (!env.productionRef) fail('PRODUCTION_SUPABASE_PROJECT_REF is required.');

if (env.productionRef !== CANONICAL_MALEK_PRODUCTION_REF) {
  fail(`PRODUCTION_SUPABASE_PROJECT_REF must identify the canonical MALEK live project (${CANONICAL_MALEK_PRODUCTION_REF}).`);
}
if (env.demoRef === CANONICAL_MALEK_PRODUCTION_REF || env.demoRef === env.productionRef) {
  fail('the Demo Supabase project must be physically separate from MALEK live Production.');
}

let target;
try {
  target = new URL(env.url);
} catch {
  fail('VITE_SUPABASE_URL must be a valid URL.');
}
if (target.protocol !== 'https:') fail('VITE_SUPABASE_URL must use HTTPS.');

const expectedDemoHost = `${env.demoRef}.supabase.co`;
const productionHost = `${CANONICAL_MALEK_PRODUCTION_REF}.supabase.co`;
if (target.hostname === productionHost || target.hostname.startsWith(`${CANONICAL_MALEK_PRODUCTION_REF}.`)) {
  fail('refusing to deploy the presentation surface against MALEK live Production.');
}
if (target.hostname !== expectedDemoHost) {
  fail(`VITE_SUPABASE_URL must exactly target the declared Demo project (${expectedDemoHost}).`);
}

console.log(JSON.stringify({
  gate: 'production-demo-preflight',
  status: 'approved',
  profile: env.profile,
  targetProjectRef: env.demoRef,
  liveProjectSeparated: true,
}));
