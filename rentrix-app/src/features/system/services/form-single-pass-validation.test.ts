import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unitSchema } from '@/features/units/unit-schema';

const resolverBackedSubmissionFiles = [
  '../../units/unit-form-modal.tsx',
  '../../people/person-form-modal.tsx',
  '../../people/person-form-page.tsx',
  '../../properties/property-form-modal.tsx',
  '../../properties/property-form-page.tsx',
  '../../contracts/useContractForm.ts',
] as const;

describe('single-pass form validation', () => {
  it('normalizes the mobile unit payload exactly once before the mutation', () => {
    const rawValues = {
      unit_number: 'غرفة 10',
      floor: 'أول',
      status: 'available',
      rent_amount: '90',
      notes: '',
    };

    const normalized = unitSchema.parse(rawValues);

    expect(normalized).toEqual({
      unit_number: 'غرفة 10',
      floor: 'أول',
      status: 'available',
      rent_amount: 90,
      notes: null,
    });

    // Re-parsing resolver output used to reject notes=null before any PATCH request.
    expect(unitSchema.safeParse(normalized).success).toBe(false);
  });

  it.each(resolverBackedSubmissionFiles)(
    '%s keeps resolver output raw when the submit handler parses values',
    (relativePath) => {
      const source = readFileSync(resolve(import.meta.dirname, relativePath), 'utf8');
      const parseCount = source.match(/\.parse\(values\)/g)?.length ?? 0;
      const rawResolverCount = source.match(/\{\s*raw:\s*true\s*\}/g)?.length ?? 0;
      const firstParseIndex = source.indexOf('.parse(values)');
      const firstTryIndex = source.indexOf('try {');

      expect(parseCount).toBeGreaterThan(0);
      expect(rawResolverCount).toBe(parseCount);
      expect(firstTryIndex).toBeGreaterThanOrEqual(0);
      expect(firstTryIndex).toBeLessThan(firstParseIndex);
    },
  );
});
