/**
 * Print/preview HTML emitter — the ONLY place document markup is built.
 *
 * Two artifacts come out of this module:
 *
 *  - `buildPrintableDocumentHtml`: a complete standalone HTML document for
 *    the scoped print popup (carries the print stylesheet, A4 page setup,
 *    and real browser pagination via `thead { display: table-header-group }`).
 *
 *  - `buildDocumentBodyHtml`: a body-only fragment (no `<style>`/`<link>`
 *    tags — those would leak into the live app DOM) used by in-app preview
 *    surfaces.
 *
 * The PDF peer of this emitter is `renderer/pdf/pdfDocument` (vector, via
 * @react-pdf/renderer). Both emitters consume the same model and the same
 * design tokens; neither is built from the other. Long tables are NOT
 * pre-chunked: the browser repeats `thead` on every printed page natively,
 * and the PDF engine repeats its fixed header rows natively.
 */
import type { SignatureRole, UnifiedDocumentModel } from '../types';
import { formatLatinDate, formatLatinTime } from '@/lib/formatters';

/** Intl bidi embedding marks — stripped so rasterizers keep digit order. */
const BIDI_MARKS = /[‎‏؜‪-‮⁦-⁩]/g;
import { DOCUMENT_COLORS, DOCUMENT_PAGE, DOCUMENT_SPACING, DOCUMENT_TYPE } from '../documentDesignTokens';
import { buildEmptyNoteRow, buildTableFootHtml, buildTableHeadHtml, buildTableRowsHtml } from './documentTableHtml';
import { buildProfessionalDocumentBlocks, collectProfessionalTextChunks } from './professionalDocumentHtml';
import { escapeDocumentHtml } from './documentHtmlShared';

export { escapeDocumentHtml } from './documentHtmlShared';

export const signatureLabel: Record<SignatureRole, string> = {
  owner: 'توقيع المالك',
  tenant: 'توقيع المستأجر',
  accountant: 'توقيع المحاسب',
  general_manager: 'اعتماد المدير العام',
  inspector: 'توقيع الفاحص / المفتش',
  vendor: 'توقيع المقاول / الفني',
};

/**
 * Every user-visible string of the model, in render order. This is the
 * canonical "what text does this document contain" projection — used by
 * tests and by any future text-level tooling.
 */
export const collectDocumentTextChunks = (model: UnifiedDocumentModel): string[] => {
  const signatureTexts = model.footer.signatures.map((role) => signatureLabel[role]);

  const professionalChunks = model.professional ? collectProfessionalTextChunks(model.professional) : [];

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
    ...model.tables.flatMap((t) => [t.title, ...t.columns, ...t.rows.flat(), ...(t.totals ?? []).flat(), t.emptyNote]),
    ...professionalChunks,
    model.footer.companyStampLabel,
    model.footer.metadata,
    ...signatureTexts,
  ].filter((v): v is string => Boolean(v));
};

/** One whole logical table: title + thead (repeats per printed page) +
 * tbody + tfoot. Native print fragmentation handles page breaks; rows
 * never split mid-way (`tr { break-inside: avoid }` in the sheet). */
const buildTableBlock = (table: UnifiedDocumentModel['tables'][number]): string => {
  const bodyRows = table.rows.length === 0 && table.emptyNote
    ? buildEmptyNoteRow(table.emptyNote, table.columns.length)
    : buildTableRowsHtml(table.rows);
  return `
      <table style="width: 100%; border-collapse: collapse; margin-top: 6px;">
        ${buildTableHeadHtml(table.columns, table.rows)}
        <tbody>${bodyRows}</tbody>
        ${buildTableFootHtml(table.totals)}
      </table>`;
};

const tableTitleHtml = (title: string) =>
  `<h3 style="${DOCUMENT_TYPE.sectionTitle}; color: ${DOCUMENT_COLORS.ink}; margin: 0 0 ${DOCUMENT_SPACING.titleGapMm * 0.75}px 0; border-right: 3px solid ${DOCUMENT_COLORS.accent}; padding-right: 8px;">${escapeDocumentHtml(title)}</h3>`;

/**
 * Document blocks are FULLY inline-styled: the offscreen PDF container
 * receives these fragments without any stylesheet, and the print popup's
 * standalone stylesheet only adds page/body rules. No class may carry
 * layout here — otherwise PDF and print would diverge.
 */
const HEADER_CONTAINER_STYLE =
  `display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px double ${DOCUMENT_COLORS.ink}; padding-bottom: 12px; margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid;`;
