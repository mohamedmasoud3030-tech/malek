import { documentEngine } from './DocumentEngine';
import type { CanonicalDocumentPayloadMap, DocumentBuildInput, DocumentTypeId } from './documentPayloads';
import type { DocumentRequest } from './types';

/**
 * Execution coordinator for document output. It owns no layout logic: the
 * engine builds the unified model, the renderer performs print/PDF output.
 *
 * jsPDF/html2canvas are only needed when a document is actually printed or
 * exported — the renderer is always imported dynamically so that weight
 * stays out of the initial bundle and out of route chunks that merely
 * *might* print.
 */
export const DocumentController = {
  /** Canonical typed path: builds the model from the typed payload, then prints it. */
  async printDocument<T extends DocumentTypeId>(type: T, input: DocumentBuildInput<T>): Promise<void> {
    const model = documentEngine.buildDocument(type, input);
    const { DocumentRenderer } = await import('./DocumentRenderer');
    await DocumentRenderer.printDocument(model);
  },

  /** Canonical typed path: builds the model, then downloads a real application/pdf file. */
  async downloadDocumentPdf<T extends DocumentTypeId>(type: T, input: DocumentBuildInput<T>): Promise<void> {
    const model = documentEngine.buildDocument(type, input);
    const { DocumentRenderer } = await import('./DocumentRenderer');
    await DocumentRenderer.downloadDocumentPdf(model);
  },

  /** Compatibility path for the historical `{ type, payload }` request shape. */
  async print(request: DocumentRequest): Promise<void> {
    const model = documentEngine.build(request);
    const { DocumentRenderer } = await import('./DocumentRenderer');
    await DocumentRenderer.printDocument(model);
  },

  /** Compatibility path: renders and downloads a real application/pdf file. */
  async downloadPdf(request: DocumentRequest): Promise<void> {
    const model = documentEngine.build(request);
    const { DocumentRenderer } = await import('./DocumentRenderer');
    await DocumentRenderer.downloadDocumentPdf(model);
  },
};

export type { CanonicalDocumentPayloadMap };
