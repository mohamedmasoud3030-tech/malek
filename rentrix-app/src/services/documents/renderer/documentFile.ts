import type { UnifiedDocumentModel } from '../types';
import { sanitizeDocumentFileName } from '../documentRegistry';
import { buildArabicDocumentPdf, modelHasArabicText } from '../DocumentRenderer';
import { buildLatinPdf } from './latinPdf';

/**
 * Builds a browser File from the same unified document model used by print and
 * download. This is not a second PDF engine: Arabic documents reuse the
 * canonical paginated renderer and Latin documents reuse the canonical jsPDF
 * builder. The file exists only in memory for Web Share.
 */
export async function createDocumentPdfFile(model: UnifiedDocumentModel): Promise<File> {
  const blob = modelHasArabicText(model)
    ? (await buildArabicDocumentPdf(model)).doc.output('blob')
    : buildLatinPdf(model).output('blob');

  return new File(
    [blob],
    `${sanitizeDocumentFileName(model.fileName)}.pdf`,
    { type: 'application/pdf', lastModified: Date.now() },
  );
}
