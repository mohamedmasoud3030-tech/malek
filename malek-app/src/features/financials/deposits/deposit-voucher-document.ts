/**
 * Security Deposit Voucher adapter and actions (#6).
 *
 * Dedicated technical type: 'deposit_voucher'.
 * Deposits are not ordinary office revenue or expense.
 * Financial values are passed directly from canonical deposit records.
 */
import { documentService } from '@/services/documents/DocumentService';
import { hasCompleteCompanyIdentity, type DocumentCompanySettings } from '@/services/documents/companyIdentity';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import type { DepositVoucherPayload } from '@/services/documents/documentPayloads';
import type { DepositRecord } from './deposit-service';

export function toDepositVoucherPayload(params: {
  deposit: DepositRecord;
  transactionKind: 'received' | 'returned' | 'deducted';
  amount: number;
  transactionDate: string;
  reference?: string | null;
  reason?: string | null;
  notes?: string | null;
}): DepositVoucherPayload {
  const { deposit, transactionKind, amount, transactionDate, reference, reason, notes } = params;

  return {
    reference: reference ?? null,
    transactionDate,
    transactionKind,
    tenantName: deposit.tenant_name ?? null,
    propertyTitle: deposit.property_title ?? null,
    unitNumber: deposit.unit_number ?? null,
    amount,
    depositBalance: deposit.remaining_amount ?? null,
    reason: reason ?? null,
    notes: notes ?? deposit.notes ?? null,
  };
}

export function printDepositVoucher(params: {
  deposit: DepositRecord;
  settings: DocumentCompanySettings;
  transactionKind: 'received' | 'returned' | 'deducted';
  amount: number;
  transactionDate: string;
  reference?: string | null;
  reason?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('deposit_voucher', {
        settings,
        payload: toDepositVoucherPayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة سند مبلغ التأمين.',
  });
}

export function downloadDepositVoucherPdf(params: {
  deposit: DepositRecord;
  settings: DocumentCompanySettings;
  transactionKind: 'received' | 'returned' | 'deducted';
  amount: number;
  transactionDate: string;
  reference?: string | null;
  reason?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('deposit_voucher', {
        settings,
        payload: toDepositVoucherPayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير سند مبلغ التأمين كملف PDF.',
  });
}
