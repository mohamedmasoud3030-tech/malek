import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateVaultFile,
  VAULT_ALLOWED_MIME_TYPES,
  VAULT_MAX_FILE_SIZE,
} from './documents-vault-service';
import {
  ATTACHMENTS_ALLOWED_MIME_TYPES,
  ATTACHMENTS_MAX_FILE_SIZE,
} from '@/lib/attachments-contract';

const readVaultWorkspace = () => readFileSync(
  resolve(import.meta.dirname, './components/documents-vault-workspace.tsx'),
  'utf8',
);

describe('documents vault real implementation', () => {
  it('service and workspace do not contain hardcoded document mocks', () => {
    const service = readFileSync(resolve(import.meta.dirname, './documents-vault-service.ts'), 'utf8');
    const workspace = readVaultWorkspace();

    for (const marker of ['placehold.co', 'doc-1', 'عقد إيجار موثق - شقة 102', 'ID+Card+Scan']) {
      expect(service).not.toContain(marker);
    }
    for (const marker of ['placehold.co', 'doc-1', 'Contract+PDF']) {
      expect(workspace).not.toContain(marker);
    }
  });

  it('uses a private bucket, signed URLs, and compensating cleanup', () => {
    const service = readFileSync(resolve(import.meta.dirname, './documents-vault-service.ts'), 'utf8');
    expect(service).toContain('supabase.storage.from');
    expect(service).toContain('.upload(');
    expect(service).toContain('createSignedUrl');
    expect(service).toContain('getVaultDocumentSignedUrl');
    expect(service).not.toContain('getPublicUrl');
    expect(service).toContain('vault_documents');
    expect(service).toContain('.remove([fullPath])');
    expect(service).toContain('file_size');
    expect(service).toContain('mime_type');
  });

  it('matches the shared attachments bucket contract exactly', () => {
    expect(VAULT_MAX_FILE_SIZE).toBe(ATTACHMENTS_MAX_FILE_SIZE);
    expect(VAULT_MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
    expect([...VAULT_ALLOWED_MIME_TYPES]).toEqual([...ATTACHMENTS_ALLOWED_MIME_TYPES]);
    expect([...VAULT_ALLOWED_MIME_TYPES]).toEqual([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);

    expect(() => validateVaultFile({ size: 1, type: 'application/pdf' })).not.toThrow();
    expect(() => validateVaultFile({ size: VAULT_MAX_FILE_SIZE, type: 'image/png' })).not.toThrow();
    expect(() => validateVaultFile({ size: 0, type: 'image/png' })).toThrow('الملف فارغ');
    expect(() => validateVaultFile({ size: VAULT_MAX_FILE_SIZE + 1, type: 'image/png' })).toThrow('5MB');
    expect(() => validateVaultFile({ size: 1, type: 'application/msword' })).toThrow('غير مدعوم');
    expect(() => validateVaultFile({ size: 1, type: '' })).toThrow('غير مدعوم');
  });

  it('shared workspace uses signed URLs for private previews', () => {
    const workspace = readVaultWorkspace();
    expect(workspace).toContain('getVaultDocumentSignedUrl');
    expect(workspace).toContain('signedMap');
    expect(workspace).not.toContain('getPublicUrl');
  });

  it('contract documents service no longer builds public URLs for the private bucket', () => {
    const contractService = readFileSync(
      resolve(import.meta.dirname, '../contracts/contractDocumentsService.ts'),
      'utf8',
    );
    expect(contractService).not.toContain('getPublicUrl');
    expect(contractService).toContain('createSignedUrl');
    expect(contractService).toContain('file_url: storagePath');
    expect(contractService).toContain(String(5)); // 5MB message via shared constant
    expect(contractService).toContain('ATTACHMENTS_MAX_FILE_SIZE');
  });
});
