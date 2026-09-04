import { Link } from '@tanstack/react-router';
import { Building2, DoorOpen, FileText, ReceiptText, UserRound, WalletCards } from 'lucide-react';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { useNavigate } from '@tanstack/react-router';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyMoney, formatCompanyDate, formatCompanyNumber } from '@/lib/companyFormatters';
import { businessReferenceOrLabel } from '@/lib/business-reference';
import { usePropertyOwners } from '@/features/owners/useOwners';
import { useProperty } from '../use-properties';
import { useUnits } from '@/features/units/use-units';
import { unitStatusLabels, type UnitStatus } from '@/features/units/unit-schema';
import { usePropertyContractsTab, usePropertyInvoicesTab } from '../use-property-workspace-tabs';
import { contractStatusLabels, contractStatusTone, normalizeContractStatus } from '@/lib/contractStatus';
import { PropertyIdentityCard, PropertyUnitsSummaryCard } from '../overview/property-overview-cards';

function unitStatusTone(status: string): 'success' | 'info' | 'warning' | 'neutral' {
  if (status === 'occupied') return 'success';
  if (status === 'available') return 'info';
  if (status === 'maintenance' || status === 'reserved') return 'warning';
  return 'neutral';
}

const invoiceStatusLabels: Record<string, string> = {
  PAID: 'مدفوعة',
  paid: 'مدفوعة',
  PARTIALLY_PAID: 'مدفوعة جزئياً',
  partial: 'مدفوعة جزئياً',
  UNPAID: 'غير مدفوعة',
  unpaid: 'غير مدفوعة',
  OVERDUE: 'متأخرة',
  overdue: 'متأخرة',
  VOID: 'ملغاة',
  void: 'ملغاة',
};

function invoiceStatusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const normalized = status.toUpperCase();
  if (normalized === 'PAID') return 'success';
  if (normalized === 'OVERDUE') return 'danger';
  if (normalized === 'VOID') return 'neutral';
  return 'warning';
}

function getInvoiceRemaining(invoice: { amount: number; paid_amount: number }): number {
  return Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount));
}

function getOwnerName(link: { owner?: { display_name?: string | null; full_name?: string | null } | null }): string {
  return link.owner?.display_name?.trim() || link.owner?.full_name?.trim() || 'مالك غير محدد';
}

/**
 * Shared property dossier body used by both the property preview dialog and
 * the full property detail overview tab, so both surfaces read as the same
 * product. Read-only operational context only: identity, owners, units,
 * contract context, tenant-receivable context, and documents. Management
 * actions (agreements, edit, tabs) live in their own surfaces.
 */
