/**
 * Latin-only fallback path: models with no Arabic text anywhere render as
 * native jsPDF text (no image capture needed). Arabic text must NEVER go
 * through this path — jsPDF core fonts cannot shape Arabic — which is why
 * `modelHasArabicText` gates every call site. Signature labels are chrome:
 * this path renders LATIN labels so no Arabic glyph ever reaches a core
 * jsPDF font.
 */
import { jsPDF } from 'jspdf';
import type { SignatureRole, UnifiedDocumentModel } from '../types';

/** Latin chrome for the core-font path (Arabic labels are glyph-unsafe here). */
const LATIN_SIGNATURE_LABEL: Record<SignatureRole, string> = {
  owner: 'Owner',
  tenant: 'Tenant',
  accountant: 'Accountant',
  general_manager: 'General Manager',
};

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
  model.kpis.forEach((kpi) => {
    y = ensurePage(doc, y, LINE_HEIGHT);
    doc.setFont('helvetica', 'bold');
    doc.text(`${kpi.label}:`, PAGE_MARGIN_X, y);
    doc.setFont('helvetica', 'normal');
    doc.text(kpi.value, PAGE_MARGIN_X + 55, y);
    y += LINE_HEIGHT;
  });
  return y + 2;
};

const renderLatinPdfTables = (doc: jsPDF, model: UnifiedDocumentModel, y: number): number => {
  model.tables.forEach((table) => {
    y = ensurePage(doc, y, 20);
    if (table.title) {
      doc.setFont('helvetica', 'bold');
      doc.text(table.title, PAGE_MARGIN_X, y);
      y += LINE_HEIGHT;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(table.columns.join(' | '), PAGE_MARGIN_X, y);
    y += LINE_HEIGHT;
    doc.setFont('helvetica', 'normal');
    table.rows.forEach((row) => {
      y = ensurePage(doc, y, LINE_HEIGHT);
      doc.text(row.join(' | '), PAGE_MARGIN_X, y);
      y += LINE_HEIGHT;
    });
    if (table.totals?.length) {
      y = ensurePage(doc, y, LINE_HEIGHT);
      doc.setFont('helvetica', 'bold');
      doc.text(table.totals.join(' | '), PAGE_MARGIN_X, y);
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
  model.footer.signatures.forEach((role) => {
    y = ensurePage(doc, y, LINE_HEIGHT);
    doc.setFont('helvetica', 'normal');
    doc.text(`${LATIN_SIGNATURE_LABEL[role]}: ____________________`, PAGE_MARGIN_X, y);
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

export function buildLatinPdf(model: UnifiedDocumentModel): jsPDF {
  const doc = newLatinDoc();
  let y = PAGE_MARGIN_Y;
  y = renderLatinPdfHeader(doc, model, y);
  y = renderLatinPdfKpis(doc, model, y);
  y = renderLatinPdfTables(doc, model, y);
  renderLatinPdfFooter(doc, model, y);
  return doc;
}
