import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('utilities schema contract', () => {
  it('uses the canonical text property id for meters and bills', () => {
    const createMetersSql = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../../supabase/migrations/20260717000001_real_utility_meters_and_enhance_bills.sql',
      ),
      'utf8',
    ).toLowerCase();
    const alignBillsSql = readFileSync(
      resolve(
        import.meta.dirname,
        '../../../../supabase/migrations/20260717000011_align_utility_property_id_type.sql',
      ),
      'utf8',
    ).toLowerCase();

    expect(createMetersSql).toContain(
      'property_id text not null references public.properties(id)',
    );
    expect(createMetersSql).not.toContain(
      'property_id uuid not null references public.properties(id)',
    );

    expect(alignBillsSql).toContain('alter column property_id type text');
    expect(alignBillsSql).toContain('using property_id::text');
    expect(alignBillsSql).toContain('references public.properties(id)');
  });
});
