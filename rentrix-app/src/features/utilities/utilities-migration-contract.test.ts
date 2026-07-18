import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('utilities schema contract', () => {
  it('adapts property and unit foreign keys to both live and clean schema identifier types', () => {
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
        '../../../../supabase/migrations/20260718074853_align_utility_property_id_type.sql',
      ),
      'utf8',
    ).toLowerCase();

    expect(createMetersSql).toContain("attribute.attrelid = 'public.properties'::regclass");
    expect(createMetersSql).toContain("attribute.attrelid = 'public.units'::regclass");
    expect(createMetersSql).toContain('property_id %s not null references public.properties(id)');
    expect(createMetersSql).toContain('unit_id %s references public.units(id)');
    expect(createMetersSql).not.toContain(
      'property_id uuid not null references public.properties(id)',
    );

    expect(alignBillsSql).toContain('if bill_type <> canonical_type then');
    expect(alignBillsSql).toContain('using property_id::text::%s');
    expect(alignBillsSql).toContain('references public.properties(id)');
  });
});
