import { createClient } from '@supabase/supabase-js';

const environmentKind = process.env.E2E_ENVIRONMENT_KIND?.trim().toLowerCase();
const baseRequired = [
  'E2E_ENVIRONMENT_KIND',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'PRODUCTION_SUPABASE_PROJECT_REF',
];

for (const name of baseRequired) {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required for isolated Storage smoke.`);
}

if (!['local', 'staging'].includes(environmentKind)) {
  throw new Error('Storage smoke is allowed only for local or staging environments.');
}

const isLocal = environmentKind === 'local';
if (isLocal && !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to bootstrap the local Storage smoke identity.');
}
if (!isLocal) {
  for (const name of ['E2E_TEST_EMAIL', 'E2E_TEST_PASSWORD']) {
    if (!process.env[name]?.trim()) throw new Error(`${name} is required for Staging Storage smoke.`);
  }
}

// Production refusal happens BEFORE any Supabase client call — no write of any
// kind may ever reach the production project from this script.
const supabaseUrl = new URL(process.env.VITE_SUPABASE_URL.trim());
const productionRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF.trim();
if (supabaseUrl.hostname === `${productionRef}.supabase.co` || supabaseUrl.hostname.startsWith(`${productionRef}.`)) {
  throw new Error('Refusing Storage smoke against the production Supabase project.');
}

const anonKey = process.env.VITE_SUPABASE_ANON_KEY.trim();
const authenticatedClient = createClient(supabaseUrl.toString(), anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const anonymousClient = createClient(supabaseUrl.toString(), anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const serviceClient = isLocal
  ? createClient(supabaseUrl.toString(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  : null;

function decodeJwtPayload(token) {
  const [, payload] = token.split('.');
  if (!payload) throw new Error('Authenticated session returned a malformed access token.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

function asError(value, fallback) {
  if (value instanceof Error) return value;
  return new Error(fallback, { cause: value });
}

function combineErrors(errors, message) {
  const present = errors.filter(Boolean);
  if (present.length === 0) return null;
  if (present.length === 1) return present[0];
  return new AggregateError(present, message);
}

async function createLocalIdentity() {
  if (!serviceClient) throw new Error('Local identity bootstrap requires the service client.');

  const suffix = crypto.randomUUID();
  const email = `storage-smoke-${suffix}@example.test`;
  const password = `Storage-${suffix}-Aa1!`;
  const createResult = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'ADMIN', user_role: 'ADMIN' },
  });
  if (createResult.error || !createResult.data.user) {
    throw createResult.error ?? new Error('Could not create the local Storage smoke user.');
  }

  const userId = createResult.data.user.id;
  const profileResult = await serviceClient.from('users').upsert({
    id: userId,
    email,
    name: 'Storage Smoke Admin',
    full_name: 'Storage Smoke Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    is_active: true,
    deleted_at: null,
  }, { onConflict: 'id' });

  if (profileResult.error) {
    await serviceClient.auth.admin.deleteUser(userId);
    throw profileResult.error;
  }

  return { email, password, userId };
}

async function deleteLocalIdentity(userId) {
  if (!serviceClient || !userId) return null;

  const errors = [];
  const profileDelete = await serviceClient.from('users').delete().eq('id', userId);
  if (profileDelete.error) errors.push(profileDelete.error);

  const authDelete = await serviceClient.auth.admin.deleteUser(userId);
  if (authDelete.error) errors.push(authDelete.error);

  return combineErrors(errors, 'Local Storage smoke identity cleanup failed.');
}

async function verifyUploadedObject(path, expectedBytes) {
  const signed = await authenticatedClient.storage.from('attachments').createSignedUrl(path, 60);
  if (signed.error || !signed.data?.signedUrl) {
    throw signed.error ?? new Error('Authenticated signed URL was not returned.');
  }

  const signedResponse = await fetch(signed.data.signedUrl, { redirect: 'follow' });
  if (!signedResponse.ok) {
    throw new Error(`Signed URL download failed with HTTP ${signedResponse.status}.`);
  }
  const downloaded = Buffer.from(await signedResponse.arrayBuffer());
  if (!downloaded.equals(expectedBytes)) {
    throw new Error('Signed URL returned bytes that differ from the uploaded object.');
  }

  const anonymousSigned = await anonymousClient.storage.from('attachments').createSignedUrl(path, 60);
  if (!anonymousSigned.error || anonymousSigned.data?.signedUrl) {
    throw new Error('Anonymous client unexpectedly created a signed URL for a private object.');
  }

  const publicUrl = anonymousClient.storage.from('attachments').getPublicUrl(path).data.publicUrl;
  const publicResponse = await fetch(publicUrl, { redirect: 'manual' });
  if (publicResponse.ok) {
    throw new Error('Private attachment object was reachable through a public URL.');
  }

  return {
    signedDownloadStatus: signedResponse.status,
    publicDownloadStatus: publicResponse.status,
  };
}

async function cleanupObject(path) {
  const cleanup = await authenticatedClient.storage.from('attachments').remove([path]);
  if (cleanup.error) return asError(cleanup.error, 'Storage smoke object cleanup failed.');

  const afterDelete = await authenticatedClient.storage.from('attachments').createSignedUrl(path, 60);
  if (!afterDelete.error && afterDelete.data?.signedUrl) {
    const response = await fetch(afterDelete.data.signedUrl, { redirect: 'manual' });
    if (response.ok) return new Error('Storage smoke cleanup did not remove the uploaded object.');
  }
  return null;
}

async function run() {
  let identity = null;
  let uploadedPath = null;
  let disallowedPath = null;
  let primaryError = null;
  let cleanupError = null;
  let evidence = null;

  try {
    identity = isLocal
      ? await createLocalIdentity()
      : {
          email: process.env.E2E_TEST_EMAIL.trim(),
          password: process.env.E2E_TEST_PASSWORD,
          userId: null,
        };

    const signIn = await authenticatedClient.auth.signInWithPassword({
      email: identity.email,
      password: identity.password,
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
      throw new Error(`Storage smoke requires an ADMIN or MANAGER identity; received ${role || 'no app role'}.`);
    }

    const pngBytes = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
      'base64',
    );
    uploadedPath = `vault/e2e-storage-smoke/${crypto.randomUUID()}.png`;
    const upload = await authenticatedClient.storage.from('attachments').upload(uploadedPath, pngBytes, {
      contentType: 'image/png',
      cacheControl: '60',
      upsert: false,
    });
    if (upload.error) throw upload.error;

    evidence = await verifyUploadedObject(uploadedPath, pngBytes);

    // The 5MB/4-MIME bucket contract must reject a disallowed MIME type even
    // for an ADMIN identity — bucket-level enforcement, not role-dependent.
    const executableBytes = Buffer.from('4d5a90000300000004000000ffff0000b8000000', 'hex');
    const disallowedUpload = await authenticatedClient.storage
      .from('attachments')
      .upload(`vault/e2e-storage-smoke/${crypto.randomUUID()}.exe`, executableBytes, {
        contentType: 'application/x-msdownload',
        upsert: false,
      });
    if (!disallowedUpload.error) {
      disallowedPath = disallowedUpload.data?.path ?? null;
      throw new Error('Bucket accepted a disallowed MIME type (application/x-msdownload).');
    }
  } catch (error) {
    primaryError = asError(error, 'Isolated Storage smoke failed.');
  } finally {
    // Cleanup always runs in finally — a failing smoke must never leave objects
    // or identities behind on the target environment.
    const cleanupErrors = [];
    if (uploadedPath) cleanupErrors.push(await cleanupObject(uploadedPath));
    if (disallowedPath) cleanupErrors.push(await cleanupObject(disallowedPath));

    try {
      const signOut = await authenticatedClient.auth.signOut();
      if (signOut.error) cleanupErrors.push(signOut.error);
    } catch (error) {
      cleanupErrors.push(error);
    }

    if (isLocal && identity?.userId) cleanupErrors.push(await deleteLocalIdentity(identity.userId));
    cleanupError = combineErrors(cleanupErrors, 'Isolated Storage smoke cleanup failed.');
  }

  if (primaryError && cleanupError) {
    throw new AggregateError([primaryError, cleanupError], 'Storage smoke and cleanup both failed.');
  }
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;

  console.log(JSON.stringify({
    storageSmoke: 'passed',
    environment: environmentKind,
    bucket: 'attachments',
    ...evidence,
    anonymousSignedUrlDenied: true,
    disallowedMimeDenied: true,
    cleanupVerified: true,
  }));
}

await run();
