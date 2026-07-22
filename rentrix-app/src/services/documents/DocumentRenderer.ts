import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import type { SignatureRole, UnifiedDocumentModel } from './types';

const ARABIC_REGEX = /[\u0600-\u06FF]/;
const DEFAULT_SIGNATURE_LABELS = new Set(['توقيع المالك', 'توقيع المستأجر', 'توقيع المحاسب', 'توقيع المدير العام']);

const signatureLabel: Record<SignatureRole, string> = {
  owner: 'توقيع المالك',
  tenant: 'توقيع المستأجر',
  accountant: 'توقيع المحاسب',
  general_manager: 'اعتماد المدير العام',
};

/**
 * Rows per rendered table "page fragment" before the table header repeats
 * on a fresh page. This is intentionally conservative — most Rentrix
 * documents have short tables that fit on one page, and this only matters
 * for long statements (owner/tenant statements, trial balance, etc.).
 */
const ROWS_PER_TABLE_PAGE = 22;

/**
 * Errors the print/PDF engine can raise. Callers (page components) should
 * catch these and show `error.message` directly — every message here is
 * already a complete, user-facing Arabic sentence.
 */
export class DocumentRenderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DocumentRenderError';
  }
}

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
    ...model.tables.flatMap((t) => [t.title, ...t.columns, ...t.rows.flat(), ...(t.totals ?? [])]),
    model.footer.companyStampLabel,
    model.footer.metadata,
    ...signatureTexts,
  ].filter((v): v is string => Boolean(v));
};

export const modelHasArabicText = (model: UnifiedDocumentModel): boolean =>
  collectDocumentTextChunks(model).some((x) => ARABIC_REGEX.test(x));

/**
 * A column is treated as numeric (amounts/counts/balances) — right-to-left
 * text alignment does not apply to figures, so these are aligned left and
 * bolded — only when its cell values actually look numeric. Plain-text
 * columns (e.g. "تفاصيل الخدمات") must stay right-aligned like every other
 * text column, even when they happen to be the last column.
 */
const NUMERIC_CELL_REGEX = /^[\s\-+]*[\d,.]+(?:\s?(?:ر\.?ع\.?|OMR|SAR|AED|USD|%))?\s*$/;

const isNumericColumn = (rows: string[][], columnIndex: number): boolean => {
  const values = rows.map((r) => r[columnIndex]).filter((v): v is string => Boolean(v && v.trim()));
  if (values.length === 0) return false;
  return values.every((v) => NUMERIC_CELL_REGEX.test(v.trim()));
};

const buildHtmlRows = (rows: string[][]) =>
  rows
    .map(
      (r) =>
        `<tr style="page-break-inside: avoid; break-inside: avoid;">${r
          .map(
            (c, i) =>
              `<td style="border: 1px solid #CBD5E1; padding: 8px 10px; font-size: 13px; color: #1E293B; ${
                isNumericColumn(rows, i) ? 'font-weight: 700; text-align: left;' : 'text-align: right;'
              }">${escapeDocumentHtml(c)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