export function PropertyDossierContent({ propertyId }: Readonly<{ propertyId: string }>) {
  const navigate = useNavigate();
  const companySettings = useCompanySettingsContract();
  const propertyQuery = useProperty(propertyId);
  const unitsQuery = useUnits(propertyId);
  const ownersQuery = usePropertyOwners(propertyId);
  const contractsQuery = usePropertyContractsTab(propertyId);
  const invoicesQuery = usePropertyInvoicesTab(propertyId);

  const property = propertyQuery.data;
  const units = unitsQuery.data ?? [];
  const owners = ownersQuery.data ?? [];
  const contracts = contractsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];

  if (!property) return null;

  const activeContracts = contracts.filter((contract) => contract.status === 'active');
  const openInvoices = invoices
    .filter((invoice) => getInvoiceRemaining(invoice) > 0)
    .sort((left, right) => (left.due_date ?? '').localeCompare(right.due_date ?? ''));
  const outstandingBalance = openInvoices.reduce((sum, invoice) => sum + getInvoiceRemaining(invoice), 0);
  const occupiedUnits = units.filter((unit) => unit.status === 'occupied').length;

  return (
    <div className="space-y-6">
      <PropertyIdentityCard property={property} />

      <ResponsiveCardGrid>
        <KpiCard label="إجمالي الوحدات" value={formatCompanyNumber(companySettings, units.length)} icon={DoorOpen} accent="primary" />
        <KpiCard label="الوحدات المشغولة" value={formatCompanyNumber(companySettings, occupiedUnits)} icon={DoorOpen} accent="emerald" />
        <KpiCard label="العقود النشطة" value={formatCompanyNumber(companySettings, activeContracts.length)} sub={`من أصل ${formatCompanyNumber(companySettings, contracts.length)} عقود`} icon={FileText} accent="sky" />
        <KpiCard label="مستحقات المستأجرين" value={formatCompanyMoney(companySettings, outstandingBalance)} sub={`${formatCompanyNumber(companySettings, openInvoices.length)} فواتير مفتوحة`} icon={WalletCards} accent="amber" />
      </ResponsiveCardGrid>

      <section className="border-t border-border/60 pt-4" aria-labelledby="property-owners-heading">
        <header className="border-b border-border/60 pb-2.5">
          <h3 id="property-owners-heading" className="flex items-center gap-2 text-base font-black"><UserRound className="size-5 text-primary" aria-hidden="true" />الملاك</h3>
          <p className="mt-1 text-sm text-muted-foreground">علاقات الملكية السارية على العقار مع نسب الملكية.</p>
        </header>
        {owners.length === 0 ? (
          <p className="py-4 text-sm font-semibold text-muted-foreground">لا توجد علاقة ملكية سارية موثقة لهذا العقار.</p>
        ) : (
          <ul className="divide-y divide-border/60" aria-label="قائمة ملاك العقار">
            {owners.map((link) => (
              <li key={link.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                <span className="font-bold">{getOwnerName(link)}</span>
                {link.is_primary ? <StatusBadge tone="info">مالك أساسي</StatusBadge> : null}
                <span className="ms-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">نسبة الملكية</span>
                  <span className="font-semibold tabular-nums" dir="ltr">{formatCompanyNumber(companySettings, link.ownership_percentage ?? 100)}%</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="border-t border-border/60 pt-4">
        <PropertyUnitsSummaryCard units={units} />
      </div>

      <section className="border-t border-border/60 pt-4" aria-labelledby="property-units-heading">
        <header className="border-b border-border/60 pb-2.5">
          <h3 id="property-units-heading" className="flex items-center gap-2 text-base font-black"><Building2 className="size-5 text-primary" aria-hidden="true" />الوحدات</h3>
          <p className="mt-1 text-sm text-muted-foreground">الوحدات المسجلة للعقار مع حالتها وإيجارها.</p>
        </header>
        {units.length === 0 ? (
          <p className="py-4 text-sm font-semibold text-muted-foreground">لا توجد وحدات مسجلة لهذا العقار حتى الآن.</p>
        ) : (
          <ul className="divide-y divide-border/60" aria-label="قائمة وحدات العقار">
            {units.slice(0, 10).map((unit) => (
              <li key={unit.id}>
                <button
                  type="button"
                  onClick={() => void navigate({ to: '/properties/$propertyId/units/$unitId', params: { propertyId, unitId: unit.id } })}
                  className="flex min-h-11 w-full flex-wrap items-center gap-2 py-3 text-start text-sm transition hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                >
                  <span className="font-bold">وحدة {unit.unit_number}</span>
                  <span className="text-xs text-muted-foreground">{unit.floor ? `الدور ${unit.floor}` : 'بدون دور'}</span>
                  <span className="ms-auto flex items-center gap-2">
                    <StatusBadge tone={unitStatusTone(unit.status)}>{unitStatusLabels[unit.status as UnitStatus] ?? unit.status}</StatusBadge>
                    <span className="text-xs font-semibold tabular-nums" dir="ltr">{formatCompanyMoney(companySettings, unit.rent_amount)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {units.length > 10 ? (
          <p className="mt-2 text-xs text-muted-foreground">تُعرض أول 10 وحدات — افتح تبويب الوحدات لاستعراض الكل.</p>
        ) : null}
      </section>

      <section className="border-t border-border/60 pt-4" aria-labelledby="property-contracts-heading">
        <header className="border-b border-border/60 pb-2.5">
          <h3 id="property-contracts-heading" className="flex items-center gap-2 text-base font-black"><FileText className="size-5 text-primary" aria-hidden="true" />العقود والمستأجرون</h3>
          <p className="mt-1 text-sm text-muted-foreground">عقود الإيجار المرتبطة بالعقار مع المستأجر والوحدة والحالة.</p>
        </header>
        {contracts.length === 0 ? (
          <p className="py-4 text-sm font-semibold text-muted-foreground">لا توجد عقود إيجار مسجلة لهذا العقار حالياً.</p>
        ) : (
          <ul className="divide-y divide-border/60" aria-label="قائمة عقود العقار">
            {contracts.slice(0, 6).map((contract) => (
              <li key={contract.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{contract.people?.full_name ?? 'مستأجر مسجل'}</span>
                    <StatusBadge tone={contractStatusTone[normalizeContractStatus(contract.status)]}>
                      {contractStatusLabels[normalizeContractStatus(contract.status)]}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                    {businessReferenceOrLabel(contract, 'عقد مسجل')}
                    {contract.units?.unit_number ? ` · وحدة ${contract.units.unit_number}` : ''}
                    {' · '}
                    <span dir="ltr">{formatCompanyDate(companySettings, contract.start_date)} → {formatCompanyDate(companySettings, contract.end_date)}</span>
                  </p>
                </div>
                <Button variant="secondary" className="min-h-11 shrink-0" onClick={() => void navigate({ to: '/contracts/$contractId', params: { contractId: contract.id } })}>
                  فتح العقد
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 pt-3">
          <Button asChild variant="secondary" className="min-h-11">
            <Link to="/properties/$propertyId" params={{ propertyId }} search={{ tab: 'contracts' } as never}>إدارة عقود العقار</Link>
          </Button>
        </div>
      </section>

      <section className="border-t border-border/60 pt-4" aria-labelledby="property-invoices-heading">
        <header className="border-b border-border/60 pb-2.5">
          <h3 id="property-invoices-heading" className="flex items-center gap-2 text-base font-black"><ReceiptText className="size-5 text-primary" aria-hidden="true" />فواتير المستأجرين على العقار</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">المبالغ المتبقية على فواتير مستأجرين عبر عقود هذا العقار — لا تمثل رصيداً مستحقاً للمالك.</p>
        </header>
        <div className="flex flex-wrap gap-2 py-3">
          <StatusBadge tone="info">{formatCompanyNumber(companySettings, openInvoices.length)} فواتير مفتوحة</StatusBadge>
          <StatusBadge tone={outstandingBalance > 0 ? 'warning' : 'success'}>
            إجمالي المتبقي على المستأجرين: {formatCompanyMoney(companySettings, outstandingBalance)}
          </StatusBadge>
        </div>
        {openInvoices.length === 0 ? (
          <p className="py-2 text-sm font-semibold text-muted-foreground">لا توجد فواتير مفتوحة على عقود هذا العقار.</p>
        ) : (
          <ul className="divide-y divide-border/60" aria-label="فواتير العقار المفتوحة">
            {openInvoices.slice(0, 6).map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-bold">{businessReferenceOrLabel(invoice, 'فاتورة مسجلة')}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={invoiceStatusTone(invoice.status)}>{invoiceStatusLabels[invoice.status] ?? invoice.status}</StatusBadge>
                  <span className="font-semibold tabular-nums" dir="ltr">{formatCompanyMoney(companySettings, getInvoiceRemaining(invoice))}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 pt-3">
          <Button asChild variant="secondary" className="min-h-11">
            <Link to="/properties/$propertyId" params={{ propertyId }} search={{ tab: 'financials' } as never}>مراجعة المالية والتحصيلات</Link>
          </Button>
        </div>
      </section>

      <div className="border-t border-border/60 pt-4">
        <ContextualDocumentsSection entityType="property" entityId={property.id} entityLabel="العقار" />
      </div>
    </div>
  );
}