const COMPANY_BRAND_STYLE = `${DOCUMENT_TYPE.companyBrand}; color: ${DOCUMENT_COLORS.accent}; margin: 0 0 4px 0;`;
const COMPANY_SUB_STYLE = `${DOCUMENT_TYPE.meta.replace('; font-weight: 700', '')}; color: ${DOCUMENT_COLORS.muted}; margin: 2px 0;`;
const DOC_TITLE_BADGE_STYLE =
  `background: ${DOCUMENT_COLORS.ink}; color: ${DOCUMENT_COLORS.tableHeadFg}; ${DOCUMENT_TYPE.docTitle}; padding: 8px 20px; border-radius: 8px; text-align: center; display: inline-block;`;
const DOC_META_STYLE = `${DOCUMENT_TYPE.meta.replace('; font-weight: 700', '')}; color: ${DOCUMENT_COLORS.muted}; margin: 6px 0 0 0; text-align: right;`;
const STAMP_BOX_STYLE =
  `border: 2px dashed ${DOCUMENT_COLORS.accent}; border-radius: 12px; padding: 10px; text-align: center; background: ${DOCUMENT_COLORS.accentSoft}; width: 132px;`;
const FOOTER_AUDIT_STYLE =
  `border-top: 1px solid ${DOCUMENT_COLORS.border}; padding-top: 10px; margin-top: 14px; display: flex; justify-content: space-between; ${DOCUMENT_TYPE.caption}; color: ${DOCUMENT_COLORS.muted}; page-break-inside: avoid; break-inside: avoid;`;

