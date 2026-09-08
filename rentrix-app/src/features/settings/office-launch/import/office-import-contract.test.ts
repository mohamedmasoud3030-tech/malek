// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { parseXlsxMatrix } from './office-import';
import {
  buildOfficeImportPreview,
  buildOfficeImportTemplate,
} from './office-import';

describe('canonical office import contract', () => {
  it('accepts the unit statuses owned by the canonical unit schema', () => {
    const preview = buildOfficeImportPreview('units', [
      ['العقار', 'رقم الوحدة', 'الإيجار', 'الحالة'],
      ['برج النخيل', '101', '250.000', 'available'],
    ]);
    expect(preview.issues).toEqual([]);
    expect(preview.canCommit).toBe(true);
  });

  it('blocks legacy vacant status before a unit reaches the service boundary', () => {
    const preview = buildOfficeImportPreview('units', [
      ['العقار', 'رقم الوحدة', 'الإيجار', 'الحالة'],
      ['برج النخيل', '101', '250.000', 'vacant'],
    ]);
    expect(preview.canCommit).toBe(false);
    expect(preview.issues.some((issue) => issue.message.includes('available'))).toBe(true);
  });

  it('blocks a spreadsheet-only unit type field that the current unit record does not own', () => {
    const preview = buildOfficeImportPreview('units', [
      ['العقار', 'رقم الوحدة', 'نوع الوحدة', 'الإيجار', 'الحالة'],
      ['برج النخيل', '101', 'apartment', '250.000', 'available'],
    ]);
    expect(preview.canCommit).toBe(false);
    expect(preview.issues.some((issue) => issue.field === 'type')).toBe(true);
  });

  it('generates an XLSX unit template that passes its own canonical preview gate', async () => {
    const template = buildOfficeImportTemplate('units', 'xlsx');
    const bytes = new Uint8Array(await template.blob.arrayBuffer());
    const matrix = await parseXlsxMatrix(bytes);
    const preview = buildOfficeImportPreview('units', matrix);
    expect(preview.canCommit).toBe(true);
    expect(preview.issues).toEqual([]);
  });
});

it.each(['owners', 'properties', 'units', 'tenants', 'contracts'] as const)(
  '%s CSV and XLSX templates share the same field authority and pass preview', async (entity) => {
    const { parseCsvMatrix } = await import('./office-import');
    const csv = buildOfficeImportTemplate(entity, 'csv');
    const xlsx = buildOfficeImportTemplate(entity, 'xlsx');
    const csvMatrix = parseCsvMatrix(await csv.blob.text());
    const xlsxMatrix = await parseXlsxMatrix(new Uint8Array(await xlsx.blob.arrayBuffer()));
    expect(csvMatrix).toEqual(xlsxMatrix);
    expect(buildOfficeImportPreview(entity, csvMatrix).canCommit).toBe(true);
  },
);
