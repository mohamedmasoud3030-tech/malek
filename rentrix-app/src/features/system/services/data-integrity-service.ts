import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { DataIntegrityCheck, DataIntegrityResult } from '../types';

type PropertyRow = Pick<Database['public']['Tables']['properties']['Row'], 'id' | 'deleted_at'> & {
  owner_id?: string | null;
  name?: string | null;
  title?: string | null;
};
type UnitRow = Pick<Database['public']['Tables']['units']['Row'], 'id' | 'property_id' | 'deleted_at'>;
type PersonRow = Pick<Database['public']['Tables']['people']['Row'], 'id' | 'type' | 'deleted_at'>;
type ContractRow = Pick<Database['public']['Tables']['contracts']['Row'], 'id' | 'property_id' | 'unit_id' | 'tenant_id' | 'start_date' | 'end_date' | 'deleted_at'>;
type InvoiceRow = Pick<Database['public']['Tables']['invoices']['Row'], 'id' | 'contract_id' | 'amount' | 'paid_amount' | 'deleted_at'>;
type OwnerRow = { id: string; name: string; full_name: string | null; deleted_at: string | null };
type PropertyOwnerRow = Pick<Database['public']['Tables']['property_owners']['Row'], 'property_id' | 'owner_id' | 'is_primary' | 'starts_on' | 'ends_on'>;
type OwnerAgreementRow = Pick<Database['public']['Tables']['owner_agreements']['Row'], 'property_id' | 'owner_id' | 'starts_on' | 'ends_on'>;

const INTEGRITY_UNAVAILABLE_REASON = 'تعذر تشغيل فحص سلامة البيانات باستخدام مخطط التشغيل الحالي دون افتراضات إضافية.';
const INTEGRITY_BROWSER_LIMIT_REASON = 'وصل فحص سلامة البيانات إلى حد القراءة الآمن في المتصفح قبل تأكيد اكتمال البيانات. هذا الفحص مناسب لبيانات العرض أو التدريج فقط، ويحتاج الإنتاج إلى مسار قراءة خادمي قابل للتوسع ومتحقق منه.';
export const DATA_INTEGRITY_PAGE_SIZE = 500;
export const DATA_INTEGRITY_MAX_PAGES = 10;

function getTodayLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type PaginatedReadQuery<Row> = Readonly<{
  range: (from: number, to: number) => PromiseLike<{ data: readonly Row[] | null; error: unknown }>;
}>;

type PaginatedReadResult<Row> =
  | Readonly<{ status: 'available'; rows: readonly Row[] }>
  | Readonly<{ status: 'unavailable'; reason: string }>;

function activeIds<T extends { id: string; deleted_at: string | null }>(rows: readonly T[]): Set<string> {
  return new Set(rows.filter((row) => !row.deleted_at).map((row) => row.id));
}

function activeTenantIds(rows: readonly PersonRow[]): Set<string> {
  return new Set(rows.filter((person) => !person.deleted_at && person.type === 'tenant').map((person) => person.id));
}

function activeUnitPropertyById(rows: readonly UnitRow[]): Map<string, string> {
  return new Map(rows.filter((unit) => !unit.deleted_at).map((unit) => [unit.id, unit.property_id]));
}

function buildCheck(id: string, label: string, description: string, count: number): DataIntegrityCheck {
  return { id, label, description, count, severity: count > 0 ? 'warning' : 'ok' };
}

export async function fetchPaginatedRows<Row>(createQuery: () => PaginatedReadQuery<Row>): Promise<PaginatedReadResult<Row>> {
  const rows: Row[] = [];

  for (let pageIndex = 0; pageIndex < DATA_INTEGRITY_MAX_PAGES; pageIndex += 1) {
    const from = pageIndex * DATA_INTEGRITY_PAGE_SIZE;
    const to = from + DATA_INTEGRITY_PAGE_SIZE - 1;
    const { data, error } = await createQuery().range(from, to);

    if (error) return { status: 'unavailable', reason: INTEGRITY_UNAVAILABLE_REASON };

    const page = data ?? [];
    rows.push(...page);

    if (page.length < DATA_INTEGRITY_PAGE_SIZE) {
      return { status: 'available', rows };
    }
  }

  return { status: 'unavailable', reason: INTEGRITY_BROWSER_LIMIT_REASON };
}

