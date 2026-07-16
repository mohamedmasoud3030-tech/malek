import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('documents vault real implementation', () => {
  it('service does not contain placehold.co mock data', () => {
    const servicePath = resolve(import.meta.dirname, './documents-vault-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).not.toContain('placehold.co');
    expect(content).not.toContain('doc-1');
    expect(content).not.toContain('عقد إيجار موثق - شقة 102');
    expect(content).not.toContain('برج النيل / شقة 102');
    expect(content).not.toContain('ID+Card+Scan');
  });

  it('page does not contain hardcoded mock documents', () => {
    const pagePath = resolve(import.meta.dirname, './documents-vault-page.tsx');
    const content = readFileSync(pagePath, 'utf8');
    expect(content).not.toContain('placehold.co');
    expect(content).not.toContain('doc-1');
    expect(content).not.toContain('Contract+PDF');
  });

  it('service implements real private bucket with signed URLs and no getPublicUrl', () => {
    const servicePath = resolve(import.meta.dirname, './documents-vault-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).toContain('supabase.storage.from');
    expect(content).toContain('upload');
    expect(content).toContain('createSignedUrl');
    expect(content).toContain('getVaultDocumentSignedUrl');
    expect(content).not.toContain('getPublicUrl');
    expect(content).toContain('vault_documents');
    expect(content).toContain('rollback');
    expect(content).toContain('remove');
    expect(content).toContain('file_size');
    expect(content).toContain('mime_type');
    expect(content).toContain('private');
  });

  it('service validates file size and type', () => {
    const servicePath = resolve(import.meta.dirname, './documents-vault-service.ts');
    const content = readFileSync(servicePath, 'utf8');
    expect(content).toContain('MAX_FILE_SIZE');
    expect(content).toContain('ALLOWED_MIME');
    expect(content).toContain('10 * 1024 * 1024');
  });

  it('migration creates vault_documents with hardened RLS and private bucket', () => {
    const migrationPath = resolve(import.meta.dirname, '../../../../supabase/migrations/20260717000002_real_documents_vault.sql');
    const content = readFileSync(migrationPath, 'utf8');
    expect(content).toContain('create table if not exists public.vault_documents');
    expect(content).toContain('manager_write_vault_documents');
    expect(content).toContain('app_read_vault_documents');
    expect(content).toContain('is_admin_or_manager()');
    expect(content).toContain('storage.buckets');
    expect(content).toContain('attachments');
    expect(content).toContain('attachments_authenticated_insert');
    expect(content).toContain('public = false');
  });

  it('page uses signed URLs for images', () => {
    const pagePath = resolve(import.meta.dirname, './documents-vault-page.tsx');
    const content = readFileSync(pagePath, 'utf8');
    expect(content).toContain('getVaultDocumentSignedUrl');
    expect(content).toContain('signedMap');
    expect(content).not.toContain('placehold.co');
    // Should mention private bucket
    expect(content).toContain('private');
    expect(content).toContain('signed');
  });
});
