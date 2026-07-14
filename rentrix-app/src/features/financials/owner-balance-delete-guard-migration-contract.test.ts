import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260713000002_fix_owner_balances_cascade.sql',
  ),
  'utf8',
).toLowerCase();

describe('owner balance hard-delete guard migration', () => {
  it('supports only the repository-backed uuid and text identifier layouts', () => {
    expect(migration).toContain("v_owner_id_type not in ('uuid', 'text')");
    expect(migration).toContain("v_balance_owner_id_type not in ('uuid', 'text')");
    expect(migration).toContain('unsupported public.owners(id) type %');
    expect(migration).toContain('unsupported public.owner_balances(owner_id) type %');
  });

  it('checks orphan rows without mixed-type equality operators', () => {
    expect(migration).toContain(
      'on owner_record.id::text = owner_balance.owner_id::text',
    );
    expect(migration).toContain('where owner_record.id is null');
    expect(migration).toContain('manual cleanup required before applying');
  });

  it('replaces a cascade foreign key with an identifier-safe restrict trigger', () => {
    expect(migration).toContain('drop constraint if exists owner_balances_owner_id_fkey');
    expect(migration).toContain('create trigger trg_prevent_owner_delete_with_balances');
    expect(migration).toContain('before delete on public.owners');
    expect(migration).toContain(
      'where owner_balance.owner_id::text = old.id::text',
    );
    expect(migration).toContain("using errcode = '23503'");
  });

  it('keeps the security-definer trigger helper non-public', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = public, pg_temp');
    expect(migration).toContain(
      'revoke all on function public.prevent_owner_delete_with_balances() from public, anon, authenticated',
    );
    expect(migration).toContain(
      'grant execute on function public.prevent_owner_delete_with_balances() to service_role',
    );
  });
});
