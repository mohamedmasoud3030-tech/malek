/**
 * Print/PDF HTML assembly — the ONLY place document markup is built.
 *
 * Two artifacts come out of this module:
 *
 *  - `buildPrintableDocumentHtml`: a complete standalone HTML document for
 *    the scoped print popup (carries the print stylesheet, A4 page setup,
 *    and real browser pagination via `thead { display: table-header-group }`).
 *
 *  - `buildDocumentBodyHtml`: a body-only fragment for the offscreen
 *    measurement container used by the PDF path. It deliberately contains
 *    NO `<style>`/`<link>` tags — earlier code injected a whole document
 *    into a `<div>`, which leaked document styles into the live app DOM.
 *
 * Long tables are chunked into page-sized table blocks up-front so the
 * paginator can always break BETWEEN chunks (never mid-row), and every
 * chunk repeats its column header at the top of the next page.
 */
import type { SignatureRole, UnifiedDocumentModel } from '../types';
import { formatLatinDateTime } from '@/lib/formatters';
import { MAX_ROWS_PER_TABLE_CHUNK } from '../documentRegistry';

const ARABIC_REGEX = /[\u0600-\u06FF]/;
const DEFAULT_SIGNATURE_LABELS = new Set(['توقيع المالك', 'توقيع المستأجر', 'توقيع المحاسب', 'توقيع المدير العام']);

export const signatureLabel: Record<SignatureRole, string> = {
  owner: 'توقيع المالك',
  tenant: 'توقيع المستأجر',
  accountant: 'توقيع المحاسب',
  general_manager: 'اعتماد المدير العام',
};

export const escapeDocumentHtml = (value: string | null | undefined): string =>
  (value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });

export const collectDocumentTextChunks = (model: UnifiedDocumentModel): string[] => {
  const signatureTexts = model.footer.signatures
    .map((role) => signatureLabel[role])
    .filter((label) => !DEFAULT_SIGNATURE_LABELS.has(label));

  return [
    model.header.companyName,
    model.header.companyAddress,
    model.header.companyPhone,
    model.header.companyEmail,
    model.header.companyTaxNumber,
    model.header.companyRegistrationNumber,
    model.header.title,
    model.header.documentNo,
    model.header.dateLabel,
    model.header.dateValue,
    ...model.kpis.flatMap((k) => [k.label, k.value]),
    ...model.tables.flatMap((t) => [t.title, ...t.columns, ...t.rows.flat(), ...(t.totals ?? []), t.emptyNote]),
    model.footer.companyStampLabel,
    model.footer.metadata,
    ...signatureTexts,
  ].filter((v): v is string => Boolean(v));
};

export const modelHasArabicText = (model: UnifiedDocumentModel): boolean =>
  collectDocumentTextChunks(model).some((chunk) => ARABIC_REGEX.test(chunk));

/**
 * A column is treated as numeric (amounts/counts/balances are aligned left
 * and bolded for scan stability in RTL) only when its cell values actually
 * look numeric. Plain-text columns stay right-aligned like other text.
 */
const NUMERIC_CELL_REGEX = /^[\s\-+]*[\d,.]+(?:\s?(?:ر\.?ع\.?|OMR|SAR|AED|USD|%))?\s*$/;

const isNumericColumn = (rows: string[][], columnIndex: number): boolean => {
  const values = rows.map((row) => row[columnIndex]).filter((value): value is string => Boolean(value && value.trim()));
  if (values.length === 0) return false;
  return values.every((value) => NUMERIC_CELL_REGEX.test(value.trim()));
};

const cellAlignment = (rows: string[][], columnIndex: number): string =>
  isNumericColumn(rows, columnIndex) ? 'font-weight: 700; text-align: left;' : 'text-align: right;';

