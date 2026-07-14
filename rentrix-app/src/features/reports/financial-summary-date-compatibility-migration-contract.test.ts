import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260714000006_fix_rpt_financial_summary_status.sql',
  ),
  'utf8',
).toLowerCase();

describe('financial summary migration date compatibility', () => {
  it('normalizes due_date through text before date comparison', () => {
    expect(migration).toContain("nullif(invoice.due_date::text, '')::date < current_date");
    expect(migration).not.toContain("nullif(due_date, '')::date");
  });

  it('excludes void and cancelled invoices from report totals', () => {
    expect(migration).toContain("not in ('void', 'cancelled')");
    expect(migration).toContain("coalesce(upper(payment.status), 'posted') <> 'void'");
  });

  it('keeps the security-definer report pinned and non-public', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = public, pg_temp');
    expect(migration).toContain(
      'revoke all on function public.rpt_financial_summary(date, date) from public, anon',
    );
    expect(migration).toContain(
      'grant execute on function public.rpt_financial_summary(date, date) to authenticated, service_role',
    );
  });
});
