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

describe('documents vault real implementation', () => {
  it('service and page do not contain hardcoded document mocks', () => {
    const service = readFileSync(resolve(import.meta.dirname, './documents-vault-service.ts'), 'utf8');
    const page = readFileSync(resolve(import.meta.dirname, './documents-vault-page.tsx'), 'utf8');

    for (const marker of ['placehold.co', 'doc-1', 'عقد إيجار موثق - شقة 102', 'ID+Card+Scan']) {
      expect(service).not.toContain(marker);
    }
    for (const marker of ['placehold.co', 'doc-1', 'Contract+PDF']) {
      expect(page).not.toContain(marker);
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

  it('migration pins the bucket contract and the canonical policy set exists', () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, '../../../../supabase/migrations/20260721090000_harden_private_attachments_bucket.sql'),
      'utf8',
    );

    // The migration must state the same numbers as the client contract.
    expect(migration).toContain(String(ATTACHMENTS_MAX_FILE_SIZE));
    for (const mimeType of [...ATTACHMENTS_ALLOWED_MIME_TYPES]) {
      expect(migration).toContain(mimeType);
    }
    expect(migration).toContain("  'attachments',\n  'attachments',\n  false,");
    expect(migration).toContain('public = excluded.public');
    expect(migration).toContain('file_size_limit = excluded.file_size_limit');
    expect(migration).toContain('allowed_mime_types = excluded.allowed_mime_types');
    expect(migration).toContain('drop policy if exists "authenticated upload attachments"');

    // The canonical policy set is owned by the vault foundation migration.
    const foundation = readFileSync(
      resolve(import.meta.dirname, '../../../../supabase/migrations/20260717000002_real_documents_vault.sql'),
      'utf8',
    );
    expect(foundation).toContain('attachments_authenticated_read');
    expect(foundation).toContain('attachments_authenticated_insert');
    expect(foundation).toContain('attachments_manager_write');
    expect(foundation).toContain('attachments_manager_delete');
    expect(foundation).toContain('public.is_admin_or_manager()');
    expect(foundation).toContain('public.is_app_user()');
  });

  it('pgTAP drift checks pin the bucket contract and policy invariants', () => {
    const driftChecks = readFileSync(
      resolve(import.meta.dirname, '../../../../supabase/tests/security_drift_checks.sql'),
      'utf8',
    );
    expect(driftChecks).toContain('5242880');
    for (const mimeType of [...ATTACHMENTS_ALLOWED_MIME_TYPES]) {
      expect(driftChecks).toContain(mimeType);
    }
    expect(driftChecks).toContain('is_admin_or_manager()');
  });

  it('page uses signed URLs for private previews', () => {
    const page = readFileSync(resolve(import.meta.dirname, './documents-vault-page.tsx'), 'utf8');
    expect(page).toContain('getVaultDocumentSignedUrl');
    expect(page).toContain('signedMap');
    expect(page).not.toContain('getPublicUrl');
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
