import { beforeEach, describe, expect, it, vi } from 'vitest';

function createQueryMock(result: unknown) {
  const chain = {
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    returns: vi.fn(() => Promise.resolve(result)),
    select: vi.fn(() => chain),
    single: vi.fn(() => ({ ...chain, returns: vi.fn(() => Promise.resolve(result)) })),
    update: vi.fn(() => chain),
  };
  return chain;
}

const storageMock = vi.hoisted(() => ({
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  storage: { from: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: supabaseMock,
}));

function makeFile(name: string, type: string, sizeBytes: number) {
  const file = new File([new Uint8Array(sizeBytes)], name, { type });
  return file;
}

describe('contractDocumentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.storage.from.mockReturnValue(storageMock);
    storageMock.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/attachments/signed-token' },
      error: null,
    });
  });

  it('throws list failures instead of returning an empty success state', async () => {
    const chain = createQueryMock({ data: null, error: new Error('contract_documents table unavailable') });
    supabaseMock.from.mockReturnValue(chain);
    const { listContractDocuments } = await import('./contractDocumentsService');

    await expect(listContractDocuments('contract-1')).rejects.toThrow('contract_documents table unavailable');
    expect(supabaseMock.from).toHaveBeenCalledWith('contract_documents');
  });

  it('rejects unsupported file types before touching storage', async () => {
    const { uploadContractDocument } = await import('./contractDocumentsService');
    const file = makeFile('malware.exe', 'application/x-msdownload', 100);

    await expect(uploadContractDocument('contract-1', file)).rejects.toThrow('نوع الملف غير مدعوم');
    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it('rejects files larger than 5MB before touching storage', async () => {
    const { uploadContractDocument } = await import('./contractDocumentsService');
    const file = makeFile('big.pdf', 'application/pdf', 5 * 1024 * 1024 + 1);

    await expect(uploadContractDocument('contract-1', file)).rejects.toThrow('5 ميغابايت');
    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it('uploads to storage then persists the storage path (private bucket — never a public URL)', async () => {
    storageMock.upload.mockResolvedValue({ error: null });
    const chain = createQueryMock({ data: { id: 'doc-1', contract_id: 'contract-1', file_name: 'lease.pdf' }, error: null });
    supabaseMock.from.mockReturnValue(chain);
    const { uploadContractDocument } = await import('./contractDocumentsService');
    const file = makeFile('lease.pdf', 'application/pdf', 1024);

    const result = await uploadContractDocument('contract-1', file);

    expect(storageMock.upload).toHaveBeenCalledWith(expect.stringContaining('contracts/contract-1/'), file, { upsert: false });
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        contract_id: 'contract-1',
        file_name: 'lease.pdf',
        file_url: expect.stringContaining('contracts/contract-1/'),
        storage_path: expect.stringContaining('contracts/contract-1/'),
      }),
    );
    const inserted = (chain.insert.mock.calls as unknown[][])[0]?.[0] as { file_url?: string };
    expect(inserted.file_url ?? '').not.toMatch(/^https?:\/\//);
    expect(result).toEqual({ id: 'doc-1', contract_id: 'contract-1', file_name: 'lease.pdf' });
  });

  it('signs storage-path documents and passes legacy absolute URLs through', async () => {
    const { getContractDocumentSignedUrl } = await import('./contractDocumentsService');

    await expect(
      getContractDocumentSignedUrl({ file_url: 'contracts/contract-1/x.pdf', storage_path: 'contracts/contract-1/x.pdf' }),
    ).resolves.toBe('https://example.com/attachments/signed-token');
    expect(storageMock.createSignedUrl).toHaveBeenCalledWith('contracts/contract-1/x.pdf', 3600);

    await expect(
      getContractDocumentSignedUrl({ file_url: 'https://legacy.example/doc.pdf', storage_path: 'contracts/contract-1/y.pdf' }),
    ).resolves.toBe('https://legacy.example/doc.pdf');
    expect(storageMock.createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('rolls back the uploaded storage object if the DB insert fails', async () => {
    storageMock.upload.mockResolvedValue({ error: null });
    const chain = createQueryMock({ data: null, error: new Error('insert rejected') });
    supabaseMock.from.mockReturnValue(chain);
    const { uploadContractDocument } = await import('./contractDocumentsService');
    const file = makeFile('lease.pdf', 'application/pdf', 1024);

    await expect(uploadContractDocument('contract-1', file)).rejects.toThrow('insert rejected');
    expect(storageMock.remove).toHaveBeenCalledWith([expect.stringContaining('contracts/contract-1/')]);
  });

  it('throws if storage upload fails, without attempting the DB insert', async () => {
    storageMock.upload.mockResolvedValue({ error: { message: 'storage quota exceeded' } });
    const { uploadContractDocument } = await import('./contractDocumentsService');
    const file = makeFile('lease.pdf', 'application/pdf', 1024);

    await expect(uploadContractDocument('contract-1', file)).rejects.toThrow('storage quota exceeded');
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('soft-deletes a document by setting deleted_at', async () => {
    const chain = createQueryMock({ data: { id: 'doc-1', deleted_at: '2026-07-03T00:00:00.000Z' }, error: null });
    supabaseMock.from.mockReturnValue(chain);
    const { deleteContractDocument } = await import('./contractDocumentsService');

    await deleteContractDocument('doc-1');
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(String) }));
    expect(chain.eq).toHaveBeenCalledWith('id', 'doc-1');
  });
});
