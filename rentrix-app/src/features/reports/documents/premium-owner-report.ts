import { listContractsForProperties, type ContractListItem } from '@/features/contracts/services/contractService';
import { loadInvoices, loadPayments } from '@/features/financials/reports/financial-reporting/report-loaders';
import {
  getInvoiceReportGrossAmount,
  getInvoiceReportRemainingAmount,
  type InvoiceReportRow,
  type PaymentWithInvoiceContext,
} from '@/features/financials/reports/financial-report-rows';
import { isContractStatus } from '@/lib/contractStatus';
import { listUnitsForProperties, type OwnerUnit } from '@/features/owners/services/owner-service';
import { buildVacancyAnalytics } from '@/features/units/vacancy-analytics';
import type { OwnerReportPayload, ProfessionalReportGroup, ReportCellFormat } from '@/services/documents/documentPayloads';
import {
  buildOwnerReportPayload,
  loadOwnerReportContext,
  type OwnerReportLoaderParams,
} from './professional-owner-report';

const text = (value: string | null | undefined): ReportCellFormat => ({ kind: 'text', value: value?.trim() || '—' });
const amount = (value: number | null | undefined): ReportCellFormat => (
  value == null ? text('—') : { kind: 'amount', value }
);

const unitStatusLabel = (status: string | null | undefined): string => {
  const value = String(status ?? '').trim().toLowerCase();
  if (value === 'occupied' || value === 'rented') return 'مشغولة';
  if (value === 'available') return 'شاغرة';
  if (value === 'reserved') return 'محجوزة';
  if (value === 'maintenance') return 'صيانة';
  return value || 'غير محددة';
};

const paymentMethodLabel = (method: string | null | undefined): string => {
  const value = String(method ?? '').trim().toLowerCase();
  if (value === 'cash') return 'نقدي';
  if (value === 'bank_transfer' || value === 'bank') return 'تحويل بنكي';
  if (value === 'card') return 'بطاقة';
  if (value === 'check' || value === 'cheque') return 'شيك';
  return value || '—';
};

function contractOverlapsPeriod(contract: ContractListItem, from: string, to: string): boolean {
  if (isContractStatus(contract.status, 'draft') || isContractStatus(contract.status, 'terminated') && contract.start_date > to) return false;
  return contract.start_date <= to && contract.end_date >= from;
}

function preferredContract(contracts: readonly ContractListItem[], from: string, to: string): ContractListItem | undefined {
  return contracts
    .filter((contract) => contractOverlapsPeriod(contract, from, to))
    .sort((left, right) => {
      const leftCoversEnd = left.start_date <= to && left.end_date >= to ? 1 : 0;
      const rightCoversEnd = right.start_date <= to && right.end_date >= to ? 1 : 0;
      return rightCoversEnd - leftCoversEnd || right.start_date.localeCompare(left.start_date);
    })[0];
}

type OwnerUnitReportRow = Readonly<{
  propertyId: string;
  propertyTitle: string;
  unitId: string;
  unitNumber: string;
  unitStatus: string;
  tenantName: string;
  rentAmount: number | null;
  contractEnd: string | null;
  due: number;
  collected: number;
  outstanding: number;
  paymentState: string;
  lastPaymentDate: string | null;
  lastPaymentMethod: string | null;
  invoiceReferences: string;
}>;

function buildUnitRows(params: {
  units: readonly OwnerUnit[];
  contracts: readonly ContractListItem[];
  invoices: readonly InvoiceReportRow[];
  payments: readonly PaymentWithInvoiceContext[];
  propertyTitles: ReadonlyMap<string, string>;
  from: string;
  to: string;
}): OwnerUnitReportRow[] {
  const { units, contracts, invoices, payments, propertyTitles, from, to } = params;

  return [...units]
    .sort((left, right) => {
      const propertyCompare = (propertyTitles.get(left.property_id) ?? '').localeCompare(propertyTitles.get(right.property_id) ?? '', 'ar');
      return propertyCompare || left.unit_number.localeCompare(right.unit_number, 'ar', { numeric: true });
    })
    .map((unit) => {
      const unitContracts = contracts.filter((contract) => contract.unit_id === unit.id);
      const displayContract = preferredContract(unitContracts, from, to);
      const contractIds = new Set(unitContracts.filter((contract) => contractOverlapsPeriod(contract, from, to)).map((contract) => contract.id));
      const unitInvoices = invoices.filter((invoice) => contractIds.has(invoice.contract_id));
      const unitPayments = payments.filter((payment) => payment.invoice?.contract_id && contractIds.has(payment.invoice.contract_id));
      const due = unitInvoices.reduce((sum, invoice) => sum + getInvoiceReportGrossAmount(invoice), 0);
      const outstanding = unitInvoices.reduce((sum, invoice) => sum + getInvoiceReportRemainingAmount(invoice), 0);
      const collected = unitPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const latestPayment = [...unitPayments]
        .filter((payment) => Boolean(payment.payment_date))
        .sort((left, right) => String(right.payment_date).localeCompare(String(left.payment_date)))[0];
      const references = Array.from(new Set(unitInvoices.map((invoice) => invoice.reference).filter((value): value is string => Boolean(value))));
      const paymentState = due <= 0
        ? (collected > 0 ? 'تحصيل على رصيد سابق' : 'لا استحقاق بالفترة')
        : outstanding <= 0
          ? 'مسدد'
          : outstanding < due
            ? 'مدفوع جزئيًا'
            : 'غير مسدد';

      return {
        propertyId: unit.property_id,
        propertyTitle: propertyTitles.get(unit.property_id) ?? 'عقار غير محدد',
        unitId: unit.id,
        unitNumber: unit.unit_number,
        unitStatus: unitStatusLabel(unit.status),
        tenantName: displayContract?.people?.full_name ?? '—',
        rentAmount: displayContract?.rent_amount ?? unit.rent_amount ?? null,
        contractEnd: displayContract?.end_date ?? null,
        due,
        collected,
        outstanding,
        paymentState,
        lastPaymentDate: latestPayment?.payment_date ?? null,
        lastPaymentMethod: latestPayment?.payment_method ?? null,
        invoiceReferences: references.length > 0 ? references.slice(0, 4).join('، ') : '—',
      };
    });
}

