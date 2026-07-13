import { toast } from 'sonner';
import { openWhatsApp, printCurrentView, shareOrCopy } from '@/services/action-service';
import { exportContractToPdf } from '@/services/pdfService';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { Person, Property, Unit } from '@/types/domain';
import type { ContractDetail } from '../services/contractService';

const toPdfTenant = (person: ContractDetail['people']): Person | null => person ? { ...person, type: 'tenant', address: null, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null } : null;
const toPdfUnit = (unit: ContractDetail['units'], propertyId: string): Unit | null => unit ? { ...unit, name: null, property_id: propertyId, notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null } : null;
const toPdfProperty = (property: ContractDetail['properties']): Property | null => property ? { ...property, type: 'residential', owner_name: null, purchase_value: null, current_value: null, status: 'active', notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null } : null;

export function exportContractPdf(contract: ContractDetail, companySettings: CompanySettingsContract) {
  const tenant = toPdfTenant(contract.people);
  const unit = toPdfUnit(contract.units, contract.property_id);
  const property = toPdfProperty(contract.properties);
  exportContractToPdf(contract, {
    settings: { general: { company: { name: companySettings.companyName } }, operational: { currency: companySettings.defaultCurrency } },
    contracts: [contract], tenants: tenant ? [tenant] : [], units: unit ? [unit] : [], properties: property ? [property] : [],
  });
}

export function printContractView() { printCurrentView(); }

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
