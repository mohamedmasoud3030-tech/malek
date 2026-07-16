import { jsPDF } from 'jspdf';
// @ts-ignore
import html2canvas from 'html2canvas';
import type { SignatureRole, UnifiedDocumentModel } from './types';

const ARABIC_REGEX = /[\u0600-\u06FF]/;
const DEFAULT_SIGNATURE_LABELS = new Set(['توقيع المالك', 'توقيع المستأجر', 'توقيع المحاسب', 'توقيع المدير العام']);

const signatureLabel: Record<SignatureRole, string> = {
  owner: 'توقيع المالك',
  tenant: 'توقيع المستأجر',
  accountant: 'توقيع المحاسب',
  general_manager: 'اعتماد المدير العام',
};

const PAGE_MARGIN_X = 14;
const PAGE_MARGIN_Y = 16;
const LINE_HEIGHT = 7;

const newDoc = (): jsPDF => new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

const ensurePage = (doc: jsPDF, y: number, needed = 10): number =>
  y + needed < 285 ? y : (doc.addPage(), PAGE_MARGIN_Y);

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

const modelHasArabicText = (model: UnifiedDocumentModel): boolean =>
  collectDocumentTextChunks(model).some((x) => ARABIC_REGEX.test(x));

const buildHtmlRows = (rows: string[][]) =>
  rows
    .map(
      (r) =>
        `<tr style="page-break-inside: avoid;">${r
          .map(
            (c, i) =>
              `<td style="border: 1px solid #CBD5E1; padding: 8px 10px; font-size: 13px; color: #1E293B; ${
                i === r.length - 1 ? 'font-weight: 700; text-align: left;' : ''
              }">${escapeDocumentHtml(c)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

const buildHtmlTable = (table: UnifiedDocumentModel['tables'][number]) => {
  const tableHead = table.columns
    .map(
      (column, i) =>
        `<th style="background-color: #0F172A; color: #FFFFFF; font-weight: 700; font-size: 13px; padding: 10px; border: 1px solid #0F172A; text-align: ${
          i === table.columns.length - 1 ? 'left' : 'right'
        };">${escapeDocumentHtml(column)}</th>`,
    )
    .join('');

  const tableFoot = table.totals?.length
    ? `<tfoot><tr style="background-color: #F8FAFC; font-weight: 800;">${table.totals
        .map(
          (total, i) =>
            `<th style="border: 1px solid #CBD5E1; padding: 10px; font-size: 14px; color: #0284C7; text-align: ${
              i === table.totals!.length - 1 ? 'left' : 'right'
            };">${escapeDocumentHtml(total)}</th>`,
        )
        .join('')}</tr></tfoot>`
    : '';

  return `
    <section style="margin-bottom: 24px; page-break-inside: avoid;">
      ${
        table.title
          ? `<h3 style="font-size: 15px; font-weight: 800; color: #0F172A; margin: 0 0 10px 0; border-bottom: 2px solid #0284C7; padding-bottom: 4px; display: inline-block;">${escapeDocumentHtml(
              table.title,
            )}</h3>`
          : ''
      }
      <table style="width: 100%; border-collapse: collapse; margin-top: 6px;">
        <thead><tr>${tableHead}</tr></thead>
        <tbody>${buildHtmlRows(table.rows)}</tbody>
        ${tableFoot}
      </table>
    </section>
  `;
};

const buildRtlPrintHtml = (model: UnifiedDocumentModel) => {
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
      <div style="border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; background: #FFFFFF; text-align: center; min-height: 90px; display: flex; flex-direction: column; justify-content: space-between;">
        <span style="font-size: 12px; font-weight: 800; color: #0F172A;">${signatureLabel[role]}</span>
        <div style="border-bottom: 1px dashed #94A3B8; margin-top: 36px;"></div>
        <span style="font-size: 10px; color: #94A3B8; margin-top: 4px;">التاريخ: ____ / ____ / ________</span>
      </div>
    `,
    )
    .join('');

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
    '.doc-meta { font-size: 11px; color: #475569; margin-top: 6px; text-align: left; }',
    '.stamp-box { border: 2px dashed #0284C7; border-radius: 12px; padding: 12px; text-align: center; background: #F0F9FF; width: 140px; }',
    '.footer-audit { border-top: 1px solid #E2E8F0; padding-top: 12px; margin-top: 30px; display: flex; justify-content: space-between; font-size: 10px; color: #64748B; }',
    '</style>',
    '</head><body>',
    '<div class="header-container">',
    '  <div>',
    `    <h1 class="company-brand">${escapeDocumentHtml(model.header.companyName)}</h1>`,
    model.header.companyAddress
      ? `    <p class="company-sub">${escapeDocumentHtml(model.header.companyAddress)}</p>`
      : '',
    model.header.companyPhone
      ? `    <p class="company-sub">الهاتف: ${escapeDocumentHtml(model.header.companyPhone)}</p>`
      : '',
    '  </div>',
    '  <div style="text-align: left;">',
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
        <h4 style="font-size: 13px; font-weight: 800; color: #0F172A; margin-bottom: 12px; border-right: 3px solid #0284C7; padding-right: 8px;">التوقيعات والاعتماد الرسمي</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px;">
          ${signaturesHtml}
          <div class="stamp-box" style="margin-right: auto;">
            <span style="font-size: 11px; font-weight: 800; color: #0284C7; display: block;">${escapeDocumentHtml(
              model.footer.companyStampLabel || 'ختم الشركة المعتمد',
            )}</span>
            <span style="font-size: 9px; color: #94A3B8; margin-top: 24px; display: block;">مستند رسمي معتمد آلياً</span>
          </div>
        </div>
      </div>
    `
      : '',
    '<div class="footer-audit">',
    `  <span>${escapeDocumentHtml(model.footer.metadata || `${model.header.companyName} - نظام رينتريكس لإدارة العقارات`)}</span>`,
    `  <span>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-OM')}</span>`,
    '</div>',
    '</body></html>',
  ].join('');
};

