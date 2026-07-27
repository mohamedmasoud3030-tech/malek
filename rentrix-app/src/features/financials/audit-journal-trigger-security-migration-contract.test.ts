import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260730091000_reconcile_audit_journal_trigger_security.sql',
  ),
  'utf8',
).toLowerCase();

const rollbackSql = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'rollback',
    '20260730_rollback_audit_journal_trigger_security.sql',
  ),
  'utf8',
).toLowerCase();

describe('audit journal trigger security reconciliation migration', () => {
  it('converges live and clean-replay definitions on the invoker trigger with a pinned search path', () => {
    expect(migrationSql).toContain('create or replace function public.audit_journal_entry_insert()');
    expect(migrationSql).toContain('security invoker');
    expect(migrationSql).toContain('set search_path = public, pg_temp');
    expect(migrationSql).toContain('gen_random_uuid()::text');
    expect(migrationSql).toContain('insert into public.audit_log');
  });

  it('preserves the service-role-only execution ACL', () => {
    expect(migrationSql).toContain(
      'revoke all on function public.audit_journal_entry_insert() from public, anon, authenticated',
    );
    expect(migrationSql).toContain(
      'grant execute on function public.audit_journal_entry_insert() to service_role',
    );
  });

  it('restores the exact pre-change security posture in the emergency rollback', () => {
    expect(rollbackSql).toContain('security invoker');
    expect(rollbackSql).not.toContain('set search_path = public, pg_temp');
    expect(rollbackSql).toContain('gen_random_uuid()::text');
    expect(rollbackSql).toContain(
      'revoke all on function public.audit_journal_entry_insert() from public, anon, authenticated',
    );
    expect(rollbackSql).toContain(
      'grant execute on function public.audit_journal_entry_insert() to service_role',
    );
  });
});
