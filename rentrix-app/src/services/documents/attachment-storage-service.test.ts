import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => {
  const upload = vi.fn();
  const getPublicUrl = vi.fn();
  const from = vi.fn(() => ({ upload, getPublicUrl }));
  return { upload, getPublicUrl, from };
});

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: storage.from } },
}));

import { uploadAttachment } from './attachment-storage-service';

describe('uploadAttachment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores an attachment and returns its public URL', async () => {
    storage.upload.mockResolvedValue({ error: null });
    storage.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://files.example/attachment.pdf' } });

    await expect(uploadAttachment(new File(['content'], 'agreement.pdf', { type: 'application/pdf' })))
      .resolves.toBe('https://files.example/attachment.pdf');

    expect(storage.from).toHaveBeenCalledWith('attachments');
    expect(storage.upload).toHaveBeenCalledWith(expect.stringMatching(/\.pdf$/), expect.any(File), { upsert: false });
  });

  it('normalizes storage failures as errors', async () => {
    storage.upload.mockResolvedValue({ error: { message: 'bucket unavailable' } });

    await expect(uploadAttachment(new File(['content'], 'agreement.pdf')))
      .rejects.toThrow('bucket unavailable');
  });
});
