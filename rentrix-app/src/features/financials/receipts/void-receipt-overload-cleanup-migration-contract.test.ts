import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const migrationPath = `${repoRoot}supabase/migrations/20260718170255_drop_legacy_void_receipt_overload.sql`;
const normalized = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ');

describe('legacy void receipt overload cleanup migration', () => {
  it('preserves the JSONB facade and drops only the unreachable positional overload', () => {
    expect(normalized).toContain("to_regprocedure('public.void_receipt_atomic(jsonb)')");
    expect(normalized).toContain('drop function if exists public.void_receipt_atomic(text, bigint, jsonb, jsonb)');
    expect(normalized).not.toContain('drop function public.void_receipt_atomic(jsonb)');
    expect(normalized).not.toContain('drop function if exists public.void_receipt_atomic(text, bigint, jsonb, jsonb) cascade');
  });

  it('fails post-flight if the legacy overload remains or the facade disappears', () => {
    expect(normalized).toContain("to_regprocedure('public.void_receipt_atomic(text,bigint,jsonb,jsonb)') is not null");
    expect(normalized).toContain('legacy void_receipt_atomic overload still exists');
    expect(normalized).toContain('required void_receipt_atomic(jsonb) facade was removed');
  });
});
