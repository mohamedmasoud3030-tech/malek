export type CsvValue = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvValue>;
export const CSV_UTF8_BOM = '\uFEFF';

export type CsvEncodingOptions = Readonly<{
  /** Preserve compact historical register CSVs; reports quote all text by default. */
  quoteText?: boolean;
  /** Disable ONLY for trusted static import templates, never user-controlled exports. */
  spreadsheetSafe?: boolean;
}>;

/** RFC 4180 escaping. JSON string escaping is not CSV (quotes double, newlines remain literal).
 * Text that spreadsheet applications could execute is neutralized; typed numbers stay numeric.
 */
export function escapeCsvValue(value: CsvValue, options: CsvEncodingOptions = {}): string {
  if (value == null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return String(value);
  const safe = options.spreadsheetSafe !== false && /^[=+\-@]/.test(value.trimStart())
    ? `'${value}` : value;
  return options.quoteText !== false || /[",\n\r]/.test(safe)
    ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Ordered exports and import templates share the same encoder as object-row reports. */
export function buildCsvMatrix(rows: readonly (readonly CsvValue[])[], options: CsvEncodingOptions = {}): string {
  return rows.map((row) => row.map((value) => escapeCsvValue(value, options)).join(',')).join('\n');
}

export function buildCsv(rows: readonly CsvRow[]) {
  const keys = Object.keys(rows[0] ?? {}).sort((a, b) => a.localeCompare(b));
  // Headers may also contain user input; do not concatenate them unescaped.
  const header = keys.map((key) => escapeCsvValue(key, { quoteText: false })).join(',');
  return [header, ...rows.map((row) => keys.map((key) => escapeCsvValue(row[key])).join(','))].join('\n');
}

export function withUtf8Bom(csv: string) {
  return `${CSV_UTF8_BOM}${csv}`;
}
