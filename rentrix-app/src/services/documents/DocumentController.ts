import { documentEngine } from './DocumentEngine';
import type { DocumentRequest } from './types';

export const DocumentController = {
  async renderToPDF(request: DocumentRequest): Promise<void> {
    const model = documentEngine.build(request);
    // jsPDF is ~500kb and is only needed when a document is actually
    // exported. Loading it dynamically keeps it out of the initial
    // bundle and out of route chunks that merely *might* export a PDF.
    const { DocumentRenderer } = await import('./DocumentRenderer');
    DocumentRenderer.renderToPDF(model);
  },

  async printDocument(request: DocumentRequest): Promise<void> {
    const model = documentEngine.build(request);
    const { DocumentRenderer } = await import('./DocumentRenderer');
    DocumentRenderer.printDocument(model);
  },

  async downloadDocumentPdf(request: DocumentRequest): Promise<void> {
    const model = documentEngine.build(request);
    const { DocumentRenderer } = await import('./DocumentRenderer');
    await DocumentRenderer.downloadDocumentPdf(model);
  }
};
