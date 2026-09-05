// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildXlsxBytes } from '@/lib/xlsx-export';
import {
  buildOfficeImportPreview,
  officeImportSpecs,
  OFFICE_IMPORT_MAX_COLUMNS,
  OFFICE_IMPORT_MAX_FILE_BYTES,
  OFFICE_IMPORT_MAX_ROWS,
  parseCsvMatrix,
  parseXlsxMatrix,
} from './office-import';

describe('office import preview', () => {
  it('parses quoted CSV including commas and newlines', () => {
    const matrix = parseCsvMatrix('\uFEFF"اسم المالك","العنوان"\r\n"أحمد الحارثي","مسقط، الخوير"\r\n"سالم","سطر 1\nسطر 2"');
    expect(matrix).toEqual([
      ['اسم المالك', 'العنوان'],
      ['أحمد الحارثي', 'مسقط، الخوير'],
      ['سالم', 'سطر 1\nسطر 2'],
    ]);
  });

  it('maps Arabic aliases and blocks a file with invalid rows', () => {
    const preview = buildOfficeImportPreview('owners', [
      ['اسم المالك', 'الهاتف', 'البريد الإلكتروني'],
      ['أحمد الحارثي', '+96890000000', 'owner@example.com'],
      ['', '+96891111111', 'not-an-email'],
    ]);

    expect(preview.rows).toHaveLength(2);
    expect(preview.validRows).toHaveLength(1);
    expect(preview.canCommit).toBe(false);
    expect(preview.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      'اسم المالك مطلوب',
      'البريد الإلكتروني: صيغة البريد الإلكتروني غير صحيحة',
    ]));
  });

  it('detects duplicate business keys before any write is allowed', () => {
    const preview = buildOfficeImportPreview('units', [
      ['العقار', 'رقم الوحدة', 'الإيجار'],
      ['برج النخيل', '101', '250.000'],
      ['برج النخيل', '101', '260.000'],
    ]);

    expect(preview.canCommit).toBe(false);
    expect(preview.issues.some((issue) => issue.message.includes('سجل مكرر'))).toBe(true);
  });

  it('requires canonical property ownership context in the property template', () => {
    const fields = officeImportSpecs.properties.fields.map((field) => field.key);
    expect(fields).toEqual(expect.arrayContaining(['title', 'address', 'owner_name', 'ownership_percentage', 'agreement_start']));
  });

  it('validates contract dates and money without creating a financial record', () => {
    const preview = buildOfficeImportPreview('contracts', [
      ['العقار', 'رقم الوحدة', 'المستأجر', 'تاريخ البداية', 'تاريخ النهاية', 'الإيجار'],
      ['برج النخيل', '101', 'سالم', '2026-12-01', '2026-01-01', '-1'],
    ]);
    expect(preview.canCommit).toBe(false);
    expect(preview.issues.map((issue) => issue.message).join(' ')).toContain('أكبر من صفر');
    expect(preview.issues.map((issue) => issue.message).join(' ')).toContain('نهاية العقد');
  });
  it('rejects row and column counts beyond the bounded preview contract', () => {
    const tooManyRows = Array.from({ length: OFFICE_IMPORT_MAX_ROWS + 2 }, (_, index) => [index === 0 ? 'اسم المالك' : `مالك ${index}`]);
    expect(() => buildOfficeImportPreview('owners', tooManyRows)).toThrow('سجل كحد أقصى');

    const tooManyColumns = [Array.from({ length: OFFICE_IMPORT_MAX_COLUMNS + 1 }, (_, index) => `عمود ${index}`)];
    expect(() => buildOfficeImportPreview('owners', tooManyColumns)).toThrow('عموداً كحد أقصى');
  });
});

describe('XLSX reader', () => {
  it('rejects an oversized workbook before ZIP parsing', async () => {
    await expect(parseXlsxMatrix(new Uint8Array(OFFICE_IMPORT_MAX_FILE_BYTES + 1))).rejects.toThrow('5 ميجابايت');
  });

  it('reads the native MALEK XLSX format without an external spreadsheet dependency', async () => {
    const bytes = buildXlsxBytes({
      name: 'الملاك',
      headers: ['اسم المالك', 'الهاتف'],
      rows: [['أحمد الحارثي', '+96890000000']],
    });
    const matrix = await parseXlsxMatrix(bytes);
    expect(matrix).toEqual([
      ['اسم المالك', 'الهاتف'],
      ['أحمد الحارثي', '+96890000000'],
    ]);
  });
});
