import { describe, expect, it } from 'vitest';
import { parseBankCsv, computeFileFingerprint } from './bankCsvParser';

describe('bankCsvParser', () => {
  const baseFileName = 'statement.csv';
  const baseFileSize = 100;

  it('handles UTF-8 BOM', () => {
    const csv = '\uFEFFdate,description,reference,amount\n2026-01-01,Test,REF1,100.000';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.encoding).toBe('UTF-8 BOM');
    expect(result.validRows.length).toBe(1);
    expect(result.validRows[0].transaction_date).toBe('2026-01-01');
  });

  it('handles Arabic headers', () => {
    const csv = 'التاريخ,الوصف,المرجع,المبلغ\n2026-02-01,إيجار,REF-AR,250.500';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.hasHeader).toBe(true);
    expect(result.missingMandatory.length).toBe(0);
    expect(result.validRows.length).toBe(1);
    expect(result.validRows[0].amount).toBe(250.5);
  });

  it('handles English headers', () => {
    const csv = 'transaction_date,description,reference,amount\n2026-02-02,Payment,REF-EN,300';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.hasHeader).toBe(true);
    expect(result.validRows.length).toBe(1);
  });

  it('handles comma delimiter', () => {
    const csv = 'date,description,reference,amount\n2026-01-01,Test,REF1,100\n2026-01-02,Test2,REF2,200';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.delimiter).toBe(',');
    expect(result.validRows.length).toBe(2);
  });

  it('handles semicolon delimiter when reliably detectable', () => {
    const csv = 'date;description;reference;amount\n2026-01-01;Test;REF1;100.000\n2026-01-02;Test2;REF2;200.000';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.delimiter).toBe(';');
    expect(result.validRows.length).toBe(2);
  });

  it('handles quoted delimiters', () => {
    const csv = 'date,description,reference,amount\n2026-01-01,"Test, with comma",REF1,100.000';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows.length).toBe(1);
    expect(result.validRows[0].description).toBe('Test, with comma');
  });

  it('accepts OMR amounts with exactly up to 3dp', () => {
    const csv = 'date,description,reference,amount\n2026-01-01,OMR test,REF1,123.456';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows[0].amount).toBe(123.456);
  });

  it('rejects OMR amounts beyond 3dp instead of rounding', () => {
    const csv = 'date,description,reference,amount\n2026-01-01,OMR test,REF1,123.4567';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows.length).toBe(0);
    expect(result.rejectedRows[0].reason).toContain('مبلغ');
  });

  it('rejects invalid amount', () => {
    const csv = 'date,description,reference,amount\n2026-01-01,Bad,REF1,not-a-number';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows.length).toBe(0);
    expect(result.rejectedRows.length).toBe(1);
    expect(result.rejectedRows[0].reason).toContain('مبلغ');
  });

  it('rejects zero amount', () => {
    const csv = 'date,description,reference,amount\n2026-01-01,Zero,REF1,0.000';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows.length).toBe(0);
    expect(result.rejectedRows[0].reason).toContain('مبلغ');
  });

  it('rejects invalid date', () => {
    const csv = 'date,description,reference,amount\nnot-a-date,Bad,REF1,100';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows.length).toBe(0);
    expect(result.rejectedRows.length).toBe(1);
    expect(result.rejectedRows[0].reason).toContain('تاريخ');
  });

  it('rejects missing required columns fail-closed', () => {
    const csv = 'description,reference,balance\nTest,REF1,10.000';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.missingMandatory).toContain('transaction_date');
    expect(result.missingMandatory).toContain('amount');
    expect(result.validRows.length).toBe(0);
    expect(result.rejectedRows.length).toBe(1);
  });

  it('rejects headerless files instead of inferring positional mapping', () => {
    const csv = '2026-01-01,Test,REF1,100.000';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.hasHeader).toBe(false);
    expect(result.validRows.length).toBe(0);
    expect(result.errorSummary).toContain('ممنوع');
  });

  it('handles blank rows (skips them)', () => {
    const csv = 'date,description,reference,amount\n\n2026-01-01,Test,REF1,100\n\n2026-01-02,Test2,REF2,200\n\n';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows.length).toBe(2);
    expect(result.rejectedRows.length).toBe(0);
  });

  it('handles debit/credit normalization', () => {
    const csv = 'date,description,debit,credit\n2026-01-01,Deposit,,500.000\n2026-01-02,Withdrawal,200.000,';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows.length).toBe(2);
    expect(result.validRows[0].amount).toBe(500);
    expect(result.validRows[1].amount).toBe(-200);
  });

  it('rejects rows with both debit and credit populated', () => {
    const csv = 'date,description,debit,credit\n2026-01-01,Conflict,10.000,20.000';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows.length).toBe(0);
    expect(result.rejectedRows[0].reason).toContain('مدين ودائن');
  });

  it('detects duplicate header and blocks data parsing', () => {
    const csv = 'date,date,description,amount\n2026-01-01,2026-01-01,Test,100';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.errorSummary).toContain('مكررة');
    expect(result.validRows.length).toBe(0);
  });

  it('detects ambiguous mapping and blocks data parsing', () => {
    const csv = 'date,transaction_date,description,amount\n2026-01-01,2026-01-01,Test,100';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.mappingAmbiguous).toBe(true);
    expect(result.validRows.length).toBe(0);
    expect(result.errorSummary).toContain('غامض');
  });

  it('parses DD/MM/YYYY date format', () => {
    const csv = 'date,description,reference,amount\n01/02/2026,Test,REF1,100';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows[0].transaction_date).toBe('2026-02-01');
  });

  it('rejects non-OMR currency conflicts', () => {
    const csv = 'date,description,reference,amount,currency\n2026-01-01,Test,REF1,100.000,USD';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows.length).toBe(0);
    expect(result.rejectedRows[0].field).toBe('currency');
  });

  it('computes file fingerprint deterministically', async () => {
    const content = 'date,description,amount\n2026-01-01,Test,100';
    const fp1 = await computeFileFingerprint(content);
    const fp2 = await computeFileFingerprint(content);
    expect(fp1).toBe(fp2);
  });

  it('surfaces all row errors before any DB write; caller must fail closed', () => {
    const csv = 'date,description,reference,amount\n2026-01-01,Good,REF1,100\n2026-01-02,Bad,REF2,invalid\n2026-01-03,Zero,REF3,0';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.totalRows).toBe(3);
    expect(result.validRows.length).toBe(1);
    expect(result.rejectedRows.length).toBe(2);
    expect(result.errorSummary).toContain('يرفض الدفعة كاملة');
  });

  it('does not reject legitimate same-date/same-amount records unless the normalized row is exact duplicate', () => {
    const csv = 'date,description,reference,amount\n2026-01-01,Rent A,REF1,100.000\n2026-01-01,Rent B,REF2,100.000';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows.length).toBe(2);
    expect(result.duplicateWithinFile).toBe(0);
  });

  it('rejects exact duplicate rows within the same file fail-closed', () => {
    const csv = 'date,description,reference,amount\n2026-01-01,Test,REF1,100.000\n2026-01-01,Test,REF1,100.000';
    const result = parseBankCsv(csv, baseFileName, baseFileSize);
    expect(result.validRows.length).toBe(1);
    expect(result.rejectedRows.length).toBe(1);
    expect(result.duplicateWithinFile).toBe(1);
  });
});
