import { buildXlsxBlob } from '@/lib/xlsx-export';
import { withUtf8Bom } from '@/lib/csvExport';
import {
  buildOfficeImportPreview,
  buildOfficeImportTemplate,
  type OfficeImportEntity,
  type OfficeImportIssue,
  type OfficeImportPreview,
} from './office-import';

const canonicalUnitStatuses = new Set(['available', 'occupied', 'maintenance', 'reserved']);
const legacyUnitField = 'type';

export function buildCanonicalOfficeImportPreview(
  entity: OfficeImportEntity,
  matrix: readonly (readonly string[])[],
): OfficeImportPreview {
  const preview = buildOfficeImportPreview(entity, matrix);
  if (entity !== 'units') return preview;

  const extraIssues: OfficeImportIssue[] = [];
  preview.rows.forEach((row, index) => {
    const sourceRow = index + 2;
    if (!row.status) {
      extraIssues.push({ row: sourceRow, field: 'status', message: 'حالة الوحدة مطلوبة' });
    } else if (!canonicalUnitStatuses.has(row.status.trim().toLowerCase())) {
      extraIssues.push({
        row: sourceRow,
        field: 'status',
        message: 'حالة الوحدة يجب أن تكون available أو occupied أو maintenance أو reserved',
      });
    }
    if (row[legacyUnitField]) {
      extraIssues.push({
        row: sourceRow,
        field: legacyUnitField,
        message: 'نوع الوحدة ليس حقلاً في سجل الوحدة الحالي؛ احذف العمود قبل الاعتماد',
      });
    }
  });

  const issues = [...preview.issues, ...extraIssues];
  const invalidRows = new Set(issues.filter((issue) => issue.row > 1).map((issue) => issue.row));
  const validRows = preview.rows.filter((_, index) => !invalidRows.has(index + 2));
  return {
    ...preview,
    validRows,
    issues,
    canCommit: preview.rows.length > 0 && issues.length === 0,
  };
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildCanonicalOfficeImportTemplate(entity: OfficeImportEntity, format: 'csv' | 'xlsx') {
  if (entity !== 'units') return buildOfficeImportTemplate(entity, format);

  // Keep the downloadable v1 template to the field subset that both the
  // browser parser and the canonical unit service understand end-to-end.
  // Extra unit fields can be added only when both sides share the contract.
  const headers = ['العقار', 'رقم الوحدة', 'الطابق', 'الإيجار', 'الحالة'];
  const row = ['برج النخيل', '101', '1', '250.000', 'available'];
  const filename = `malek-units-import-template.${format}`;
  if (format === 'xlsx') {
    return { filename, blob: buildXlsxBlob({ name: 'الوحدات', headers, rows: [row] }) };
  }
  const csv = [headers.map(csvEscape).join(','), row.map(csvEscape).join(',')].join('\n');
  return { filename, blob: new Blob([withUtf8Bom(csv)], { type: 'text/csv;charset=utf-8' }) };
}
