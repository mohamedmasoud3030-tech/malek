import { Link } from '@tanstack/react-router';
import { Activity, Building2, Edit, FileText, ReceiptText, UserRound } from 'lucide-react';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailFields } from '@/components/ui/detail-fields';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { businessReferenceOrLabel } from '@/lib/business-reference';
import { personTypeLabels } from '../person-schema';
import { usePersonDossier } from '../use-people';

export function PersonDossierContent({ personId }: Readonly<{ personId: string }>) {
  const { canAccess } = useAuth();
  const canViewFinancial = canAccess('arrears.view');
  const canViewActivity = canAccess('communication.view');
  const dossierQuery = usePersonDossier(personId, canViewFinancial, canViewActivity);
  const dossier = dossierQuery.data;

  if (dossierQuery.isLoading) return <LoadingState label="جارٍ تحميل ملف الشخص" />;
  if (dossierQuery.isError) return <ErrorState title="تعذر تحميل ملف الشخص" error={dossierQuery.error} onRetry={() => { void dossierQuery.refetch(); }} />;
  if (!dossier) return null;

  const outstanding = dossier.invoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount)), 0);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><UserRound className="size-6" /></span><CardTitle>{dossier.person.full_name}</CardTitle></div></CardHeader>
        <CardContent>
          <DetailFields columns={3} fields={[
            { label: 'النوع', value: personTypeLabels[dossier.person.type] },
            { label: 'الهاتف', value: dossier.person.phone ? <span dir="ltr">{dossier.person.phone}</span> : 'غير موثق' },
            { label: 'البريد', value: dossier.person.email ? <span dir="ltr">{dossier.person.email}</span> : 'غير موثق' },
            { label: 'رقم الهوية', value: dossier.person.national_id ?? 'غير موثق' },
            { label: 'العنوان', value: dossier.person.address ?? 'غير موثق', wide: true },
            { label: 'ملاحظات', value: dossier.person.notes ?? '—', wide: true },
          ]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" />العقود والعقارات والوحدات</CardTitle></CardHeader>
        <CardContent>
          {dossier.contracts.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد علاقات تعاقدية مسجلة لهذا الشخص.</p> : (
            <ul className="space-y-2">
              {dossier.contracts.map((contract) => (
                <li key={contract.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
                  <div><p className="font-bold">{businessReferenceOrLabel(contract, 'عقد مسجل')}</p><p className="mt-1 text-xs text-muted-foreground">{contract.properties?.title ?? 'عقار غير محدد'} · {contract.units?.unit_number ? `وحدة ${contract.units.unit_number}` : 'بدون وحدة'} · {contract.start_date} — {contract.end_date}</p></div>
                  <div className="flex items-center gap-2"><StatusBadge tone={contract.status === 'active' ? 'success' : 'neutral'}>{contract.status}</StatusBadge><Button asChild variant="secondary"><Link to="/contracts/$contractId" params={{ contractId: contract.id }}>فتح العقد</Link></Button></div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canViewFinancial ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ReceiptText className="size-5 text-primary" />السياق المالي</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2"><StatusBadge tone="info">{dossier.invoices.length} فواتير</StatusBadge><StatusBadge tone={outstanding > 0 ? 'warning' : 'success'}>الرصيد المفتوح: {outstanding.toFixed(3)}</StatusBadge></div>
            {dossier.invoices.map((invoice) => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm"><span className="font-bold">{businessReferenceOrLabel(invoice, 'فاتورة مسجلة')}</span><span>الاستحقاق {invoice.due_date} · المتبقي {(Number(invoice.amount) - Number(invoice.paid_amount)).toFixed(3)}</span></div>)}
            <Button asChild variant="secondary"><Link to="/reports" search={{ section: 'analytics', view: 'overdue', tenantId: dossier.person.id } as never}>فتح تقرير المتأخرات</Link></Button>
          </CardContent>
        </Card>
      ) : null}

      {canViewActivity ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-5 text-primary" />آخر النشاط</CardTitle></CardHeader>
          <CardContent>{dossier.latestActivity.length === 0 ? <p className="text-sm text-muted-foreground">لا يوجد نشاط موثّق مرتبط بهذا الشخص.</p> : <ul className="space-y-2">{dossier.latestActivity.map((item) => <li key={item.id} className="rounded-xl border p-3"><p className="font-bold">{item.subject || 'تواصل مسجل'}</p><p className="mt-1 text-sm text-muted-foreground">{item.body}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('ar-OM-u-nu-latn')}</p></li>)}</ul>}</CardContent>
        </Card>
      ) : null}

      <ContextualDocumentsSection entityType="person" entityId={dossier.person.id} entityLabel="الشخص" />
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
      <PersonDossierContent personId={personId} />
    </EntityPreviewDialog>
  );
}

export function PersonDetailPage({ personId }: Readonly<{ personId: string }>) {
  return (
    <PageLayout dir="rtl" size="wide" visualVariant="malek-pro">
      <PageHeader title="ملف الشخص" description="ملف قابل للمشاركة يضم البيانات والعلاقات والمستندات والنشاط الموثق." action={<Button asChild><Link to="/people/$personId/edit" params={{ personId }}><Edit className="me-2 size-4" />تعديل</Link></Button>} />
      <PersonDossierContent personId={personId} />
    </PageLayout>
  );
}
