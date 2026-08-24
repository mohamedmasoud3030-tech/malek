import { Link } from '@tanstack/react-router';
import { Activity, Edit, FileText, ReceiptText } from 'lucide-react';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailFields } from '@/components/ui/detail-fields';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { businessReferenceOrLabel } from '@/lib/business-reference';
import { formatDefaultCompanyMoney } from '@/lib/companyFormatters';
import { useTenantDossier } from '../useTenantWorkspace';
import { useDialogNavigate } from '@/app/router/background-location';

export function TenantDossierContent({ tenantId }: Readonly<{ tenantId: string }>) {
  const dialogNavigate = useDialogNavigate();
  const { canAccess } = useAuth();
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
      <Card>
        <CardHeader><CardTitle>{dossier.person.full_name}</CardTitle></CardHeader>
        <CardContent>
          <DetailFields columns={3} fields={[
            { label: 'الهاتف', value: dossier.person.phone ? <span dir="ltr">{dossier.person.phone}</span> : 'غير موثق' },
            { label: 'البريد', value: dossier.person.email ? <span dir="ltr">{dossier.person.email}</span> : 'غير موثق' },
            { label: 'رقم الهوية', value: dossier.person.national_id ?? 'غير موثق' },
            { label: 'العقود النشطة', value: activeContracts.length },
            { label: 'إجمالي العقود', value: dossier.contracts.length },
          ]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" />العقود والعقارات والوحدات</CardTitle>
        </CardHeader>
        <CardContent>
          {dossier.contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد عقود مسجلة لهذا المستأجر.</p>
          ) : (
            <ul className="space-y-2">
              {dossier.contracts.map((contract) => (
                <li key={contract.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <p className="font-bold">{businessReferenceOrLabel(contract, 'عقد مسجل')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {contract.properties?.title ?? 'عقار غير محدد'} · {contract.units?.unit_number ? `وحدة ${contract.units.unit_number}` : 'بدون وحدة'} · {contract.start_date} — {contract.end_date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={contract.status === 'active' ? 'success' : 'neutral'}>{contract.status}</StatusBadge>
                    <Button variant="secondary" onClick={() => dialogNavigate({ to: '/contracts/$contractId', params: { contractId: contract.id } })}>فتح العقد</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canViewFinancial ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ReceiptText className="size-5 text-primary" />الفواتير والمتأخرات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="info">{dossier.invoices.length} فواتير</StatusBadge>
              <StatusBadge tone={outstanding > 0 ? 'warning' : 'success'}>الرصيد المفتوح {formatDefaultCompanyMoney(outstanding)}</StatusBadge>
            </div>

            {dossier.invoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                <span className="font-bold">{businessReferenceOrLabel(invoice, 'فاتورة مسجلة')}</span>
                <span className="text-sm">الاستحقاق {invoice.due_date} · المتبقي {formatDefaultCompanyMoney(Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount)))}</span>
                <Button asChild variant="secondary"><Link to="/invoices" search={{ invoiceId: invoice.id } as never}>فتح الفاتورة</Link></Button>
              </div>
            ))}

            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
              {statementContract ? (
                <Button asChild variant="outline">
                  <Link
                    to="/reports"
                    search={{ section: 'statements', tenantId, contractId: statementContract.id } as never}
                  >
                    كشف الحساب الكامل
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="secondary">
                <Link to="/reports" search={{ section: 'analytics', view: 'overdue', tenantId } as never}>تقرير المتأخرات</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canViewActivity ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-5 text-primary" />آخر النشاط</CardTitle></CardHeader>
          <CardContent>
            {dossier.latestActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا يوجد نشاط موثق.</p>
            ) : (
              <ul className="space-y-2">
                {dossier.latestActivity.map((item) => (
                  <li key={item.id} className="rounded-xl border p-3">
                    <p className="font-bold">{item.subject || 'تواصل مسجل'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('ar-OM-u-nu-latn')}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
      <ContextualDocumentsSection entityType="tenant" entityId={dossier.person.id} entityLabel="المستأجر" />
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
  return <PageLayout dir="rtl" size="wide" visualVariant="malek-pro"><PageHeader title="ملف المستأجر" description="ملف قابل للمشاركة لعلاقات المستأجر وعقوده وسياقه المالي." action={<Button asChild><Link to="/people/$personId/edit" params={{ personId: tenantId }}><Edit className="me-2 size-4" />تعديل</Link></Button>} /><TenantDossierContent tenantId={tenantId} /></PageLayout>;
}