const openPrintWindowSafely = (): Window => {
  if (typeof globalThis.open !== 'function') {
    return {
      document: {
        open: () => {},
        write: () => {},
        close: () => {},
        readyState: 'complete',
      },
      focus: () => {},
      print: () => {},
      addEventListener: () => {},
      URL: {
        revokeObjectURL: () => {},
      },
    } as unknown as Window;
  }
  const popup = globalThis.open('', '_blank', 'width=1024,height=768');
  if (!popup)
    throw new Error('تعذر فتح نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة ثم إعادة المحاولة.');
  return popup;
};

const renderRtlPrintPreview = (model: UnifiedDocumentModel): void => {
  const w = openPrintWindowSafely();
  const htmlContent = buildRtlPrintHtml(model);
  const htmlBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const objectUrl = URL.createObjectURL(htmlBlob);

  w.document.open();
  w.document.write(htmlContent);
  w.document.close();

  const triggerPrint = () => {
    setTimeout(() => {
      w.focus();
      w.print();
      URL.revokeObjectURL(objectUrl);
    }, 250);
  };

  if (w.document.readyState === 'complete') {
    triggerPrint();
  } else {
    w.addEventListener('load', triggerPrint, { once: true });
  }
};

const renderPdfHeader = (doc: jsPDF, model: UnifiedDocumentModel, y: number): number => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(model.header.companyName || 'Rentrix', PAGE_MARGIN_X, y);
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

const renderPdfKpis = (doc: jsPDF, model: UnifiedDocumentModel, y: number): number => {
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

const renderPdfTables = (doc: jsPDF, model: UnifiedDocumentModel, y: number): number => {
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

const renderPdfFooter = (doc: jsPDF, model: UnifiedDocumentModel, y: number): number => {
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

export const DocumentRenderer = {
  renderToPDF(model: UnifiedDocumentModel): void {
    if (modelHasArabicText(model)) {
      renderRtlPrintPreview(model);
      return;
    }

    const doc = newDoc();
    let y = PAGE_MARGIN_Y;
    y = renderPdfHeader(doc, model, y);
    y = renderPdfKpis(doc, model, y);
    y = renderPdfTables(doc, model, y);
    renderPdfFooter(doc, model, y);
    doc.save(`${model.fileName}.pdf`);
  },

  printDocument(model: UnifiedDocumentModel): void {
    if (modelHasArabicText(model)) {
      renderRtlPrintPreview(model);
    } else {
      const doc = newDoc();
      let y = PAGE_MARGIN_Y;
      y = renderPdfHeader(doc, model, y);
      y = renderPdfKpis(doc, model, y);
      y = renderPdfTables(doc, model, y);
      renderPdfFooter(doc, model, y);
      doc.save(`${model.fileName}.pdf`);
    }
  },

  async downloadDocumentPdf(model: UnifiedDocumentModel): Promise<void> {
    if (modelHasArabicText(model)) {
      // Direct high-fidelity PDF render using jsPDF html and html2canvas
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '794px'; // standard A4 page width at 96 dpi
      container.style.direction = 'rtl';
      container.style.fontFamily = '"Cairo", "Segoe UI", Tahoma, sans-serif';
      container.style.background = '#FFFFFF';
      container.innerHTML = buildRtlPrintHtml(model);
      document.body.appendChild(container);

      // Wait for fonts and images to be fully loaded
      if (typeof document !== 'undefined' && document.fonts) {
        await document.fonts.ready;
      }

      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      await new Promise<void>((resolve, reject) => {
      doc.html(container, {
        html2canvas: html2canvas,
        callback: function (pdfDoc: any) {
          try {
            pdfDoc.save(`${model.fileName}.pdf`);
            document.body.removeChild(container);
            resolve();
          } catch (err) {
            if (container.parentNode) {
              document.body.removeChild(container);
            }
            reject(err);
          }
        },
        x: 0,
        y: 0,
        width: 210, // Full A4 width in mm
        windowWidth: 794,
      } as any);
      });
    } else {
      const doc = newDoc();
      let y = PAGE_MARGIN_Y;
      y = renderPdfHeader(doc, model, y);
      y = renderPdfKpis(doc, model, y);
      y = renderPdfTables(doc, model, y);
      renderPdfFooter(doc, model, y);
      doc.save(`${model.fileName}.pdf`);
    }
  }
};