const buildHtmlTableHead = (columns: string[], rows: string[][]) =>
  `<thead><tr>${columns
    .map(
      (column, i) =>
        `<th style="background-color: #0F172A; color: #FFFFFF; font-weight: 700; font-size: 13px; padding: 10px; border: 1px solid #0F172A; text-align: ${
          isNumericColumn(rows, i) ? 'left' : 'right'
        };">${escapeDocumentHtml(column)}</th>`,
    )
    .join('')}</tr></thead>`;

const buildHtmlTableFoot = (totals: string[] | undefined) =>
  totals?.length
    ? `<tfoot><tr style="background-color: #F8FAFC; font-weight: 800;">${totals
        .map(
          (total, i) =>
            // The totals row legitimately ends in the grand-total figure, so
            // its last cell is always the numeric one regardless of what the
            // corresponding body column contained.
            `<th style="border: 1px solid #CBD5E1; padding: 10px; font-size: 14px; color: #0284C7; text-align: ${
              i === totals.length - 1 ? 'left' : 'right'
            };">${escapeDocumentHtml(total)}</th>`,
        )
        .join('')}</tr></tfoot>`
    : '';

/**
 * Renders one table. `repeatHeaderEveryRows` splits long tables into
 * page-sized chunks, each with its own `<thead>`, so a table that spans
 * multiple physical pages still shows its column header at the top of
 * every page instead of only the first.
 */
const buildHtmlTable = (table: UnifiedDocumentModel['tables'][number]) => {
  const chunks: string[][][] = [];
  for (let i = 0; i < table.rows.length; i += ROWS_PER_TABLE_PAGE) {
    chunks.push(table.rows.slice(i, i + ROWS_PER_TABLE_PAGE));
  }
  if (chunks.length === 0) chunks.push([]);

  const chunkHtml = chunks
    .map((chunkRows, chunkIndex) => {
      const isLastChunk = chunkIndex === chunks.length - 1;
      return `
      <table style="width: 100%; border-collapse: collapse; margin-top: 6px; ${chunkIndex > 0 ? 'page-break-before: always; break-before: page;' : ''}">
        ${buildHtmlTableHead(table.columns, table.rows)}
        <tbody>${buildHtmlRows(chunkRows)}</tbody>
        ${isLastChunk ? buildHtmlTableFoot(table.totals) : ''}
      </table>
    `;
    })
    .join('');

  return `
    <section style="margin-bottom: 24px;">
      ${
        table.title
          ? `<h3 style="font-size: 15px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0; border-bottom: 2px solid #0284C7; padding-bottom: 4px; display: inline-block;">${escapeDocumentHtml(
              table.title,
            )}</h3>`
          : ''
      }
      ${chunkHtml}
    </section>
  `;
};

const buildRtlPrintHtml = (model: UnifiedDocumentModel, options: { withPageFooter: boolean } = { withPageFooter: true }) => {
  const kpiGridHtml = model.kpis.length
    ? `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px;">
        ${model.kpis
          .map(
            (k) => `
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px;">
            <span style="display: block; font-size: 11px; font-weight: 700; color: #64748B; margin-bottom: 2px;">${escapeDocumentHtml(
              k.label,
            )}</span>
            <span style="display: block; font-size: 14px; font-weight: 800; color: #0F172A;">${escapeDocumentHtml(
              k.value,
            )}</span>
          </div>
        `,
          )
          .join('')}
      </div>`
    : '';

  const signaturesHtml = model.footer.signatures
    .map(
      (role) => `
      <div style="border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; background: #FFFFFF; text-align: center; min-height: 90px; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; break-inside: avoid;">
        <span style="font-size: 12px; font-weight: 800; color: #0F172A;">${signatureLabel[role]}</span>
        <div style="border-bottom: 1px dashed #94A3B8; margin-top: 36px;"></div>
        <span style="font-size: 10px; color: #94A3B8; margin-top: 4px;">التاريخ: ____ / ____ / ________</span>
      </div>
    `,
    )
    .join('');

  const logoHtml = model.header.companyLogoUrl
    ? `<img src="${escapeDocumentHtml(model.header.companyLogoUrl)}" alt="${escapeDocumentHtml(model.header.companyName)}" crossorigin="anonymous" style="max-height: 48px; max-width: 160px; object-fit: contain; margin-bottom: 8px;" />`
    : '';

  const contactLines = [
    model.header.companyAddress ? `<p class="company-sub">${escapeDocumentHtml(model.header.companyAddress)}</p>` : '',
    model.header.companyPhone ? `<p class="company-sub">الهاتف: ${escapeDocumentHtml(model.header.companyPhone)}</p>` : '',
    model.header.companyEmail ? `<p class="company-sub">البريد الإلكتروني: ${escapeDocumentHtml(model.header.companyEmail)}</p>` : '',
    model.header.companyRegistrationNumber ? `<p class="company-sub">السجل التجاري: ${escapeDocumentHtml(model.header.companyRegistrationNumber)}</p>` : '',
    model.header.companyTaxNumber ? `<p class="company-sub">الرقم الضريبي: ${escapeDocumentHtml(model.header.companyTaxNumber)}</p>` : '',
  ].join('');

  return [
    '<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>',
    '<title>',
    escapeDocumentHtml(model.header.title),
    ' - ',
    escapeDocumentHtml(model.header.companyName),
    '</title>',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">',
    '<style>',
    '@page { size: A4 portrait; margin: 12mm 10mm 15mm 10mm; }',
    '* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }',
    'body { font-family: "Cairo", "Segoe UI", Tahoma, sans-serif; background: #FFFFFF; color: #0F172A; margin: 0; padding: 20px; line-height: 1.6; font-size: 12px; }',
    '.header-container { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px double #0F172A; padding-bottom: 16px; margin-bottom: 20px; }',
    '.company-brand { font-size: 20px; font-weight: 900; color: #0284C7; letter-spacing: -0.5px; margin: 0 0 4px 0; }',
    '.company-sub { font-size: 11px; color: #475569; margin: 2px 0; }',
    '.doc-title-badge { background: #0F172A; color: #FFFFFF; font-size: 18px; font-weight: 800; padding: 8px 20px; border-radius: 8px; text-align: center; display: inline-block; }',
    '.doc-meta { font-size: 11px; color: #475569; margin-top: 6px; text-align: right; }',
    '.stamp-box { border: 2px dashed #0284C7; border-radius: 12px; padding: 12px; text-align: center; background: #F0F9FF; width: 140px; }',
    '.footer-audit { border-top: 1px solid #E2E8F0; padding-top: 12px; margin-top: 30px; display: flex; justify-content: space-between; font-size: 10px; color: #64748B; }',
    'table { page-break-inside: auto; }',
    'tr { page-break-inside: avoid; break-inside: avoid; }',
    'thead { display: table-header-group; }',
    'tfoot { display: table-footer-group; }',
    '</style>',
    '</head><body>',
    '<div class="header-container">',
    '  <div>',
    logoHtml,
    `    <h1 class="company-brand">${escapeDocumentHtml(model.header.companyName)}</h1>`,
    contactLines,
    '  </div>',
    '  <div style="text-align: right;">',
    `    <div class="doc-title-badge">${escapeDocumentHtml(model.header.title)}</div>`,
    model.header.documentNo
      ? `    <p class="doc-meta">رقم المستند: <strong>${escapeDocumentHtml(model.header.documentNo)}</strong></p>`
      : '',
    model.header.dateLabel && model.header.dateValue
      ? `    <p class="doc-meta">${escapeDocumentHtml(model.header.dateLabel)}: <strong>${escapeDocumentHtml(
          model.header.dateValue,
        )}</strong></p>`
      : '',
    '  </div>',
    '</div>',
    kpiGridHtml,
    model.tables.map(buildHtmlTable).join(''),
    model.footer.signatures.length
      ? `
      <div style="margin-top: 30px; page-break-inside: avoid;">
        <h4 style="font-size: 13px; font-weight: 800; color: #0F172A; margin-bottom: 12px; border-right: 3px solid #0284C7; padding-right: 8px;">التوقيعات والاعتماد</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px;">
          ${signaturesHtml}
          <div class="stamp-box" style="margin-right: auto;">
            <span style="font-size: 11px; font-weight: 800; color: #0284C7; display: block;">${escapeDocumentHtml(
              model.footer.companyStampLabel || 'ختم الشركة',
            )}</span>
          </div>
        </div>
      </div>
    `
      : '',
    options.withPageFooter
      ? [
          '<div class="footer-audit">',
          `  <span>${escapeDocumentHtml(model.footer.metadata || model.header.companyName)}</span>`,
          `  <span>وقت الإنشاء: ${new Date().toLocaleString('ar-OM', { dateStyle: 'short', timeStyle: 'short' })}</span>`,
          '</div>',
        ].join('')
      : '',
    '</body></html>',
  ].join('');
};

const POPUP_BLOCKED_MESSAGE = 'تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة لهذا الموقع ثم إعادة المحاولة.';
const FONT_LOAD_FAILED_MESSAGE = 'تعذر تحميل الخط العربي المطلوب للطباعة. يرجى إعادة المحاولة أو التحقق من الاتصال بالإنترنت.';
const PDF_GENERATION_FAILED_MESSAGE = 'تعذر إنشاء ملف PDF لهذا المستند. يرجى إعادة المحاولة، وإذا استمرت المشكلة يرجى التواصل مع الدعم الفني.';

/** Waits for web fonts to finish loading, tolerating environments without the Font Loading API. */
async function waitForFontsReady(): Promise<void> {
  try {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    if (fonts) {
      await fonts.ready;
    }
  } catch (error) {
    throw new DocumentRenderError(FONT_LOAD_FAILED_MESSAGE, error);
  }
}

/** Waits for every `<img>` inside a container to finish loading (or fail) before capture. */
async function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          // A broken logo/image must not block the whole document — resolve
          // instead of rejecting so the document still renders without it.
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  );
}

function createOffscreenContainer(html: string): HTMLDivElement {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 width at 96dpi
  container.style.direction = 'rtl';
  container.style.background = '#FFFFFF';
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

/**
 * Splits an offscreen-rendered document container into A4-height page
 * sections by walking its top-level children and accumulating height, so
 * each PDF page break falls between elements (never mid-row — every row and
 * signature block already carries `page-break-inside: avoid` in its own
 * layout, and chunks here operate on whole `<table>`/`<section>` nodes).
 */
function paginateContainer(container: HTMLElement, pageHeightPx: number): HTMLElement[] {
  const pages: HTMLElement[] = [];
  let currentPage = document.createElement('div');
  currentPage.style.width = `${container.clientWidth}px`;
  let currentHeight = 0;

  const children = Array.from(container.children) as HTMLElement[];
  for (const child of children) {
    const childHeight = child.getBoundingClientRect().height;
    if (currentHeight > 0 && currentHeight + childHeight > pageHeightPx) {
      pages.push(currentPage);
      currentPage = document.createElement('div');
      currentPage.style.width = `${container.clientWidth}px`;
      currentHeight = 0;
    }
    currentPage.appendChild(child.cloneNode(true));
    currentHeight += childHeight;
  }
  if (currentPage.childNodes.length > 0) pages.push(currentPage);
  return pages.length > 0 ? pages : [container.cloneNode(true) as HTMLElement];
}

const openPrintWindowSafely = (): Window => {
  const popup = globalThis.open('', '_blank', 'width=1024,height=768');
  if (!popup) throw new DocumentRenderError(POPUP_BLOCKED_MESSAGE);
  return popup;
};

/**
 * Opens the document as an RTL A4 print preview and immediately invokes the
 * browser print dialog for that document only — never the whole app screen.
 * This is the *print* path; it never produces a downloadable file.
 */
async function printRtlDocument(model: UnifiedDocumentModel): Promise<void> {
  await waitForFontsReady();

  const popup = openPrintWindowSafely();
  const htmlContent = buildRtlPrintHtml(model);

  popup.document.open();
  popup.document.write(htmlContent);
  popup.document.close();

  await new Promise<void>((resolve) => {
    const triggerPrint = () => {
      setTimeout(() => {
        popup.focus();
        popup.print();
        resolve();
      }, 250);
    };

    popup.addEventListener('afterprint', () => {
      popup.close();
    });

    if (popup.document.readyState === 'complete') {
      triggerPrint();
    } else {
      popup.addEventListener('load', triggerPrint, { once: true });
    }
  });
}

/**
 * Renders the document to a real `application/pdf` file and triggers a
 * download — never opens the browser print dialog. Arabic text is captured
 * from real, browser-shaped HTML (via html2canvas) so ligatures and RTL
 * ordering render correctly, which raw jsPDF text placement with a Latin
 * font (Helvetica) cannot do.
 */
async function downloadRtlDocumentPdf(model: UnifiedDocumentModel): Promise<void> {
  await waitForFontsReady();

  const html = buildRtlPrintHtml(model, { withPageFooter: false });
  const container = createOffscreenContainer(html);

  try {
    await waitForImages(container);
    // Let the browser finish layout after fonts/images settle.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const pxPerMm = container.clientWidth / 210; // A4 width = 210mm
    const pageHeightPx = Math.floor(297 * pxPerMm) - Math.floor(27 * pxPerMm); // A4 height minus vertical margins

    const pageElements = paginateContainer(container, pageHeightPx);

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidthMm = 210;

    for (let i = 0; i < pageElements.length; i += 1) {
      const pageContainer = createOffscreenContainer('');
      pageContainer.innerHTML = '';
      pageContainer.appendChild(pageElements[i]);

      let canvas: HTMLCanvasElement;
      try {
        canvas = await html2canvas(pageContainer, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#FFFFFF',
          logging: false,
        });
      } finally {
        pageContainer.remove();
      }

      const imgData = canvas.toDataURL('image/png');
      const imgHeightMm = (canvas.height * pageWidthMm) / canvas.width;

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidthMm, imgHeightMm);

      const pageLabel = `صفحة ${i + 1} من ${pageElements.length}`;
      pdf.setFontSize(8);
      pdf.setTextColor(120, 120, 120);
      pdf.text(pageLabel, pageWidthMm - 20, 290, { align: 'right' });
    }

    pdf.save(`${model.fileName}.pdf`);
  } catch (error) {
    throw new DocumentRenderError(PDF_GENERATION_FAILED_MESSAGE, error);
  } finally {
    container.remove();
  }
}

/** Fallback path for non-Arabic (Latin-only) models: native jsPDF text, no image capture needed. */
const PAGE_MARGIN_X = 14;
const PAGE_MARGIN_Y = 16;
const LINE_HEIGHT = 7;

const newLatinDoc = (): jsPDF => new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

const ensurePage = (doc: jsPDF, y: number, needed = 10): number =>
  y + needed < 285 ? y : (doc.addPage(), PAGE_MARGIN_Y);

const renderLatinPdfHeader = (doc: jsPDF, model: UnifiedDocumentModel, y: number): number => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(model.header.companyName, PAGE_MARGIN_X, y);
  y += LINE_HEIGHT;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  [model.header.companyAddress, model.header.companyPhone].forEach((line) => {
    if (line) {
      doc.text(line, PAGE_MARGIN_X, y);
      y += LINE_HEIGHT;
    }
  });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(model.header.title, PAGE_MARGIN_X, y);
  y += LINE_HEIGHT;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (model.header.documentNo) {
    doc.text(`No: ${model.header.documentNo}`, PAGE_MARGIN_X, y);
    y += LINE_HEIGHT;
  }
  if (model.header.dateLabel && model.header.dateValue) {
    doc.text(`${model.header.dateLabel}: ${model.header.dateValue}`, PAGE_MARGIN_X, y);
    y += LINE_HEIGHT;
  }
  return y + 2;
};

const renderLatinPdfKpis = (doc: jsPDF, model: UnifiedDocumentModel, y: number): number => {
  model.kpis.forEach((k) => {
    y = ensurePage(doc, y, LINE_HEIGHT);
    doc.setFont('helvetica', 'bold');
    doc.text(`${k.label}:`, PAGE_MARGIN_X, y);
    doc.setFont('helvetica', 'normal');
    doc.text(k.value, PAGE_MARGIN_X + 55, y);
    y += LINE_HEIGHT;
  });
  return y + 2;
};

const renderLatinPdfTables = (doc: jsPDF, model: UnifiedDocumentModel, y: number): number => {
  model.tables.forEach((t) => {
    y = ensurePage(doc, y, 20);
    if (t.title) {
      doc.setFont('helvetica', 'bold');
      doc.text(t.title, PAGE_MARGIN_X, y);
      y += LINE_HEIGHT;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(t.columns.join(' | '), PAGE_MARGIN_X, y);
    y += LINE_HEIGHT;
    doc.setFont('helvetica', 'normal');
    t.rows.forEach((r) => {
      y = ensurePage(doc, y, LINE_HEIGHT);
      doc.text(r.join(' | '), PAGE_MARGIN_X, y);
      y += LINE_HEIGHT;
    });
    if (t.totals?.length) {
      y = ensurePage(doc, y, LINE_HEIGHT);
      doc.setFont('helvetica', 'bold');
      doc.text(t.totals.join(' | '), PAGE_MARGIN_X, y);
      y += LINE_HEIGHT;
    }
    y += 2;
  });
  return y;
};

const renderLatinPdfFooter = (doc: jsPDF, model: UnifiedDocumentModel, y: number): number => {
  y = ensurePage(doc, y, 24);
  doc.setFont('helvetica', 'bold');
  doc.text('Signatures', PAGE_MARGIN_X, y);
  y += LINE_HEIGHT;
  model.footer.signatures.forEach((r) => {
    y = ensurePage(doc, y, LINE_HEIGHT);
    doc.setFont('helvetica', 'normal');
    doc.text(`${signatureLabel[r]}: ____________________`, PAGE_MARGIN_X, y);
    y += LINE_HEIGHT;
  });
  [model.footer.companyStampLabel, model.footer.metadata].forEach((line) => {
    if (line) {
      y = ensurePage(doc, y, LINE_HEIGHT);
      doc.text(line, PAGE_MARGIN_X, y);
      y += LINE_HEIGHT;
    }
  });
  return y;
};

function buildLatinPdf(model: UnifiedDocumentModel): jsPDF {
  const doc = newLatinDoc();
  let y = PAGE_MARGIN_Y;
  y = renderLatinPdfHeader(doc, model, y);
  y = renderLatinPdfKpis(doc, model, y);
  y = renderLatinPdfTables(doc, model, y);
  renderLatinPdfFooter(doc, model, y);
  return doc;
}

export const DocumentRenderer = {
  /** Opens a scoped A4 print preview of this document and triggers the print dialog. Never a full-page print. */
  async printDocument(model: UnifiedDocumentModel): Promise<void> {
    if (modelHasArabicText(model)) {
      await printRtlDocument(model);
      return;
    }
    try {
      const doc = buildLatinPdf(model);
      doc.autoPrint();
      const blobUrl = doc.output('bloburl');
      const popup = openPrintWindowSafely();
      popup.location.href = String(blobUrl);
    } catch (error) {
      if (error instanceof DocumentRenderError) throw error;
      throw new DocumentRenderError(PDF_GENERATION_FAILED_MESSAGE, error);
    }
  },

  /** Downloads a real application/pdf file for this document. Never opens window.print. */
  async downloadDocumentPdf(model: UnifiedDocumentModel): Promise<void> {
    if (modelHasArabicText(model)) {
      await downloadRtlDocumentPdf(model);
      return;
    }
    try {
      buildLatinPdf(model).save(`${model.fileName}.pdf`);
    } catch (error) {
      throw new DocumentRenderError(PDF_GENERATION_FAILED_MESSAGE, error);
    }
  },
};
