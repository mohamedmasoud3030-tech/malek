import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  validateVaultFile,
  VAULT_ALLOWED_MIME_TYPES,
  VAULT_MAX_FILE_SIZE,
} from './documents-vault-service';

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

  it('matches the live bucket size and MIME contract', () => {
    expect(VAULT_MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
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

  it('migration hardens the bucket and removes the legacy broad uploader policy', () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, '../../../../supabase/migrations/20260719134000_harden_private_attachments_bucket.sql'),
      'utf8',
    );

    expect(migration).toContain("'attachments'");
    expect(migration).toContain('public = excluded.public');
    expect(migration).toContain('file_size_limit = excluded.file_size_limit');
    expect(migration).toContain('allowed_mime_types = excluded.allowed_mime_types');
    expect(migration).toContain('drop policy if exists "authenticated upload attachments"');
    expect(migration).toContain('attachments_authenticated_insert');
    expect(migration).toContain('public.is_admin_or_manager()');
    expect(migration).toContain('public.is_app_user()');
  });

  it('page uses signed URLs for private previews', () => {
    const page = readFileSync(resolve(import.meta.dirname, './documents-vault-page.tsx'), 'utf8');
    expect(page).toContain('getVaultDocumentSignedUrl');
    expect(page).toContain('signedMap');
    expect(page).not.toContain('getPublicUrl');
  });
});
