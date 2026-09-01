import { describe, expect, it } from 'vitest';
import { buildCanonicalOfficeImportPreview } from './office-import-contract';

describe('canonical office import contract', () => {
  it('accepts the unit statuses owned by the canonical unit schema', () => {
    const preview = buildCanonicalOfficeImportPreview('units', [
      ['العقار', 'رقم الوحدة', 'الإيجار', 'الحالة'],
      ['برج النخيل', '101', '250.000', 'available'],
    ]);
    expect(preview.issues).toEqual([]);
    expect(preview.canCommit).toBe(true);
  });

  it('blocks legacy vacant status before a unit reaches the service boundary', () => {
    const preview = buildCanonicalOfficeImportPreview('units', [
      ['العقار', 'رقم الوحدة', 'الإيجار', 'الحالة'],
      ['برج النخيل', '101', '250.000', 'vacant'],
    ]);
    expect(preview.canCommit).toBe(false);
    expect(preview.issues.some((issue) => issue.message.includes('available'))).toBe(true);
  });

  it('blocks a spreadsheet-only unit type field that the current unit record does not own', () => {
    const preview = buildCanonicalOfficeImportPreview('units', [
      ['العقار', 'رقم الوحدة', 'نوع الوحدة', 'الإيجار', 'الحالة'],
      ['برج النخيل', '101', 'apartment', '250.000', 'available'],
    ]);
    expect(preview.canCommit).toBe(false);
    expect(preview.issues.some((issue) => issue.field === 'type')).toBe(true);
  });
});
