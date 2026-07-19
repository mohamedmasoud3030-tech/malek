import { createClient } from '@supabase/supabase-js';

const required = [
  'E2E_ENVIRONMENT_KIND',
  'E2E_TEST_EMAIL',
  'E2E_TEST_PASSWORD',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'PRODUCTION_SUPABASE_PROJECT_REF',
];

for (const name of required) {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required for Storage staging smoke.`);
}

if (process.env.E2E_ENVIRONMENT_KIND.trim().toLowerCase() !== 'staging') {
  throw new Error('Storage smoke is allowed only when E2E_ENVIRONMENT_KIND=staging.');
}

const supabaseUrl = new URL(process.env.VITE_SUPABASE_URL.trim());
const productionRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF.trim();
if (supabaseUrl.hostname === `${productionRef}.supabase.co` || supabaseUrl.hostname.startsWith(`${productionRef}.`)) {
  throw new Error('Refusing Storage smoke against the production Supabase project.');
}

const anonKey = process.env.VITE_SUPABASE_ANON_KEY.trim();
const adminClient = createClient(supabaseUrl.toString(), anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const anonClient = createClient(supabaseUrl.toString(), anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function decodeJwtPayload(token) {
  const [, payload] = token.split('.');
  if (!payload) throw new Error('Authenticated session returned a malformed access token.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

const signIn = await adminClient.auth.signInWithPassword({
  email: process.env.E2E_TEST_EMAIL.trim(),
  password: process.env.E2E_TEST_PASSWORD,
});
if (signIn.error || !signIn.data.session) {
  throw signIn.error ?? new Error('Storage smoke could not obtain an authenticated session.');
}

const claims = decodeJwtPayload(signIn.data.session.access_token);
const role = String(
  claims?.app_metadata?.role
  ?? claims?.app_metadata?.user_role
  ?? claims?.user_role
  ?? '',
).toUpperCase();
if (!['ADMIN', 'MANAGER'].includes(role)) {
  throw new Error(`Storage smoke requires an ADMIN or MANAGER staging user; received ${role || 'no app role'}.`);
}

const pngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
  'base64',
);
const path = `vault/e2e-storage-smoke/${crypto.randomUUID()}.png`;
let uploaded = false;

try {
  const upload = await adminClient.storage.from('attachments').upload(path, pngBytes, {
    contentType: 'image/png',
    cacheControl: '60',
    upsert: false,
  });
  if (upload.error) throw upload.error;
  uploaded = true;

  const signed = await adminClient.storage.from('attachments').createSignedUrl(path, 60);
  if (signed.error || !signed.data?.signedUrl) {
    throw signed.error ?? new Error('Authenticated signed URL was not returned.');
  }

  const signedResponse = await fetch(signed.data.signedUrl, { redirect: 'follow' });
  if (!signedResponse.ok) {
    throw new Error(`Signed URL download failed with HTTP ${signedResponse.status}.`);
  }
  const downloaded = Buffer.from(await signedResponse.arrayBuffer());
  if (!downloaded.equals(pngBytes)) {
    throw new Error('Signed URL returned bytes that differ from the uploaded object.');
  }

  const anonymousSigned = await anonClient.storage.from('attachments').createSignedUrl(path, 60);
  if (!anonymousSigned.error || anonymousSigned.data?.signedUrl) {
    throw new Error('Anonymous client unexpectedly created a signed URL for a private object.');
  }

  const publicUrl = anonClient.storage.from('attachments').getPublicUrl(path).data.publicUrl;
  const publicResponse = await fetch(publicUrl, { redirect: 'manual' });
  if (publicResponse.ok) {
    throw new Error('Private attachment object was reachable through a public URL.');
  }

  console.log(JSON.stringify({
    storageSmoke: 'passed',
    bucket: 'attachments',
    signedDownloadStatus: signedResponse.status,
    publicDownloadStatus: publicResponse.status,
    anonymousSignedUrlDenied: true,
  }));
} finally {
  if (uploaded) {
    const cleanup = await adminClient.storage.from('attachments').remove([path]);
    if (cleanup.error) throw cleanup.error;

    const afterDelete = await adminClient.storage.from('attachments').createSignedUrl(path, 60);
    if (!afterDelete.error && afterDelete.data?.signedUrl) {
      const response = await fetch(afterDelete.data.signedUrl, { redirect: 'manual' });
      if (response.ok) throw new Error('Storage smoke cleanup did not remove the uploaded object.');
    }
  }
  await adminClient.auth.signOut();
}
