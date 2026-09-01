import { Link, useParams } from '@tanstack/react-router';
import { Activity, Edit, FileText, ReceiptText, UserRound } from 'lucide-react';
import { useState } from 'react';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { DetailFields } from '@/components/ui/detail-fields';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { businessReferenceOrLabel } from '@/lib/business-reference';
import { formatCompanyDateTime } from '@/lib/companyFormatters';
import { contractStatusLabels, contractStatusTone, normalizeContractStatus } from '@/lib/contractStatus';
import { personTypeLabels } from '../person-schema';
import { usePersonDossier } from '../use-people';
import { useDialogNavigate } from '@/app/router/background-location';

type PersonSection = 'overview' | 'contracts' | 'financials' | 'records';

const personSections = [
  { id: 'overview', label: 'نظرة عامة', icon: UserRound },
  { id: 'contracts', label: 'العقود', icon: FileText },
  { id: 'financials', label: 'المالية', icon: ReceiptText },
  { id: 'records', label: 'السجل', icon: Activity },
] as const;

export function PersonDossierContent({ personId, section }: Readonly<{ personId: string; section?: PersonSection }>) {
  const dialogNavigate = useDialogNavigate();
  const { canAccess } = useAuth();
  const companyFormatters = useCompanyFormatters();
  const canViewFinancial = canAccess('arrears.view');
  const canViewReports = canAccess('financial.reports.view');
  const canViewActivity = canAccess('communication.view');
  const dossierQuery = usePersonDossier(personId, canViewFinancial, canViewActivity);
  const dossier = dossierQuery.data;

  if (dossierQuery.isLoading) return <LoadingState label="جارٍ تحميل ملف الشخص" />;
  if (dossierQuery.isError) return <ErrorState title="تعذر تحميل ملف الشخص" error={dossierQuery.error} onRetry={() => { void dossierQuery.refetch(); }} />;
  if (!dossier) return null;

  const outstanding = dossier.invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount)), 0);
  const activeContracts = dossier.contracts.filter((contract) => contract.status === 'active');
  const statementContract = activeContracts[0] ?? dossier.contracts[0];

  return (
    <div className="space-y-5">
      {(!section || section === 'overview') ? (
        <section aria-labelledby="person-overview-heading">
          <header className="flex items-center gap-3 border-b border-border/60 pb-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h3 id="person-overview-heading" className="truncate text-base font-black">{dossier.person.full_name}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">البيانات الأساسية والعلاقة التعاقدية.</p>
            </div>
          </header>
          <DetailFields columns={3} fields={[
            { label: 'النوع', value: personTypeLabels[dossier.person.type] },
            { label: 'الهاتف', value: dossier.person.phone ? <span dir="ltr">{dossier.person.phone}</span> : 'غير موثق' },
            { label: 'البريد', value: dossier.person.email ? <span dir="ltr">{dossier.person.email}</span> : 'غير موثق' },
            { label: 'رقم الهوية', value: dossier.person.national_id ?? 'غير موثق' },
            { label: 'العقود النشطة', value: activeContracts.length },
            { label: 'إجمالي العقود', value: dossier.contracts.length },
            { label: 'العنوان', value: dossier.person.address ?? 'غير موثق', wide: true },
            { label: 'ملاحظات', value: dossier.person.notes ?? '—', wide: true },
          ]} />
        </section>
      ) : null}

      {(!section || section === 'contracts') ? (
        <section aria-labelledby="person-contracts-heading" className={section ? undefined : 'border-t border-border/60 pt-4'}>
          <header className="border-b border-border/60 pb-2.5">
            <h3 id="person-contracts-heading" className="flex items-center gap-2 text-base font-black"><FileText className="size-5 text-primary" />العقود والعقارات والوحدات</h3>
          </header>
          {dossier.contracts.length === 0 ? <p className="py-4 text-sm text-muted-foreground">لا توجد علاقات تعاقدية مسجلة لهذا الشخص.</p> : (
            <ul className="divide-y divide-border/60">
              {dossier.contracts.map((contract) => (
                <li key={contract.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{businessReferenceOrLabel(contract, 'عقد مسجل')}</p>
                    <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{contract.properties?.title ?? 'عقار غير محدد'} · {contract.units?.unit_number ? `وحدة ${contract.units.unit_number}` : 'بدون وحدة'} · {contract.start_date} — {contract.end_date}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone={contractStatusTone[normalizeContractStatus(contract.status)]}>
                      {contractStatusLabels[normalizeContractStatus(contract.status)]}
                    </StatusBadge>
                    <Button variant="secondary" className="min-h-11" onClick={() => dialogNavigate({ to: '/contracts/$contractId', params: { contractId: contract.id } })}>فتح العقد</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {(!section || section === 'financials') && canViewFinancial ? (
        <section aria-labelledby="person-financial-heading" className={section ? undefined : 'border-t border-border/60 pt-4'}>
          <header className="border-b border-border/60 pb-2.5">
            <h3 id="person-financial-heading" className="flex items-center gap-2 text-base font-black"><ReceiptText className="size-5 text-primary" />السياق المالي</h3>
          </header>
          <div className="flex flex-wrap gap-2 py-3">
            <StatusBadge tone="info">{dossier.invoices.length} فواتير</StatusBadge>
            <StatusBadge tone={outstanding > 0 ? 'warning' : 'success'}>الرصيد المفتوح: {companyFormatters.money(outstanding)}</StatusBadge>
          </div>
          <div className="divide-y divide-border/60" aria-label="فواتير الشخص">
            {dossier.invoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-bold">{businessReferenceOrLabel(invoice, 'فاتورة مسجلة')}</span>
                <span>الاستحقاق {invoice.due_date} · المتبقي {companyFormatters.money(Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount)))}</span>
                <Button asChild variant="secondary" className="min-h-11"><Link to="/invoices" search={{ invoiceId: invoice.id } as never}>فتح الفاتورة</Link></Button>
              </div>
            ))}
          </div>
          {canViewReports ? (
            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
              {statementContract ? (
                <Button asChild variant="outline" className="min-h-11">
                  <Link
                    to="/reports"
                    search={{ section: 'statements', tenantId: dossier.person.id, contractId: statementContract.id } as never}
                  >
                    كشف الحساب الكامل
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="secondary" className="min-h-11">
                <Link to="/reports" search={{ section: 'analytics', view: 'overdue', tenantId: dossier.person.id } as never}>تحليل المتأخرات</Link>
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {(!section || section === 'records') && canViewActivity ? (
        <section aria-labelledby="person-activity-heading" className={section ? undefined : 'border-t border-border/60 pt-4'}>
          <header className="border-b border-border/60 pb-2.5">
            <h3 id="person-activity-heading" className="flex items-center gap-2 text-base font-black"><Activity className="size-5 text-primary" />آخر النشاط</h3>
          </header>
          {dossier.latestActivity.length === 0 ? <p className="py-4 text-sm text-muted-foreground">لا يوجد نشاط موثّق مرتبط بهذا الشخص.</p> : (
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

      {(!section || section === 'records') ? <ContextualDocumentsSection entityType="person" entityId={dossier.person.id} entityLabel="الشخص" /> : null}
    </div>
  );
}

export function PersonPreviewDialog({ personId, open, onOpenChange }: Readonly<{ personId: string; open: boolean; onOpenChange: (open: boolean) => void }>) {
  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title="ملف الشخص"
      description="بيانات الشخص وعلاقاته وعقوده وسياقه المالي حسب الصلاحية."
      actions={<Button asChild><Link to="/people/$personId/edit" params={{ personId }}><Edit className="me-2 size-4" />تعديل</Link></Button>}
    >
      <PersonDossierContent personId={personId} section="overview" />
    </EntityPreviewDialog>
  );
}

export function PersonDetailPage({ personId: personIdProp }: Readonly<{ personId?: string }>) {
  const params = useParams({ strict: false });
  const personId = personIdProp ?? (typeof params.personId === 'string' ? params.personId : '');
  const [activeSection, setActiveSection] = useState<PersonSection>('overview');

  return (
    <PageLayout dir="rtl" size="wide">
      <EntityDetailHeader
        title="ملف الشخص"
        subtitle="البيانات والعلاقات والمستندات والنشاط الموثق."
        backTo="/people"
        backLabel="الأشخاص"
        actions={<Button asChild><Link to="/people/$personId/edit" params={{ personId }}><Edit className="me-2 size-4" />تعديل</Link></Button>}
      />
      <SectionTabs items={personSections} activeId={activeSection} onChange={setActiveSection} ariaLabel="أقسام ملف الشخص" panelId="person-detail-panel" idPrefix="person-detail" compactMobile />
      <div id="person-detail-panel" role="tabpanel" aria-labelledby={`person-detail-tab-${activeSection}`}>
        <PersonDossierContent personId={personId} section={activeSection} />
      </div>
    </PageLayout>
  );
}
