import { documentEngine } from './DocumentEngine';
import type { DocumentBuildInput, DocumentTypeId } from './documentPayloads';
import type { DocumentRequest } from './types';

/**
 * Execution coordinator for document output. It owns no layout logic: the
 * engine builds the unified model, and the canonical renderers perform output.
 * Heavy PDF dependencies remain dynamically imported.
 */
export const DocumentController = {
  /** Canonical typed print. */
  async printDocument<T extends DocumentTypeId>(type: T, input: DocumentBuildInput<T>): Promise<void> {
    const model = documentEngine.buildDocument(type, input);
    const { DocumentRenderer } = await import('./DocumentRenderer');
    await DocumentRenderer.printDocument(model);
  },

  /** Canonical typed PDF download. */
  async downloadDocumentPdf<T extends DocumentTypeId>(type: T, input: DocumentBuildInput<T>): Promise<void> {
    const model = documentEngine.buildDocument(type, input);
    const { DocumentRenderer } = await import('./DocumentRenderer');
    await DocumentRenderer.downloadDocumentPdf(model);
  },

  /**
   * Canonical in-memory PDF file for browser Web Share. Uses the exact same
   * document model and pagination engine as download; no alternate layout path.
   */
  async createDocumentPdfFile<T extends DocumentTypeId>(type: T, input: DocumentBuildInput<T>): Promise<File> {
    const model = documentEngine.buildDocument(type, input);
    const { createDocumentPdfFile } = await import('./renderer/documentFile');
    return createDocumentPdfFile(model);
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

export type { CanonicalDocumentPayloadMap } from './documentPayloads';
