import { describe, expect, it } from 'vitest';
import { buildXlsxBytes } from '@/lib/xlsx-export';
import {
  buildOfficeImportPreview,
  officeImportSpecs,
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
});

describe('XLSX reader', () => {
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
