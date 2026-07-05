import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(import.meta.dirname, '../../../../../supabase/migrations/20260705000004_fix_sessions_rls_user_id.sql');

describe('sessions RLS migration contract', () => {
  it('uses sessions.user_id, not the session row id, for own-session policies', async () => {
    const sql = await readFile(migrationPath, 'utf8');

    expect(sql).toContain('drop policy if exists sessions_select_own on public.sessions;');
    expect(sql).toContain('drop policy if exists sessions_insert_own on public.sessions;');
    expect(sql).toContain('drop policy if exists sessions_delete_own on public.sessions;');
    expect(sql).toContain('((select auth.uid()) = user_id) or app_private.is_admin_or_manager()');
    expect(sql).toContain('((select auth.uid()) = user_id) and app_private.is_app_user()');
    expect(sql).not.toMatch(/auth\.uid\(\)\)\s*=\s*id\b/);
  });
});
