import { Link } from '@tanstack/react-router';
import { Activity, Edit, FileText, ReceiptText, UserRound } from 'lucide-react';
import { useState } from 'react';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { DetailFields } from '@/components/ui/detail-fields';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { businessReferenceOrLabel } from '@/lib/business-reference';
import { formatCompanyDateTime } from '@/lib/companyFormatters';
import { useTenantDossier } from '../useTenantWorkspace';
import { useDialogNavigate } from '@/app/router/background-location';
import { TenantPortalLinkAction } from './TenantPortalLinkAction';

type TenantSection = 'overview' | 'contracts' | 'ledger' | 'records';

const tenantSections = [
  { id: 'overview', label: 'نظرة عامة', icon: UserRound },
  { id: 'contracts', label: 'العقود', icon: FileText },
  { id: 'ledger', label: 'الاستحقاقات والمدفوعات', icon: ReceiptText },
  { id: 'records', label: 'السجل', icon: Activity },
] as const;

export function TenantDossierContent({ tenantId, section }: Readonly<{ tenantId: string; section?: TenantSection }>) {
  const dialogNavigate = useDialogNavigate();
  const { canAccess } = useAuth();
  const companyFormatters = useCompanyFormatters();
  const canViewFinancial = canAccess('arrears.view');
  const canViewActivity = canAccess('communication.view');
  const query = useTenantDossier(tenantId, canViewFinancial, canViewActivity);
  const dossier = query.data;
  if (query.isLoading) return <LoadingState label="جارٍ تحميل ملف المستأجر" />;
  if (query.isError) return <ErrorState title="تعذر تحميل ملف المستأجر" error={query.error} onRetry={() => { void query.refetch(); }} />;
  if (!dossier) return null;

  const activeContracts = dossier.contracts.filter((contract) => contract.status === 'active');
  const statementContract = activeContracts[0] ?? dossier.contracts[0];
  const outstanding = dossier.invoices.reduce(
    (sum, invoice) => sum + Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount)),
    0,
  );

  return (
    <div className="space-y-5">
      {(!section || section === 'overview') ? (
        <section aria-labelledby="tenant-overview-heading">
          <header className="border-b border-border/60 pb-2.5">
            <h3 id="tenant-overview-heading" className="text-base font-black">{dossier.person.full_name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">بيانات المستأجر الأساسية وحجم علاقته التعاقدية بالمكتب.</p>
          </header>
          <DetailFields columns={3} fields={[
            { label: 'الهاتف', value: dossier.person.phone ? <span dir="ltr">{dossier.person.phone}</span> : 'غير موثق' },
            { label: 'البريد', value: dossier.person.email ? <span dir="ltr">{dossier.person.email}</span> : 'غير موثق' },
            { label: 'رقم الهوية', value: dossier.person.national_id ?? 'غير موثق' },
            { label: 'العقود النشطة', value: activeContracts.length },
            { label: 'إجمالي العقود', value: dossier.contracts.length },
          ]} />
        </section>
      ) : null}

      {(!section || section === 'contracts') ? (
        <section aria-labelledby="tenant-contracts-heading" className={section ? undefined : 'border-t border-border/60 pt-4'}>
          <header className="border-b border-border/60 pb-2.5">
            <h3 id="tenant-contracts-heading" className="flex items-center gap-2 text-base font-black"><FileText className="size-5 text-primary" />العقود والعقارات والوحدات</h3>
          </header>
          {dossier.contracts.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">لا توجد عقود مسجلة لهذا المستأجر.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {dossier.contracts.map((contract) => (
                <li key={contract.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{businessReferenceOrLabel(contract, 'عقد مسجل')}</p>
                    <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                      {contract.properties?.title ?? 'عقار غير محدد'} · {contract.units?.unit_number ? `وحدة ${contract.units.unit_number}` : 'بدون وحدة'} · {contract.start_date} — {contract.end_date}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone={contract.status === 'active' ? 'success' : 'neutral'}>{contract.status}</StatusBadge>
                    <Button variant="secondary" className="min-h-11" onClick={() => dialogNavigate({ to: '/contracts/$contractId', params: { contractId: contract.id } })}>فتح العقد</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {(!section || section === 'ledger') && canViewFinancial ? (
        <section aria-labelledby="tenant-ledger-heading" className={section ? undefined : 'border-t border-border/60 pt-4'}>
          <header className="border-b border-border/60 pb-2.5">
            <h3 id="tenant-ledger-heading" className="flex items-center gap-2 text-base font-black"><ReceiptText className="size-5 text-primary" />سجل الاستحقاقات والمدفوعات</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">جدول الاستحقاقات التعاقدي وما سُدد فعليًا والمتبقي والمتأخر؛ لا يغيّر الدفع تاريخ الاستحقاق الأصلي.</p>
          </header>

          <div className="flex flex-wrap gap-2 py-3">
            <StatusBadge tone="info">{dossier.invoices.length} فواتير</StatusBadge>
            <StatusBadge tone={outstanding > 0 ? 'warning' : 'success'}>الرصيد المفتوح {companyFormatters.money(outstanding)}</StatusBadge>
          </div>

          <div className="divide-y divide-border/60" aria-label="استحقاقات المستأجر">
            {dossier.invoices.slice().sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? '')).map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="min-w-0 flex-1 truncate font-bold">{businessReferenceOrLabel(invoice, 'فاتورة مسجلة')}</span>
                <span className="text-sm">الاستحقاق {invoice.due_date} · المتبقي {companyFormatters.money(Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount)))}</span>
                <Button asChild variant="secondary" className="min-h-11"><Link to="/invoices" search={{ invoiceId: invoice.id } as never}>فتح الفاتورة</Link></Button>
              </div>
            ))}
          </div>

          <div className="border-t border-border/60 pt-4">
            <p className="text-sm font-bold">الدفعات وإثباتاتها</p>
            {dossier.receipts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">لا توجد دفعات أو إثباتات دفع مسجلة لهذا المستأجر.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border/60" aria-label="دفعات المستأجر وإثباتاتها">
                {dossier.receipts.map((receipt) => (
                  <li key={receipt.id} className="grid grid-cols-1 gap-1.5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3">
                    <span className="truncate font-bold">{receipt.reference ?? receipt.no ?? 'دفعة مسجلة'}</span>
                    <span className="text-muted-foreground">{receipt.date_time.slice(0, 10)}{receipt.channel ? ` · ${receipt.channel}` : ''}</span>
                    <span className="font-bold tabular-nums" dir="ltr">{companyFormatters.money(Number(receipt.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
            {statementContract ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link
                  to="/reports"
                  search={{ section: 'statements', tenantId, contractId: statementContract.id } as never}
                >
                  كشف الحساب الكامل
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary" className="min-h-11">
              <Link to="/reports" search={{ section: 'analytics', view: 'overdue', tenantId } as never}>تقرير المتأخرات</Link>
            </Button>
          </div>
        </section>
      ) : null}

      {(!section || section === 'records') && canViewActivity ? (
        <section aria-labelledby="tenant-activity-heading" className={section ? undefined : 'border-t border-border/60 pt-4'}>
          <header className="border-b border-border/60 pb-2.5">
            <h3 id="tenant-activity-heading" className="flex items-center gap-2 text-base font-black"><Activity className="size-5 text-primary" />آخر النشاط</h3>
          </header>
          {dossier.latestActivity.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">لا يوجد نشاط موثق.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {dossier.latestActivity.map((item) => (
                <li key={item.id} className="py-3">
                  <p className="font-bold">{item.subject || 'تواصل مسجل'}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatCompanyDateTime(companyFormatters, item.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
      {(!section || section === 'records') ? <ContextualDocumentsSection entityType="tenant" entityId={dossier.person.id} entityLabel="المستأجر" /> : null}
    </div>
  );
}

export function TenantPreviewDialog({ tenantId, open, onOpenChange, onEdit }: Readonly<{ tenantId: string; open: boolean; onOpenChange: (open: boolean) => void; onEdit?: (personId: string) => void }>) {
  return (
    <EntityPreviewDialog open={open} onOpenChange={onOpenChange} title="ملف المستأجر" description="العلاقات والعقود والفواتير والمستندات حسب الصلاحية." actions={onEdit ? <Button onClick={() => onEdit(tenantId)}><Edit className="me-2 size-4" />تعديل</Button> : undefined}>
      <TenantDossierContent tenantId={tenantId} />
    </EntityPreviewDialog>
  );
}

export function TenantDetailPage({ tenantId }: Readonly<{ tenantId: string }>) {
  const [activeSection, setActiveSection] = useState<TenantSection>('overview');

  return (
    <PageLayout dir="rtl" size="wide" visualVariant="malek-pro">
      <EntityDetailHeader
        title="ملف المستأجر"
        subtitle="علاقات المستأجر وعقوده وسياقه المالي."
        backTo="/tenants"
        backLabel="المستأجرون"
        actions={(
          <div className="flex flex-wrap gap-2">
            <TenantPortalLinkAction tenantId={tenantId} />
            <Button asChild><Link to="/people/$personId/edit" params={{ personId: tenantId }}><Edit className="me-2 size-4" />تعديل</Link></Button>
          </div>
        )}
      />
      <SectionTabs
        items={tenantSections}
        activeId={activeSection}
        onChange={setActiveSection}
        ariaLabel="أقسام ملف المستأجر"
        panelId="tenant-detail-panel"
        idPrefix="tenant-detail"
        compactMobile
      />
      <div id="tenant-detail-panel" role="tabpanel" aria-labelledby={`tenant-detail-tab-${activeSection}`}>
        <TenantDossierContent tenantId={tenantId} section={activeSection} />
      </div>
    </PageLayout>
  );
}