export function buildDataIntegritySnapshot(input: Readonly<{
  properties: readonly PropertyRow[];
  units: readonly UnitRow[];
  people: readonly PersonRow[];
  contracts: readonly ContractRow[];
  invoices: readonly InvoiceRow[];
  owners?: readonly OwnerRow[];
  propertyOwners?: readonly PropertyOwnerRow[];
  ownerAgreements?: readonly OwnerAgreementRow[];
}>): DataIntegrityResult {
  const propertyIds = activeIds(input.properties);
  const unitPropertyById = activeUnitPropertyById(input.units);
  const tenantIds = activeTenantIds(input.people);
  const contractIds = activeIds(input.contracts);

  const orphanUnits = input.units.filter((unit) => !unit.deleted_at && !propertyIds.has(unit.property_id)).length;
  const orphanContracts = input.contracts.filter((contract) => !contract.deleted_at && (!propertyIds.has(contract.property_id) || !tenantIds.has(contract.tenant_id))).length;
  const contractsWithInvalidUnits = input.contracts.filter((contract) => {
    if (contract.deleted_at || !contract.unit_id) return false;

    return unitPropertyById.get(contract.unit_id) !== contract.property_id;
  }).length;
  const contractsWithInvalidDates = input.contracts.filter((contract) => !contract.deleted_at && new Date(contract.start_date).getTime() > new Date(contract.end_date).getTime()).length;
  const orphanInvoices = input.invoices.filter((invoice) => !invoice.deleted_at && !contractIds.has(invoice.contract_id)).length;
  const overpaidInvoices = input.invoices.filter((invoice) => !invoice.deleted_at && Number(invoice.paid_amount) > Number(invoice.amount)).length;
  const owners = input.owners ?? [];
  const propertyOwners = input.propertyOwners ?? [];
  const ownerAgreements = input.ownerAgreements ?? [];
  const today = getTodayLocalDateString();
  const activePrimaryOwnerByProperty = new Map(
    propertyOwners
      .filter((link) => link.is_primary && (!link.starts_on || link.starts_on <= today) && (!link.ends_on || link.ends_on >= today))
      .map((link) => [link.property_id, link.owner_id]),
  );
  const propertiesWithoutAgreements = input.ownerAgreements
    ? input.properties.filter((property) => !property.deleted_at && !ownerAgreements.some((agreement) => agreement.property_id === property.id)).length
    : 0;
  const ownerProjectionMismatches = input.propertyOwners
    ? input.properties.filter((property) => {
      if (property.deleted_at) return false;
      const relationshipOwnerId = activePrimaryOwnerByProperty.get(property.id);
      return 'owner_id' in property && Boolean(relationshipOwnerId && property.owner_id !== relationshipOwnerId);
    }).length
    : 0;
  const agreementsWithoutCoveringOwnership = input.ownerAgreements && input.propertyOwners
    ? ownerAgreements.filter((agreement) => !propertyOwners.some((link) => (
      link.property_id === agreement.property_id
      && link.owner_id === agreement.owner_id
      && (!link.starts_on || link.starts_on <= agreement.starts_on)
      && (!link.ends_on || (agreement.ends_on !== null && link.ends_on >= agreement.ends_on))
    ))).length
    : 0;
  const ownerNameMismatches = input.owners
    ? owners.filter((owner) => !owner.deleted_at && owner.full_name?.trim() && owner.name.trim() !== owner.full_name.trim()).length
    : 0;
  const propertyNameMismatches = input.properties.some((property) => 'name' in property || 'title' in property)
    ? input.properties.filter((property) => !property.deleted_at && property.name?.trim() && property.title?.trim() && property.name.trim() !== property.title.trim()).length
    : 0;

  return {
    status: 'available',
    snapshot: {
      checkedAt: new Date().toISOString(),
      checks: [
        buildCheck('orphan-units', 'وحدات بلا عقار نشط', 'الوحدات النشطة يجب أن ترتبط بعقار نشط.', orphanUnits),
        buildCheck('orphan-contracts', 'عقود بلا عقار أو مستأجر نشط', 'العقود النشطة يجب أن ترتبط بعقار نشط وبشخص نشط من نوع مستأجر.', orphanContracts),
        buildCheck('invalid-contract-units', 'عقود بوحدات غير مطابقة للعقار', 'عند تحديد وحدة في العقد يجب أن تكون الوحدة نشطة وتابعة للعقار نفسه في العقد.', contractsWithInvalidUnits),
        buildCheck('invalid-contract-dates', 'عقود بتواريخ غير منطقية', 'تاريخ بداية العقد يجب ألا يتجاوز تاريخ نهايته.', contractsWithInvalidDates),
        buildCheck('orphan-invoices', 'فواتير بلا عقد نشط', 'الفواتير النشطة يجب أن ترتبط بعقد نشط.', orphanInvoices),
        buildCheck('overpaid-invoices', 'فواتير مدفوعة بأكثر من قيمتها', 'المبلغ المدفوع لا يجب أن يتجاوز قيمة الفاتورة.', overpaidInvoices),
        buildCheck('properties-without-owner-agreements', 'عقارات بلا اتفاقيات إدارة', 'كل عقار تشغيلي يحتاج اتفاقية مالك قبل إنشاء عقد إيجار.', propertiesWithoutAgreements),
        buildCheck('owner-projection-mismatches', 'ملكية العقار غير متزامنة', 'المالك التوافقي في العقار يجب أن يطابق المالك الأساسي الحالي.', ownerProjectionMismatches),
        buildCheck('agreements-without-ownership', 'اتفاقيات بلا ملكية مغطية', 'مالك الاتفاقية يجب أن يملك العقار طوال فترة الاتفاقية.', agreementsWithoutCoveringOwnership),
        buildCheck('owner-name-mismatches', 'أسماء ملاك غير متزامنة', 'اسم المالك الحديث والاسم التوافقي يجب أن يتطابقا.', ownerNameMismatches),
        buildCheck('property-name-mismatches', 'أسماء عقارات غير متزامنة', 'عنوان العقار الحديث والاسم التوافقي يجب أن يتطابقا.', propertyNameMismatches),
      ],
    },
  };
}

