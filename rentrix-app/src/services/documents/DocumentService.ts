import { DocumentController } from './DocumentController';
import type { DocumentRequest } from './types';

/**
 * Supported document outputs for the current local template engine.
 * Provider/storage integration is intentionally not part of this boundary.
 */
export type DocumentType =
  | 'contract'
  | 'invoice'
  | 'receipt'
  | 'expense_voucher'
  | 'payment'
  | 'owner_statement'
  | 'tenant_statement'
  | 'trial_balance'
  | 'income_statement'
  | 'balance_sheet';

export type DocumentCapability = Readonly<{
  type: DocumentType;
  templateAvailable: boolean;
  externalProviderRequired: boolean;
}>;

const templateCapabilities: readonly DocumentCapability[] = [
  { type: 'contract', templateAvailable: true, externalProviderRequired: false },
  { type: 'invoice', templateAvailable: true, externalProviderRequired: false },
  { type: 'receipt', templateAvailable: true, externalProviderRequired: false },
  { type: 'expense_voucher', templateAvailable: true, externalProviderRequired: false },
  { type: 'payment', templateAvailable: true, externalProviderRequired: false },
  { type: 'owner_statement', templateAvailable: true, externalProviderRequired: false },
  { type: 'tenant_statement', templateAvailable: true, externalProviderRequired: false },
  { type: 'trial_balance', templateAvailable: true, externalProviderRequired: false },
  { type: 'income_statement', templateAvailable: true, externalProviderRequired: false },
  { type: 'balance_sheet', templateAvailable: true, externalProviderRequired: false },
];

export function listDocumentCapabilities(): readonly DocumentCapability[] {
  return templateCapabilities;
}

export function getDocumentCapability(type: string): DocumentCapability | undefined {
  return templateCapabilities.find((capability) => capability.type === type);
}

/**
 * Document service boundary used by UI actions. It deliberately returns a
 * promise so a future provider/storage adapter can be introduced without
 * changing page contracts. The current implementation renders local PDFs.
 */
export const documentService = {
  async renderPdf(request: DocumentRequest): Promise<void> {
    const capability = getDocumentCapability(request.type);
    if (!capability) throw new Error(`Unsupported document type: ${request.type}`);
    if (!capability.templateAvailable) {
      throw new Error(`لا يوجد قالب محلي جاهز للمستند: ${request.type}`);
    }

    await DocumentController.renderToPDF(request);
  },
};
