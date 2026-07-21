import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => {
  const upload = vi.fn();
  const createSignedUrl = vi.fn();
  const from = vi.fn(() => ({ upload, createSignedUrl }));
  return { upload, createSignedUrl, from };
});

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: storage.from } },
}));

import { createSignedAttachmentUrl, uploadAttachment } from './attachment-storage-service';

describe('uploadAttachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores an attachment in the private bucket and returns its storage path — never a public URL', async () => {
    storage.upload.mockResolvedValue({ error: null });

    const path = await uploadAttachment(new File(['content'], 'agreement.pdf', { type: 'application/pdf' }));

    expect(path).toMatch(/\.pdf$/);
    expect(path).not.toMatch(/^https?:\/\//);
    expect(storage.from).toHaveBeenCalledWith('attachments');
    expect(storage.upload).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/), expect.any(File), { upsert: false });
  });

  it('normalizes storage failures as errors', async () => {
    storage.upload.mockResolvedValue({ error: { message: 'bucket unavailable' } });

    await expect(uploadAttachment(new File(['content'], 'agreement.pdf')))
      .rejects.toThrow('bucket unavailable');
  });
});

describe('createSignedAttachmentUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes legacy absolute URLs through untouched', async () => {
    await expect(createSignedAttachmentUrl('https://files.example/attachment.pdf'))
      .resolves.toBe('https://files.example/attachment.pdf');
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it('signs a storage path for the private bucket', async () => {
    storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://supabase.example/signed/token' }, error: null });

    await expect(createSignedAttachmentUrl('1700000000000-abc.pdf'))
      .resolves.toBe('https://supabase.example/signed/token');
    expect(storage.createSignedUrl).toHaveBeenCalledWith('1700000000000-abc.pdf', 3600);
  });

  it('throws when signing fails instead of returning a broken link', async () => {
    storage.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'object not found' } });

    await expect(createSignedAttachmentUrl('1700000000000-abc.pdf')).rejects.toThrow('object not found');
  });
});