const buildHtmlRows = (rows: string[][]) =>
  rows
    .map(
      (row) =>
        `<tr style="page-break-inside: avoid; break-inside: avoid;">${row
          .map(
            (cell, index) =>
              `<td style="border: 1px solid #CBD5E1; padding: 8px 10px; font-size: 13px; color: #1E293B; ${cellAlignment(rows, index)}">${escapeDocumentHtml(cell)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

const buildHtmlTableHead = (columns: string[], rows: string[][]) =>
  `<thead><tr>${columns
    .map(
      (column, index) =>
        `<th style="background-color: #0F172A; color: #FFFFFF; font-weight: 700; font-size: 13px; padding: 10px; border: 1px solid #0F172A; text-align: ${
          isNumericColumn(rows, index) ? 'left' : 'right'
        };">${escapeDocumentHtml(column)}</th>`,
    )
    .join('')}</tr></thead>`;

const buildHtmlTableFoot = (totals: string[] | undefined) =>
  totals?.length
    ? `<tfoot><tr style="background-color: #F8FAFC; font-weight: 800;">${totals
        .map(
          (total, index) =>
            // Totals rows legitimately end in the grand-total figure, so the
            // last cell is always treated as the numeric one.
            `<th style="border: 1px solid #CBD5E1; padding: 10px; font-size: 14px; color: #0284C7; text-align: ${
              index === totals.length - 1 ? 'left' : 'right'
            };">${escapeDocumentHtml(total)}</th>`,
        )
        .join('')}</tr></tfoot>`
    : '';

const buildEmptyNoteRow = (note: string, columnCount: number) =>
  `<tr style="page-break-inside: avoid; break-inside: avoid;"><td colspan="${Math.max(1, columnCount)}" style="border: 1px solid #CBD5E1; padding: 10px; font-size: 12px; color: #64748B; text-align: center;">${escapeDocumentHtml(note)}</td></tr>`;

type TableBlock = { title?: string; html: string };

/**
 * Splits one logical table into page-sized blocks. Each block carries its
 * own `<thead>` so a table spanning pages always shows its column header at
 * the top of the following page; `<tfoot>` totals live only on the last
 * block. The paginator only ever breaks between these blocks.
 */
export function chunkTableBlocks(table: UnifiedDocumentModel['tables'][number]): TableBlock[] {
  const chunks: string[][][] = [];
  for (let i = 0; i < table.rows.length; i += MAX_ROWS_PER_TABLE_CHUNK) {
    chunks.push(table.rows.slice(i, i + MAX_ROWS_PER_TABLE_CHUNK));
  }
  if (chunks.length === 0) chunks.push([]);

  return chunks.map((chunkRows, index) => {
    const isFirst = index === 0;
    const isLast = index === chunks.length - 1;
    const bodyRows = chunkRows.length === 0 && table.emptyNote
      ? buildEmptyNoteRow(table.emptyNote, table.columns.length)
      : buildHtmlRows(chunkRows);
    const html = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 6px;">
        ${buildHtmlTableHead(table.columns, table.rows)}
        <tbody>${bodyRows}</tbody>
        ${isLast ? buildHtmlTableFoot(table.totals) : ''}
      </table>`;
    return { title: isFirst ? table.title : undefined, html };
  });
}

const tableTitleHtml = (title: string) =>
  `<h3 style="font-size: 15px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0; border-bottom: 2px solid #0284C7; padding-bottom: 4px; display: inline-block;">${escapeDocumentHtml(title)}</h3>`;

/**
 * Document blocks are FULLY inline-styled: the offscreen PDF container
 * receives these fragments without any stylesheet, and the print popup's
 * standalone stylesheet only adds page/body rules. No class may carry
 * layout here — otherwise PDF and print would diverge.
 */
const HEADER_CONTAINER_STYLE =
  'display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px double #0F172A; padding-bottom: 16px; margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid;';
const COMPANY_BRAND_STYLE = 'font-size: 20px; font-weight: 900; color: #0284C7; letter-spacing: -0.5px; margin: 0 0 4px 0;';
const COMPANY_SUB_STYLE = 'font-size: 11px; color: #475569; margin: 2px 0;';
const DOC_TITLE_BADGE_STYLE =
  'background: #0F172A; color: #FFFFFF; font-size: 18px; font-weight: 800; padding: 8px 20px; border-radius: 8px; text-align: center; display: inline-block;';
