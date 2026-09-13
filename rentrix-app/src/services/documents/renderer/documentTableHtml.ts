/**
 * Shared document table primitives — the ONLY table layout code in the
 * document platform.
 *
 * Both the standard document composer (`documentHtml.ts`) and the
 * professional report composer (`professionalDocumentHtml.ts`) render their
 * tables through these helpers, so a table looks and paginates identically
 * in every document type, in print and in PDF alike.
 *
 * Alignment contract (RTL documents):
 *  - a column is numeric only when EVERY non-empty cell parses as a number
 *    (optionally currency/percent suffixed); numeric columns align to the
 *    LEFT edge with bold figures so amounts scan vertically in RTL text,
 *  - text columns align to the right (the RTL leading edge).
 */
import { DOCUMENT_COLORS, DOCUMENT_TABLE, DOCUMENT_TYPE } from '../documentDesignTokens';
import { escapeDocumentHtml } from './documentHtmlShared';

/** Numbers with optional currency (ر.ع/OMR/…) or percent suffix. */
const NUMERIC_CELL_REGEX = /^[\s\-+]*[\d,.]+(?:\s?(?:ر\.?ع\.?|OMR|SAR|AED|USD|%))?\s*$/;

export const isNumericCell = (value: string): boolean => NUMERIC_CELL_REGEX.test(value.trim());

/** True when the column's non-empty cells are all numeric. */
export function isNumericColumn(rows: string[][], columnIndex: number): boolean {
  const values = rows.map((row) => row[columnIndex]).filter((value): value is string => Boolean(value && value.trim()));
  if (values.length === 0) return false;
  return values.every((value) => NUMERIC_CELL_REGEX.test(value.trim()));
}

/** Inline alignment style for one body column. */
export const columnAlignment = (rows: string[][], columnIndex: number): string =>
  isNumericColumn(rows, columnIndex) ? 'font-weight: 700; text-align: left;' : 'text-align: right;';

/** Header alignment mirrors the body column alignment. */
export const headAlignment = (rows: string[][], columnIndex: number): string =>
  isNumericColumn(rows, columnIndex) ? 'left' : 'right';

export function buildTableHeadHtml(columns: string[], rows: string[][]): string {
  return `<thead><tr>${columns
    .map(
      (column, index) =>
        `<th style="background-color: ${DOCUMENT_COLORS.tableHeadBg}; color: ${DOCUMENT_COLORS.tableHeadFg}; ${DOCUMENT_TYPE.tableHead}; padding: ${DOCUMENT_TABLE.headPadding}; border: ${DOCUMENT_TABLE.headBorder}; text-align: ${headAlignment(rows, index)};">${escapeDocumentHtml(column)}</th>`,
    )
    .join('')}</tr></thead>`;
}

export function buildTableRowsHtml(rows: string[][]): string {
  return rows
    .map(
      (row) =>
        `<tr style="page-break-inside: avoid; break-inside: avoid;">${row
          .map(
            (cell, index) =>
              `<td style="border: ${DOCUMENT_TABLE.border}; padding: ${DOCUMENT_TABLE.cellPadding}; ${DOCUMENT_TYPE.tableCell}; color: ${DOCUMENT_COLORS.text}; ${columnAlignment(rows, index)}">${escapeDocumentHtml(cell)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');
}

/** Normalizes the one-row / multi-row totals contract into row arrays. */
export const normalizeTotalsRows = (totals: string[] | string[][] | undefined): string[][] => {
  if (!totals?.length) return [];
  return Array.isArray(totals[0]) ? (totals as string[][]) : [totals as string[]];
};

/**
 * Totals band: full-width, bold; accepts one row or several stacked rows.
 * The LAST cell of the LAST row is by contract the grand total and gets
 * the accent color; the last cell of intermediate rows stays bold ink.
 */
export function buildTableFootHtml(totals: string[] | string[][] | undefined): string {
  const rows = normalizeTotalsRows(totals);
  if (rows.length === 0) return '';
  const body = rows
    .map((row, rowIndex) => {
      const isFinalRow = rowIndex === rows.length - 1;
      return `<tr style="background-color: ${DOCUMENT_COLORS.surface}; ${DOCUMENT_TYPE.totals};">${row
        .map(
          (total, index) =>
            `<th style="border: ${DOCUMENT_TABLE.border}; padding: ${DOCUMENT_TABLE.cellPadding}; color: ${
              isFinalRow && index === row.length - 1 ? DOCUMENT_COLORS.accent : DOCUMENT_COLORS.ink
            }; text-align: ${isFinalRow && index === row.length - 1 ? 'left' : 'right'};">${escapeDocumentHtml(total)}</th>`,
        )
        .join('')}</tr>`;
    })
    .join('');
  return `<tfoot>${body}</tfoot>`;
}

/** Explicit empty-state row (never an unexplained empty table). */
export function buildEmptyNoteRow(note: string, columnCount: number): string {
  return `<tr style="page-break-inside: avoid; break-inside: avoid;"><td colspan="${Math.max(1, columnCount)}" style="border: ${DOCUMENT_TABLE.border}; padding: ${DOCUMENT_TABLE.cellPadding}; ${DOCUMENT_TYPE.caption}; color: ${DOCUMENT_COLORS.muted}; text-align: center;">${escapeDocumentHtml(note)}</td></tr>`;
}

/** One complete table (header always present; totals optional). */
export function buildDocumentTableHtml(options: {
  columns: string[];
  rows: string[][];
  totals?: string[];
  emptyNote?: string | null;
}): string {
  const body =
    options.rows.length === 0 && options.emptyNote
      ? buildEmptyNoteRow(options.emptyNote, options.columns.length)
      : buildTableRowsHtml(options.rows);
  return `<table style="width: 100%; border-collapse: collapse;">
    ${buildTableHeadHtml(options.columns, options.rows)}
    <tbody>${body}</tbody>
    ${buildTableFootHtml(options.totals)}
  </table>`;
}