function buildOwnerAssetGroup(params: {
  rows: readonly OwnerUnitReportRow[];
  vacancies: ReturnType<typeof buildVacancyAnalytics>['vacantRows'];
}): ProfessionalReportGroup {
  const { rows, vacancies } = params;
  const blocks: ProfessionalReportGroup['blocks'] = [];

  if (rows.length > 0) {
    blocks.push({
      kind: 'table',
      table: {
        title: 'العقارات والوحدات والعقود',
        columns: ['العقار', 'الوحدة', 'الحالة', 'المستأجر', 'الإيجار', 'نهاية العقد'],
        rows: rows.map((row) => [
          text(row.propertyTitle),
          text(row.unitNumber),
          text(row.unitStatus),
          text(row.tenantName),
          amount(row.rentAmount),
          text(row.contractEnd?.slice(0, 10)),
        ]),
      },
    });

    blocks.push({
      kind: 'table',
      table: {
        title: 'استحقاقات وتحصيلات الوحدات للفترة',
        columns: ['العقار / الوحدة', 'المستحق', 'المحصل', 'غير المسدد', 'حالة السداد', 'آخر تحصيل', 'الطريقة', 'مرجع الاستحقاق'],
        rows: rows.map((row) => [
          text(`${row.propertyTitle} / ${row.unitNumber}`),
          amount(row.due),
          amount(row.collected),
          amount(row.outstanding),
          text(row.paymentState),
          text(row.lastPaymentDate?.slice(0, 10)),
          text(paymentMethodLabel(row.lastPaymentMethod)),
          text(row.invoiceReferences),
        ]),
      },
    });
  } else {
    blocks.push({ kind: 'note', note: { text: 'لا توجد وحدات مسجلة ضمن نطاق عقارات المالك الحالي.', tone: 'neutral' } });
  }

  if (vacancies.length > 0) {
    blocks.push({
      kind: 'table',
      table: {
        title: 'الوحدات الشاغرة ومدد الشغور',
        columns: ['العقار', 'الوحدة', 'الشغور منذ', 'مدة الشغور', 'الإيجار المرجعي', 'الإجراء التشغيلي'],
        rows: vacancies.map((row) => [
          text(row.propertyTitle),
          text(row.unitNumber),
          text(row.vacancySince),
          text(`${row.daysVacant} يوم`),
          amount(row.referenceRent),
          text('لا يوجد إجراء موثّق في بيانات الوحدة الحالية'),
        ]),
      },
    });
  }

  return { blocks };
}

/**
 * Enriches the existing Golden Owner Report without replacing it. The base
 * financial/settlement/maintenance/utility groups remain untouched; this adds
 * property/unit/tenant/rent/due/collection/vacancy evidence from existing
 * RLS-scoped read services and keeps the final reconciliation last.
 */
export async function loadPremiumOwnerReportPayload(params: OwnerReportLoaderParams): Promise<OwnerReportPayload> {
  const context = await loadOwnerReportContext(params);
  const base = buildOwnerReportPayload(context);
  const propertyTitles = context.propertyTitles ?? new Map<string, string>();
  const propertyIds = [...propertyTitles.keys()];
  const propertySet = new Set(propertyIds);

  if (propertyIds.length === 0) {
    return { ...base, reportTitle: 'كشف المالك الشامل' };
  }

  const [contracts, units, invoices, payments] = await Promise.all([
    listContractsForProperties(propertyIds),
    listUnitsForProperties(propertyIds),
    loadInvoices({ dateFrom: params.from, dateTo: params.to, propertyId: params.propertyId ?? undefined }),
    loadPayments({ dateFrom: params.from, dateTo: params.to, propertyId: params.propertyId ?? undefined }),
  ]);
  const scopedInvoices = invoices.filter((invoice) => invoice.contracts?.property_id && propertySet.has(invoice.contracts.property_id));
  const scopedPayments = payments.filter((payment) => payment.contract?.property_id && propertySet.has(payment.contract.property_id));
  const unitRows = buildUnitRows({
    units,
    contracts,
    invoices: scopedInvoices,
    payments: scopedPayments,
    propertyTitles,
    from: params.from,
    to: params.to,
  });
  const vacancy = buildVacancyAnalytics(units, contracts, propertyTitles, params.to);
  const assetGroup = buildOwnerAssetGroup({ rows: unitRows, vacancies: vacancy.vacantRows });

  return {
    ...base,
    reportTitle: 'كشف المالك الشامل',
    groups: [base.groups[0], assetGroup, ...base.groups.slice(1)],
  };
}
