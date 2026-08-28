import { toast } from 'sonner';
import { shareOrCopy } from '@/services/action-service';
import { documentService } from '@/services/documents/DocumentService';
import { toContractDocumentPayload, type ContractDocumentData } from '@/services/documents/documentPayloadAdapters';
import { hasCompleteCompanyIdentity, type DocumentCompanySettings } from '@/services/documents/companyIdentity';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import { openWhatsAppComposer } from '@/lib/whatsapp-share';
import type { ContractDetail } from '../services/contractService';

function toContractStatus(status: ContractDetail['status']): ContractDocumentData['contractStatus'] {
  if (status === 'draft' || status === 'active' || status === 'expired' || status === 'terminated') return status;
  return undefined;
}

function toContractDocumentData(contract: ContractDetail): ContractDocumentData {
  return {
    contractId: contract.id,
    // The contracts table has no business contract number. Never present a
    // shortened UUID as a document reference.
    contractNumber: '',
    contractStatus: toContractStatus(contract.status),
    tenantName: contract.people?.full_name ?? '—',
    tenantPhone: contract.people?.phone ?? '—',
    tenantEmail: contract.people?.email ?? '—',
    tenantNationalId: contract.people?.national_id ?? '—',
    propertyName: contract.properties?.title ?? '—',
    unitNumber: contract.units?.unit_number ?? '—',
    unitFloor: contract.units?.floor ?? undefined,
    ownerName: '—',
    startDate: contract.start_date,
    endDate: contract.end_date,
    rentAmount: Number(contract.rent_amount ?? 0),
    paymentCycle: contract.payment_cycle,
    notes: contract.notes ?? undefined,
  };
}

/**
 * Readiness is re-derived here rather than trusted from the caller: these
 * two functions are the contract feature's only document entry points, and
 * they are reachable from several surfaces (detail page, preview dialog,
 * action menu). `hasCompleteCompanyIdentity` is the same canonical rule
 * `useDocumentSettings().isReady` uses, so a handler invoked with an
 * incomplete identity fails closed with the standard Arabic message instead
 * of reaching the engine.
 */
export function exportContractPdf(contract: ContractDetail, companySettings: DocumentCompanySettings): void {
  void runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(companySettings),
    operation: () => documentService.downloadDocumentPdf('contract', {
      settings: companySettings,
      payload: toContractDocumentPayload(toContractDocumentData(contract)),
    }),
    fallbackMessage: 'تعذر تصدير العقد كملف PDF.',
  });
}

export function printContractView(contract: ContractDetail, companySettings: DocumentCompanySettings): void {
  void runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(companySettings),
    operation: () => documentService.printDocument('contract', {
      settings: companySettings,
      payload: toContractDocumentPayload(toContractDocumentData(contract)),
    }),
    fallbackMessage: 'تعذرت طباعة العقد.',
  });
}

export async function shareContractLink(_contract: ContractDetail) {
  try {
    const result = await shareOrCopy({
      title: 'متابعة عقد',
      text: 'يوجد عقد يحتاج متابعة. يرجى استخدام القناة المعتمدة والتواصل مع المكتب دون مشاركة بيانات العقد في الرسالة.',
    });
    if (result === 'copied') toast.success('تم نسخ رسالة متابعة عامة');
    if (result === 'unavailable') toast.error('تعذر تجهيز المشاركة من هذا المتصفح');
  } catch {
    toast.error('تعذر تجهيز المشاركة');
  }
}

export function shareContractViaWhatsApp(contract: ContractDetail) {
  const tenantName = contract.people?.full_name?.trim() || 'المستأجر';
  const reference = contract.reference?.trim() || 'العقد الحالي';
  const property = contract.properties?.title?.trim() || 'العقار';
  const unit = contract.units?.unit_number?.trim();
  const location = unit ? `${property} · الوحدة ${unit}` : property;
  const text = `مرحبًا ${tenantName}، هذه متابعة بخصوص ${reference} — ${location}. يرجى التواصل مع المكتب إذا احتجت أي توضيح.`;
  const outcome = openWhatsAppComposer({
    phone: contract.people?.phone ?? undefined,
    text,
    webComposer: false,
  });

  if (!outcome.result.ok) {
    const message = outcome.result.reason === 'PHONE_INVALID'
      ? 'رقم واتساب المسجل غير صالح. حدّث رقم المستأجر أو افتح المشاركة العامة.'
      : outcome.result.reason === 'TEXT_TOO_LONG'
        ? 'رسالة واتساب أطول من الحد المسموح.'
        : 'تعذر تجهيز رسالة واتساب.';
    toast.error(message);
    return;
  }
  if (!outcome.opened) {
    toast.error('تعذر فتح واتساب. اسمح للمتصفح بفتح نافذة جديدة ثم أعد المحاولة.');
    return;
  }
  toast.success('تم فتح واتساب. الإرسال يتم يدويًا بعد مراجعة الرسالة.');
}
