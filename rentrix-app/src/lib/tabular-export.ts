import type { CsvRow, CsvValue } from './csvExport';
import { buildXlsxBlob } from './xlsx-export';

export function csvRowsToXlsxBlob(rows: readonly CsvRow[], sheetName: string) {
  const headers = Object.keys(rows[0] ?? {}).sort((a, b) => a.localeCompare(b));
  return buildXlsxBlob({
    name: sheetName,
    headers,
    rows: rows.map((row) => headers.map((header) => row[header] as CsvValue)),
  });
}

export function xlsxFilenameFromCsv(filename: string) {
  return filename.toLowerCase().endsWith('.csv')
    ? `${filename.slice(0, -4)}.xlsx`
    : `${filename}.xlsx`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
}
