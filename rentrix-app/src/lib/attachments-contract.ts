/**
 * Storage attachment contract — single client-side source of truth for the
 * private `attachments` bucket policy. These values must mirror:
 *
 *   - supabase/migrations/20260721090000_harden_private_attachments_bucket.sql
 *   - supabase/tests/security_drift_checks.sql (pgTAP check #6)
 *
 * Any drift between these constants and the migration/pgTAP contract is a
 * release blocker, not a cosmetic bug: the bucket rejects what the client
 * allows (confusing UX) or the client allows what the bucket rejects.
 */

export const ATTACHMENTS_BUCKET_ID = 'attachments' as const;

/** 5MB — matches storage.buckets.file_size_limit = 5242880. */
export const ATTACHMENTS_MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Exact set — matches storage.buckets.allowed_mime_types. */
export const ATTACHMENTS_ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** HTML accept attribute for the same contract. */
export const ATTACHMENTS_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp' as const;
