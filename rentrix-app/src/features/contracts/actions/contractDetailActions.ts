import { toast } from 'sonner';
import { openWhatsApp, shareOrCopy } from '@/services/action-service';
import { DocumentTemplates, type ContractDocumentData, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { ContractDetail } from '../services/contractService';

function toDocumentSettings(companySettings: CompanySettingsContract): DocumentSettings {
  return {
    company: { name: companySettings.companyName },
    currency: companySettings.defaultCurrency,
  };
}

function toContractStatus(status: ContractDetail['status']): ContractDocumentData['contractStatus'] {
  if (status === 'draft' || status === 'active' || status === 'expired' || status === 'terminated') return status;
  return undefined;
}

function toContractDocumentData(contract: ContractDetail): ContractDocumentData {
  return {
    contractId: contract.id,
    contractNumber: contract.id.slice(0, 8),
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

async function runDocumentAction(action: () => Promise<void>, fallback: string) {
  try {
    await action();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : fallback);
  }
}

export function exportContractPdf(contract: ContractDetail, companySettings: CompanySettingsContract) {
  void runDocumentAction(
    () => DocumentTemplates.downloadContractPdf(toContractDocumentData(contract), toDocumentSettings(companySettings)),
    'تعذر تصدير العقد كملف PDF.',
  );
}

export function printContractView(contract: ContractDetail, companySettings: CompanySettingsContract) {
  void runDocumentAction(
    () => DocumentTemplates.printContractDocument(toContractDocumentData(contract), toDocumentSettings(companySettings)),
    'تعذرت طباعة العقد.',
  );
}

export async function shareContractLink(contract: ContractDetail) {
  const title = `عقد #${contract.id.slice(0, 8)}`;
  try {
    const result = await shareOrCopy({ title, url: window.location.href });
    if (result === 'copied') toast.success('تم نسخ رابط العقد');
    if (result === 'unavailable') toast.error('تعذر مشاركة رابط العقد من هذا المتصفح');
  } catch {
    toast.error('تعذر مشاركة رابط العقد');
  }
}

export function openContractWhatsApp(contract: ContractDetail) {
  const tenantName = contract.people?.full_name ? ` ${contract.people.full_name}` : '';
  const message = `مرحباً${tenantName}، بخصوص عقد #${contract.id.slice(0, 8)} على ${contract.properties?.title ?? 'العقار'} / ${contract.units?.unit_number ?? 'الوحدة'}.`;
  openWhatsApp(contract.people?.phone, message);
}
