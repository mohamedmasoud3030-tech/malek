import { documentEngine } from './DocumentEngine';
import type { DocumentRequest } from './types';

export const DocumentController = {
  /** Opens a scoped print preview for this document and triggers the browser print dialog. */
  async print(request: DocumentRequest): Promise<void> {
    const model = documentEngine.build(request);
    // jsPDF/html2canvas are only needed when a document is actually
    // printed or exported. Loading them dynamically keeps them out of the
    // initial bundle and out of route chunks that merely *might* print.
    const { DocumentRenderer } = await import('./DocumentRenderer');
    await DocumentRenderer.printDocument(model);
  },

  /** Renders and downloads a real application/pdf file for this document. */
  async downloadPdf(request: DocumentRequest): Promise<void> {
    const model = documentEngine.build(request);
    const { DocumentRenderer } = await import('./DocumentRenderer');
    await DocumentRenderer.downloadDocumentPdf(model);
  },
};
