import { describe, expect, it } from 'vitest';
import { buildCsv, CSV_UTF8_BOM, escapeCsvValue, withUtf8Bom } from './csvExport';

describe('csvExport', () => {
  it('neutralizes formula-leading text values', () => {
    expect(escapeCsvValue('=SUM(1,1)')).toBe('"\'=SUM(1,1)"');
    expect(escapeCsvValue(' -10')).toBe('"\' -10"');
    expect(escapeCsvValue('@tenant')).toBe('"\'@tenant"');
  });

  it('builds sorted-key CSV and preserves a UTF-8 BOM wrapper', () => {
    expect(buildCsv([{ name: 'مستأجر', amount: 5 }])).toBe('amount,name\n5,"مستأجر"');
    expect(withUtf8Bom('a,b')).toBe(`${CSV_UTF8_BOM}a,b`);
  });
});

// Covers the actual delimiter/quote grammar, not JSON lookalikes.
describe('RFC CSV and spreadsheet safety', () => {
  it('doubles embedded quotes and keeps actual newlines and backslashes', () => {
    expect(escapeCsvValue('A "quoted" value')).toBe('"A ""quoted"" value"');
    expect(escapeCsvValue('a\nb\\c')).toBe('"a\nb\\c"');
  });
  it('escapes malicious headers as well as values', () => {
    expect(buildCsv([{ '=SUM(1,2)': '@cmd' }])).toBe('"\'=SUM(1,2)"\n"\'@cmd"');
  });
  it('preserves numeric negatives while neutralizing text formulas after whitespace', () => {
    expect(escapeCsvValue(-12.345)).toBe('-12.345');
    expect(escapeCsvValue('\t=1+1')).toBe('"\'\t=1+1"');
    expect(escapeCsvValue(NaN)).toBe('');
  });
});
