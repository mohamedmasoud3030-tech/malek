import { describe, expect, it } from 'vitest';
import { buildXlsxBytes, neutralizeSpreadsheetFormula } from './xlsx-export';

describe('XLSX export', () => {
  it('neutralizes formula-looking user text without changing normal text', () => {
    expect(neutralizeSpreadsheetFormula('=1+1')).toBe("'=1+1");
    expect(neutralizeSpreadsheetFormula(' +SUM(A1:A2)')).toBe("' +SUM(A1:A2)");
    expect(neutralizeSpreadsheetFormula('@cmd')).toBe("'@cmd");
    expect(neutralizeSpreadsheetFormula('عقار مسقط')).toBe('عقار مسقط');
  });

  it('builds a real OpenXML XLSX package with an RTL frozen header and no formulas', () => {
    const bytes = buildXlsxBytes({
      name: 'العقارات',
      headers: ['العقار', 'القيمة'],
      rows: [
        ['=malicious()', 120.5],
        ['برج مسقط', 98],
      ],
    });

    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(Array.from(bytes.slice(-22, -18))).toEqual([0x50, 0x4b, 0x05, 0x06]);

    // Entries use the ZIP STORE method intentionally, so their XML remains
    // inspectable here without bringing a ZIP dependency into the app/tests.
    const packageText = new TextDecoder().decode(bytes);
    expect(packageText).toContain('[Content_Types].xml');
    expect(packageText).toContain('xl/workbook.xml');
    expect(packageText).toContain('xl/worksheets/sheet1.xml');
    expect(packageText).toContain('rightToLeft="1"');
    expect(packageText).toContain('state="frozen"');
    expect(packageText).toContain('autoFilter');
    expect(packageText).toContain("'=malicious()");
    expect(packageText).not.toContain('<f>');
  });
});
