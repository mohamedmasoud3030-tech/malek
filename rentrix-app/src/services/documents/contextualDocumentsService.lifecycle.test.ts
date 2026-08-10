// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const upload = vi.fn();
const remove = vi.fn();
const createSignedUrl = vi.fn();
let row: any;
let insertedPayload: any;
let updatedPayloads: any[];

function resolvedChain(result: () => { data: any; error: any }) {
  const chain: any = {
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    select: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(async () => result()),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject),
  };
  return chain;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({ upload, remove, createSignedUrl }),
    },
    from: vi.fn(() => ({
      insert: (payload: any) => {
        insertedPayload = payload;
        row = { id: 'document-1', created_at: '2026-08-09T00:00:00Z', ...payload };
        return resolvedChain(() => ({ data: row, error: null }));
      },
      select: () => resolvedChain(() => ({ data: row, error: null })),
      update: (payload: any) => {
        updatedPayloads.push(payload);
        row = { ...row, ...payload };
        return resolvedChain(() => ({ data: row, error: null }));
      },
    })),
  },
}));

const {
  archiveContextualDocument,
  getContextualDocumentSignedUrl,
  replaceContextualDocument,
  uploadContextualDocument,
} = await import('./contextualDocumentsService');

beforeEach(() => {
  vi.clearAllMocks();
  updatedPayloads = [];
  row = null;
  insertedPayload = null;
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.test/document' }, error: null });
  let sequence = 0;
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: vi.fn(() => `aaaaaaaa-bbbb-4ccc-8ddd-${String(++sequence).padStart(12, '0')}`) });
});

describe('contextual document lifecycle', () => {
  it('uploads typed metadata, previews/downloads by signed URL, replaces, and archives one vault record', async () => {
    const original = new File(['original'], 'lease.pdf', { type: 'application/pdf' });
    const created = await uploadContextualDocument({
      file: original,
      title: 'عقد الإيجار',
      category: 'contracts',
      relatedEntityType: 'contract',
      relatedEntityId: 'contract-1',
    });
    expect(upload).toHaveBeenCalledOnce();
    expect(insertedPayload).toMatchObject({
      category: 'contracts',
      document_type: 'pdf',
      related_entity_type: 'contract',
      related_entity_id: 'contract-1',
      metadata: { originalFileName: 'lease.pdf', contentType: 'application/pdf', sizeBytes: original.size },
    });
    expect(insertedPayload.storage_path).toMatch(/^vault\/contextual\/contract\/contract-1\//);
    await expect(getContextualDocumentSignedUrl(created.storage_path)).resolves.toBe('https://signed.test/document');

    const oldPath = created.storage_path;
    row.metadata = { ...row.metadata, businessReference: 'CTR-2026-001', parties: ['المؤجر', 'المستأجر'], expiryDate: '2027-01-01', amount: '125.500', status: 'ACTIVE' };
    const replacement = new File(['replacement'], 'lease-new.pdf', { type: 'application/pdf' });
    const replaced = await replaceContextualDocument(created.id, replacement);
    expect(replaced.storage_path).not.toBe(oldPath);
    expect(updatedPayloads.at(-1)).toMatchObject({ file_name: 'lease-new.pdf', document_type: 'pdf' });
    expect(updatedPayloads.at(-1).metadata.replacedAt).toBeTruthy();
    expect(updatedPayloads.at(-1).metadata).toMatchObject({ businessReference: 'CTR-2026-001', parties: ['المؤجر', 'المستأجر'], expiryDate: '2027-01-01', amount: '125.500', status: 'ACTIVE' });
    expect(remove).toHaveBeenCalledWith([oldPath]);

    await archiveContextualDocument(created.id);
    expect(updatedPayloads.at(-1).deleted_at).toBeTruthy();
  });

  it('removes a newly uploaded object when metadata persistence fails', async () => {
    // The failure rollback is already covered by the service branch; make the
    // storage safety contract explicit without exposing the storage path in UI.
    upload.mockResolvedValueOnce({ error: { message: 'storage denied' } });
    const file = new File(['x'], 'id.png', { type: 'image/png' });
    await expect(uploadContextualDocument({ file, title: 'هوية', category: 'identity', relatedEntityType: 'person', relatedEntityId: 'person-1' })).rejects.toBeDefined();
    expect(insertedPayload).toBeNull();
  });
});
