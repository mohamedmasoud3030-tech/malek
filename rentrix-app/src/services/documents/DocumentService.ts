import { DocumentController } from './DocumentController';
import { getDocumentTemplateEntry, listDocumentTemplateEntries } from './documentRegistry';
import type { DocumentBuildInput, DocumentTypeId } from './documentPayloads';
import type { DocumentRequest } from './types';

/**
 * Supported document outputs for the current local template engine.
 * Provider/storage integration is intentionally not part of this boundary.
 */
export type DocumentType = DocumentTypeId;

export type DocumentCapability = Readonly<{
  type: DocumentType;
  templateAvailable: boolean;
  externalProviderRequired: boolean;
}>;

/**
 * The capability list is derived from the template registry — a document
 * type is printable/exportable exactly when it has a registered template.
 */
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
 *
 * It deliberately returns promises so a future provider/storage adapter can
 * be introduced without changing page contracts. `print*` and
 * `download*Pdf` are two distinct operations: print opens a scoped A4
 * preview and triggers the browser print dialog; download produces a real
 * `application/pdf` file. Neither is implemented in terms of the other.
 *
 * Prefer the canonical typed methods (`printDocument`/`downloadDocumentPdf`)
 * with payloads from `documentPayloads.ts`; the legacy `print`/
 * `downloadPdf` request shape stays only for compatibility-era callers.
 */
export const documentService = {
  /** Canonical typed print. */
  async printDocument<T extends DocumentTypeId>(type: T, input: DocumentBuildInput<T>): Promise<void> {
    assertSupported(type);
    await DocumentController.printDocument(type, input);
  },

  /** Canonical typed PDF download. */
  async downloadDocumentPdf<T extends DocumentTypeId>(type: T, input: DocumentBuildInput<T>): Promise<void> {
    assertSupported(type);
    await DocumentController.downloadDocumentPdf(type, input);
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

  /** @deprecated use the canonical `downloadDocumentPdf` — kept temporarily for callers mid-migration. */
  async renderPdf(request: DocumentRequest): Promise<void> {
    // Delegates straight to the controller so the compat path never routes
    // through another deprecated member.
    assertSupported(request.type);
    await DocumentController.downloadPdf(request);
  },
};
