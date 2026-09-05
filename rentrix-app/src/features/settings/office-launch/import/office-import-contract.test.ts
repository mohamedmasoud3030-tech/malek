// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { parseXlsxMatrix } from './office-import';
import {
  buildCanonicalOfficeImportPreview,
  buildCanonicalOfficeImportTemplate,
} from './office-import-contract';

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

  it('generates an XLSX unit template that passes its own canonical preview gate', async () => {
    const template = buildCanonicalOfficeImportTemplate('units', 'xlsx');
    const bytes = new Uint8Array(await template.blob.arrayBuffer());
    const matrix = await parseXlsxMatrix(bytes);
    const preview = buildCanonicalOfficeImportPreview('units', matrix);
    expect(preview.canCommit).toBe(true);
    expect(preview.issues).toEqual([]);
  });
});
