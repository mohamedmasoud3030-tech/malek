import { createClient } from '@supabase/supabase-js';

for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'E2E_TEST_EMAIL', 'E2E_TEST_PASSWORD', 'E2E_FOREIGN_COMPANY_ID']) {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required for hosted Storage tenant proof.`);
}

const supabase = createClient(process.env.VITE_SUPABASE_URL.trim(), process.env.VITE_SUPABASE_ANON_KEY.trim(), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const anonymous = createClient(process.env.VITE_SUPABASE_URL.trim(), process.env.VITE_SUPABASE_ANON_KEY.trim(), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function decodeJwtPayload(token) {
  const [, payload] = token.split('.');
  if (!payload) throw new Error('Malformed access token.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
  email: process.env.E2E_TEST_EMAIL.trim(),
  password: process.env.E2E_TEST_PASSWORD,
});
if (signInError || !signInData.session) throw signInError ?? new Error('Could not obtain staging session.');

const claims = decodeJwtPayload(signInData.session.access_token);
const companyId = claims?.app_metadata?.company_id;
if (typeof companyId !== 'string' || !companyId) throw new Error('Staging JWT has no app_metadata.company_id claim.');

const foreignCompanyId = process.env.E2E_FOREIGN_COMPANY_ID.trim();
if (foreignCompanyId === companyId) throw new Error('Foreign company id must differ from active company id.');

const bytes = Buffer.from('MALEK hosted tenant storage proof', 'utf8');
const ownPath = `vault/${companyId}/e2e-storage-proof/${crypto.randomUUID()}.txt`;
const foreignPath = `vault/${foreignCompanyId}/e2e-storage-proof/${crypto.randomUUID()}.txt`;
let uploaded = false;

try {
  const ownUpload = await supabase.storage.from('attachments').upload(ownPath, bytes, {
    contentType: 'text/plain',
    upsert: false,
  });
  if (!ownUpload.error) {
    throw new Error('Bucket unexpectedly accepted text/plain; MIME contract should reject it.');
  }

  const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=', 'base64');
  const ownPngPath = ownPath.replace(/\.txt$/, '.png');
  const foreignPngPath = foreignPath.replace(/\.txt$/, '.png');

  const upload = await supabase.storage.from('attachments').upload(ownPngPath, pngBytes, {
    contentType: 'image/png',
    upsert: false,
  });
  if (upload.error) throw upload.error;
  uploaded = true;

  const signed = await supabase.storage.from('attachments').createSignedUrl(ownPngPath, 60);
  if (signed.error || !signed.data?.signedUrl) throw signed.error ?? new Error('Own-company signed URL failed.');
  const response = await fetch(signed.data.signedUrl);
  if (!response.ok) throw new Error(`Own-company signed download failed: ${response.status}`);
  const downloaded = Buffer.from(await response.arrayBuffer());
  if (!downloaded.equals(pngBytes)) throw new Error('Downloaded bytes differ from uploaded bytes.');

  const anonymousSigned = await anonymous.storage.from('attachments').createSignedUrl(ownPngPath, 60);
  if (!anonymousSigned.error || anonymousSigned.data?.signedUrl) throw new Error('Anonymous signed URL unexpectedly succeeded.');

  const foreignUpload = await supabase.storage.from('attachments').upload(foreignPngPath, pngBytes, {
    contentType: 'image/png',
    upsert: false,
  });
  if (!foreignUpload.error) {
    await supabase.storage.from('attachments').remove([foreignPngPath]);
    throw new Error('Cross-company Storage upload unexpectedly succeeded.');
  }

  const foreignSigned = await supabase.storage.from('attachments').createSignedUrl(foreignPngPath, 60);
  if (!foreignSigned.error || foreignSigned.data?.signedUrl) throw new Error('Cross-company signed URL unexpectedly succeeded.');

  console.log(JSON.stringify({
    storageTenantProof: 'passed',
    activeCompanyId: companyId,
    foreignCompanyId,
    ownUpload: true,
    ownSignedDownload: true,
    anonymousDenied: true,
    foreignUploadDenied: true,
    foreignSignedUrlDenied: true,
    mimeContractDeniedText: true,
  }));
} finally {
  if (uploaded) {
    const ownPngPath = ownPath.replace(/\.txt$/, '.png');
    const cleanup = await supabase.storage.from('attachments').remove([ownPngPath]);
    if (cleanup.error) throw cleanup.error;
  }
  await supabase.auth.signOut();
}