const buildHeaderBlock = (model: UnifiedDocumentModel): string => {
  const logoHtml = model.header.companyLogoUrl
    ? `<img src="${escapeDocumentHtml(model.header.companyLogoUrl)}" alt="${escapeDocumentHtml(model.header.companyName)}" crossorigin="anonymous" style="max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 8px;" />`
    : '';

  const contactLines = [
    model.header.companyAddress ? `<p style="${COMPANY_SUB_STYLE}">${escapeDocumentHtml(model.header.companyAddress)}</p>` : '',
    model.header.companyPhone ? `<p style="${COMPANY_SUB_STYLE}">الهاتف: <span dir="ltr" style="unicode-bidi: isolate;">${escapeDocumentHtml(model.header.companyPhone)}</span></p>` : '',
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
    ? `<div class="document-block" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); gap: 10px; margin-bottom: ${DOCUMENT_SPACING.sectionGapMm}px; background-color: ${DOCUMENT_COLORS.surface}; border: 1px solid ${DOCUMENT_COLORS.border}; border-radius: 12px; padding: 12px; page-break-inside: avoid; break-inside: avoid;">
        ${model.kpis
          .map(
            (kpi) => `
          <div style="background: ${DOCUMENT_COLORS.page}; border: 1px solid ${DOCUMENT_COLORS.border}; border-radius: 8px; padding: 8px 12px;">
            <span style="display: block; ${DOCUMENT_TYPE.meta}; color: ${DOCUMENT_COLORS.muted}; margin-bottom: 2px;">${escapeDocumentHtml(kpi.label)}</span>
            <span style="display: block; ${DOCUMENT_TYPE.kpiValue}; color: ${DOCUMENT_COLORS.ink};">${escapeDocumentHtml(kpi.value)}</span>
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
      <div style="border: 1px solid ${DOCUMENT_COLORS.border}; border-radius: 10px; padding: 10px; background: ${DOCUMENT_COLORS.page}; text-align: center; min-height: 78px; display: flex; flex-direction: column; justify-content: space-between;">
        <span style="${DOCUMENT_TYPE.body}; font-weight: 800; color: ${DOCUMENT_COLORS.ink};">${escapeDocumentHtml(signatureLabel[role])}</span>
        <div style="border-bottom: 1px dashed ${DOCUMENT_COLORS.subtle}; margin-top: 24px;"></div>
        <span style="${DOCUMENT_TYPE.caption}; color: ${DOCUMENT_COLORS.subtle}; margin-top: 4px;">التاريخ: ____ / ____ / ________</span>
      </div>`,
    )
    .join('');

  return `
    <div class="document-block" style="margin-top: 20px; page-break-inside: avoid; break-inside: avoid;">
      <h4 style="font-size: 13px; font-weight: 800; color: ${DOCUMENT_COLORS.ink}; margin-bottom: 8px; border-right: 3px solid ${DOCUMENT_COLORS.accent}; padding-right: 8px;">التوقيعات والاعتماد</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 10px; margin-bottom: 12px;">
        ${signaturesHtml}
        <div class="stamp-box" style="${STAMP_BOX_STYLE} margin-right: auto;">
          <span style="${DOCUMENT_TYPE.meta}; color: ${DOCUMENT_COLORS.accent}; display: block;">${escapeDocumentHtml(
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
    `  <span>وقت الإنشاء: <span dir="ltr" style="unicode-bidi: isolate;">${escapeDocumentHtml(formatLatinDate(new Date(), 'ar-OM', { dateStyle: 'short' }).replace(BIDI_MARKS, ''))}</span> <span dir="ltr" style="unicode-bidi: isolate;">${escapeDocumentHtml(formatLatinTime(new Date(), 'ar-OM', { timeStyle: 'short', hour12: false }).replace(BIDI_MARKS, ''))}</span></span>`,
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

  if (model.professional) {
    // Professional reports compose from their dedicated body (identity strip
    // + atomic keep-together groups) — same header/signature/audit shell as
    // every other document, same block pagination contract.
    blocks.push(...buildProfessionalDocumentBlocks(model.professional));
  } else {
    const kpiBlock = buildKpiBlock(model);
    if (kpiBlock) blocks.push(kpiBlock);

    for (const table of model.tables) {
      blocks.push(
        `<section class="document-block" style="margin-bottom: ${DOCUMENT_SPACING.sectionGapMm}px;">${table.title ? tableTitleHtml(table.title) : ''}${buildTableBlock(table)}</section>`,
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
 * The popup-only stylesheet: page setup + body defaults + pagination
 * semantics. Every document block is already fully inline-styled (see
 * buildHeaderBlock et al.), so nothing here is needed for the offscreen
 * PDF path — print and PDF share one inline-styled layout source.
 *
 * Page geometry mirrors `DOCUMENT_PAGE` exactly: the browser paginates the
 * same printable area the PDF paginator fills, so print and PDF page
 * counts match instead of drifting.
 */
/** Self-hosted Tajawal faces — the same TTFs the vector PDF emitter embeds. */
const TAJAWAL_FONT_FACES = [400, 700, 900]
  .map(
    (weight) => `@font-face { font-family: 'Tajawal'; font-weight: ${weight}; font-style: normal; font-display: swap; src: url('/fonts/Tajawal-${weight}.ttf') format('truetype'); }`,
  )
  .join('\n');

const PRINT_STYLESHEET = `
@page { size: A4 portrait; margin: ${DOCUMENT_PAGE.marginsMm.top}mm ${DOCUMENT_PAGE.marginsMm.right}mm ${DOCUMENT_PAGE.marginsMm.bottom}mm ${DOCUMENT_PAGE.marginsMm.left}mm; }
/* Progressive enhancement: engines that implement @page margin boxes
   (Gecko) print the same page-number format the PDF pipeline renders;
   engines that don't (Blink/WebKit) ignore the rule harmlessly. */
@page { @bottom-center { content: "صفحة " counter(page) " من " counter(pages); font-size: 9px; color: ${DOCUMENT_COLORS.muted}; } }
* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
html, body { margin: 0; padding: 0; background: ${DOCUMENT_COLORS.page}; }
body { font-family: ${DOCUMENT_TYPE.fontFamily}; color: ${DOCUMENT_COLORS.ink}; line-height: ${DOCUMENT_TYPE.lineHeight}; ${DOCUMENT_TYPE.body}; }
/* Print fragmentation semantics:
   - table headers repeat on every page, totals stay attached;
   - rows never split mid-way;
   - headings never orphan from the content they introduce. */
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
tr { page-break-inside: avoid; break-inside: avoid; }
h1, h2, h3, h4 { page-break-after: avoid; break-after: avoid; }
table { border-collapse: collapse; }
img { max-width: 100%; }
`;

/**
 * The full standalone document for the scoped print popup. Print
 * pagination is delegated to the browser (`thead` repeats on every page);
 * the same flat blocks are used so print and PDF share one layout source.
 * The document language of the engine is Arabic-first (labels, signature
 * roles, metadata captions), so the sheet is RTL regardless of the party
 * names it carries — Latin identifiers stay readable inside it via the
 * numeric/text alignment rules of the shared table primitives.
 */
export function buildPrintableDocumentHtml(model: UnifiedDocumentModel): string {
  return [
    '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>',
    '<title>',
    escapeDocumentHtml(model.header.title),
    ' - ',
    escapeDocumentHtml(model.header.companyName),
    '</title>',
    // Tajawal is SELF-HOSTED (same TTFs the vector PDF emitter embeds), so
    // print and PDF share one typographic identity and work offline; a
    // system Arabic fallback stack keeps output readable if fonts stall
    // (verified by the font-wait timeout path).
    '<style>',
    TAJAWAL_FONT_FACES,
    '</style>',
    '<style>',
    PRINT_STYLESHEET,
    '</style>',
    '</head><body>',
    buildDocumentBodyHtml(model, { withAuditFooter: true }),
    '</body></html>',
  ].join('');
}
