import { DocumentController } from './DocumentController';
import { getDocumentTemplateEntry, listDocumentTemplateEntries } from './documentRegistry';
import type { DocumentBuildInput, DocumentTypeId } from './documentPayloads';
import type { DocumentRequest } from './types';

/** Supported document outputs for the current local template engine. */
export type DocumentType = DocumentTypeId;

export type DocumentCapability = Readonly<{
  type: DocumentType;
  templateAvailable: boolean;
  externalProviderRequired: boolean;
}>;

const templateCapabilities: readonly DocumentCapability[] = listDocumentTemplateEntries().map((entry) => ({
  type: entry.type,
  templateAvailable: true,
  externalProviderRequired: false,
}));

export function listDocumentCapabilities(): readonly DocumentCapability[] {
  return templateCapabilities;
}

export function getDocumentCapability(type: string): DocumentCapability | undefined {
  return templateCapabilities.find((capability) => capability.type === type);
}

function assertSupported(type: string): void {
  if (!getDocumentTemplateEntry(type)) throw new Error(`Unsupported document type: ${type}`);
}

/**
 * Document service — the ONLY public boundary UI actions should use.
 * Print, download and share-file outputs all build from the same registered
 * document templates and unified model.
 */
export const documentService = {
  async printDocument<T extends DocumentTypeId>(type: T, input: DocumentBuildInput<T>): Promise<void> {
    assertSupported(type);
    await DocumentController.printDocument(type, input);
  },

  async downloadDocumentPdf<T extends DocumentTypeId>(type: T, input: DocumentBuildInput<T>): Promise<void> {
    assertSupported(type);
    await DocumentController.downloadDocumentPdf(type, input);
  },

  /** Produces an in-memory application/pdf File for Web Share capable browsers. */
  async createDocumentPdfFile<T extends DocumentTypeId>(type: T, input: DocumentBuildInput<T>): Promise<File> {
    assertSupported(type);
    return DocumentController.createDocumentPdfFile(type, input);
  },

  /** @deprecated compatibility request shape — migrate to `printDocument`. */
  async print(request: DocumentRequest): Promise<void> {
    assertSupported(request.type);
    await DocumentController.print(request);
  },

  /** @deprecated compatibility request shape — migrate to `downloadDocumentPdf`. */
  async downloadPdf(request: DocumentRequest): Promise<void> {
    assertSupported(request.type);
    await DocumentController.downloadPdf(request);
  },

  /** @deprecated use the canonical `downloadDocumentPdf`. */
  async renderPdf(request: DocumentRequest): Promise<void> {
    assertSupported(request.type);
    await DocumentController.downloadPdf(request);
  },
};