const DOC_META_STYLE = 'font-size: 11px; color: #475569; margin: 6px 0 0 0; text-align: right;';
const STAMP_BOX_STYLE =
  'border: 2px dashed #0284C7; border-radius: 12px; padding: 12px; text-align: center; background: #F0F9FF; width: 140px;';
const FOOTER_AUDIT_STYLE =
  'border-top: 1px solid #E2E8F0; padding-top: 12px; margin-top: 30px; display: flex; justify-content: space-between; font-size: 10px; color: #64748B; page-break-inside: avoid; break-inside: avoid;';

const buildHeaderBlock = (model: UnifiedDocumentModel): string => {
  const logoHtml = model.header.companyLogoUrl
    ? `<img src="${escapeDocumentHtml(model.header.companyLogoUrl)}" alt="${escapeDocumentHtml(model.header.companyName)}" crossorigin="anonymous" style="max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 8px;" />`
    : '';

  const contactLines = [
    model.header.companyAddress ? `<p style="${COMPANY_SUB_STYLE}">${escapeDocumentHtml(model.header.companyAddress)}</p>` : '',
    model.header.companyPhone ? `<p style="${COMPANY_SUB_STYLE}">الهاتف: ${escapeDocumentHtml(model.header.companyPhone)}</p>` : '',
    model.header.companyEmail ? `<p style="${COMPANY_SUB_STYLE}">البريد الإلكتروني: ${escapeDocumentHtml(model.header.companyEmail)}</p>` : '',
    model.header.companyRegistrationNumber ? `<p style="${COMPANY_SUB_STYLE}">السجل التجاري: ${escapeDocumentHtml(model.header.companyRegistrationNumber)}</p>` : '',
    model.header.companyTaxNumber ? `<p style="${COMPANY_SUB_STYLE}">الرقم الضريبي: ${escapeDocumentHtml(model.header.companyTaxNumber)}</p>` : '',
  ].join('');

  return [
    `<div class="document-block" style="${HEADER_CONTAINER_STYLE}">`,
    '  <div>',
    logoHtml,
    `    <h1 style="${COMPANY_BRAND_STYLE}">${escapeDocumentHtml(model.header.companyName)}</h1>`,
    contactLines,
    '  </div>',
    '  <div style="text-align: right;">',
    `    <div style="${DOC_TITLE_BADGE_STYLE}">${escapeDocumentHtml(model.header.title)}</div>`,
    model.header.documentNo
      ? `    <p style="${DOC_META_STYLE}">رقم المستند: <strong>${escapeDocumentHtml(model.header.documentNo)}</strong></p>`
      : '',
    model.header.dateLabel && model.header.dateValue
      ? `    <p style="${DOC_META_STYLE}">${escapeDocumentHtml(model.header.dateLabel)}: <strong>${escapeDocumentHtml(model.header.dateValue)}</strong></p>`
      : '',
    '  </div>',
    '</div>',
  ].join('');
};

const buildKpiBlock = (model: UnifiedDocumentModel): string =>
  model.kpis.length
    ? `<div class="document-block" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px;">
        ${model.kpis
          .map(
            (kpi) => `
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px; page-break-inside: avoid; break-inside: avoid;">
            <span style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">${escapeDocumentHtml(kpi.label)}</span>
            <span style="display: block; font-size: 14px; font-weight: 800; color: #0F172A;">${escapeDocumentHtml(kpi.value)}</span>
          </div>`,
          )
          .join('')}
      </div>`
    : '';