export async function runDataIntegrityAudit(): Promise<DataIntegrityResult> {
  const [properties, units, people, contracts, invoices, owners, propertyOwners, ownerAgreements] = await Promise.all([
    fetchPaginatedRows<PropertyRow>(() => supabase.from('properties').select('id, owner_id, name, title, deleted_at' as never).order('id', { ascending: true }).returns<PropertyRow[]>()),
    fetchPaginatedRows<UnitRow>(() => supabase.from('units').select('id, property_id, deleted_at').order('id', { ascending: true })),
    fetchPaginatedRows<PersonRow>(() => supabase.from('people').select('id, type, deleted_at').order('id', { ascending: true })),
    fetchPaginatedRows<ContractRow>(() => supabase.from('contracts').select('id, property_id, unit_id, tenant_id, start_date, end_date, deleted_at').order('id', { ascending: true })),
    fetchPaginatedRows<InvoiceRow>(() => supabase.from('invoices').select('id, contract_id, amount, paid_amount, deleted_at').order('id', { ascending: true })),
    fetchPaginatedRows<OwnerRow>(() => supabase.from('owners').select('id, name, full_name, deleted_at' as never).order('id', { ascending: true }).returns<OwnerRow[]>()),
    fetchPaginatedRows<PropertyOwnerRow>(() => supabase.from('property_owners').select('property_id, owner_id, is_primary, starts_on, ends_on').order('property_id', { ascending: true })),
    fetchPaginatedRows<OwnerAgreementRow>(() => supabase.from('owner_agreements').select('property_id, owner_id, starts_on, ends_on').order('property_id', { ascending: true })),
  ]);

  if (properties.status === 'unavailable') return properties;
  if (units.status === 'unavailable') return units;
  if (people.status === 'unavailable') return people;
  if (contracts.status === 'unavailable') return contracts;
  if (invoices.status === 'unavailable') return invoices;
  if (owners.status === 'unavailable') return owners;
  if (propertyOwners.status === 'unavailable') return propertyOwners;
  if (ownerAgreements.status === 'unavailable') return ownerAgreements;

  return buildDataIntegritySnapshot({
    properties: properties.rows,
    units: units.rows,
    people: people.rows,
    contracts: contracts.rows,
    invoices: invoices.rows,
    owners: owners.rows,
    propertyOwners: propertyOwners.rows,
    ownerAgreements: ownerAgreements.rows,
  });
}