/** The signature block is one atomic block so it can never be clipped mid-way. */
const buildSignatureBlock = (model: UnifiedDocumentModel): string => {
  if (model.footer.signatures.length === 0) return '';
  const signaturesHtml = model.footer.signatures
    .map(
      (role) => `
      <div style="border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; background: #FFFFFF; text-align: center; min-height: 90px; display: flex; flex-direction: column; justify-content: space-between;">
        <span style="font-size: 12px; font-weight: 800; color: #0F172A;">${escapeDocumentHtml(signatureLabel[role])}</span>
        <div style="border-bottom: 1px dashed #94A3B8; margin-top: 36px;"></div>
        <span style="font-size: 10px; color: #94A3B8; margin-top: 4px;">التاريخ: ____ / ____ / ________</span>
      </div>`,
    )
    .join('');

  return `
    <div class="document-block" style="margin-top: 30px; page-break-inside: avoid; break-inside: avoid;">
      <h4 style="font-size: 13px; font-weight: 800; color: #0F172A; margin-bottom: 12px; border-right: 3px solid #0284C7; padding-right: 8px;">التوقيعات والاعتماد</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px;">
        ${signaturesHtml}
        <div class="stamp-box" style="${STAMP_BOX_STYLE} margin-right: auto;">
          <span style="font-size: 11px; font-weight: 800; color: #0284C7; display: block;">${escapeDocumentHtml(
            model.footer.companyStampLabel || 'ختم الشركة',
          )}</span>
        </div>
      </div>
    </div>`;
};

const buildAuditFooterBlock = (model: UnifiedDocumentModel): string =>
  [
    `<div class="document-block" style="${FOOTER_AUDIT_STYLE}">`,
    `  <span>${escapeDocumentHtml(model.footer.metadata || model.header.companyName)}</span>`,
    `  <span>وقت الإنشاء: ${escapeDocumentHtml(formatLatinDateTime(new Date(), 'ar-OM', { dateStyle: 'short', timeStyle: 'short' }))}</span>`,
    '</div>',
  ].join('');

/**
 * Flat, page-friendly block sequence for the offscreen PDF path:
 * header → KPI grid → (table title + chunk blocks) → signatures → audit
 * footer. Every block is a direct child, so the paginator can break
 * cleanly between blocks.
 */
export function buildDocumentBodyBlocks(model: UnifiedDocumentModel, options: { withAuditFooter?: boolean } = {}): string[] {
  const blocks: string[] = [buildHeaderBlock(model)];
  const kpiBlock = buildKpiBlock(model);
  if (kpiBlock) blocks.push(kpiBlock);

  for (const table of model.tables) {
    for (const block of chunkTableBlocks(table)) {
      blocks.push(
        `<section class="document-block" style="margin-bottom: 24px;">${block.title ? tableTitleHtml(block.title) : ''}${block.html}</section>`,
      );
    }
  }

  const signatureBlock = buildSignatureBlock(model);
  if (signatureBlock) blocks.push(signatureBlock);

  if (options.withAuditFooter !== false) blocks.push(buildAuditFooterBlock(model));
  return blocks;
}

/** Body-only fragment (no style/link tags) for the offscreen PDF container. */
export function buildDocumentBodyHtml(model: UnifiedDocumentModel, options: { withAuditFooter?: boolean } = {}): string {
  return buildDocumentBodyBlocks(model, options).join('');
}

/**
 * The popup-only stylesheet: page setup + body defaults + table-header
 * repetition. Every document block is already fully inline-styled (see
 * buildHeaderBlock et al.), so nothing here is needed for the offscreen
 * PDF path — print and PDF share one inline-styled layout source.
 */
const PRINT_STYLESHEET = `
@page { size: A4 portrait; margin: 12mm 10mm 15mm 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
body { font-family: "Cairo", "Segoe UI", Tahoma, sans-serif; background: #FFFFFF; color: #0F172A; margin: 0; padding: 20px; line-height: 1.6; font-size: 12px; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
`;

/**
 * The full standalone document for the scoped print popup. Print
 * pagination is delegated to the browser (`thead` repeats on every page);
 * the same flat blocks are used so print and PDF share one layout source.
 */
export function buildPrintableDocumentHtml(model: UnifiedDocumentModel): string {
  return [
    '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>',
    '<title>',
    escapeDocumentHtml(model.header.title),
    ' - ',
    escapeDocumentHtml(model.header.companyName),
    '</title>',
    // Cairo loads over the same font stylesheet the app shell already uses;
    // the print never *requires* it — a system Arabic fallback stack keeps
    // output readable offline (verified by the font-wait timeout path).
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">',
    '<style>',
    PRINT_STYLESHEET,
    '</style>',
    '</head><body>',
    buildDocumentBodyHtml(model, { withAuditFooter: true }),
    '</body></html>',
  ].join('');
}
