import { Link } from '@tanstack/react-router';
import { Activity, Edit, MapPinned, WalletCards } from 'lucide-react';
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
import { useLandDossier } from '../use-lands';
import { landStatusLabels, landCategoryLabels } from '../labels';

export function LandDossierContent({ landId }: Readonly<{ landId: string }>) {
  const { canAccess } = useAuth();
  const query = useLandDossier(landId, canAccess('commissions.view'), canAccess('communication.view'));
  const dossier = query.data;
  if (query.isLoading) return <LoadingState label="جارٍ تحميل ملف الأرض" />;
  if (query.isError) return <ErrorState title="تعذر تحميل ملف الأرض" error={query.error} onRetry={() => { void query.refetch(); }} />;
  if (!dossier) return null;
  const land = dossier.land;
  const ownerName = dossier.owner?.display_name?.trim() || dossier.owner?.full_name?.trim() || 'غير مرتبط بمالك';
  return (
    <div className="space-y-5">
      <Card><CardHeader><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><MapPinned className="size-6" /></span><div><CardTitle>{land.name || land.plot_no || 'أرض مسجلة'}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{land.location || 'الموقع غير موثق'}</p></div></div></CardHeader><CardContent><DetailFields columns={3} fields={[
        { label: 'رقم القطعة', value: land.plot_no ?? 'غير موثق' },
        { label: 'التصنيف', value: landCategoryLabels[land.category ?? ''] ?? land.category ?? '—' },
        { label: 'الحالة', value: <StatusBadge tone={land.status === 'available' ? 'success' : land.status === 'reserved' ? 'warning' : 'neutral'}>{landStatusLabels[land.status ?? ''] ?? land.status ?? '—'}</StatusBadge> },
        { label: 'المساحة', value: land.area == null ? 'غير موثقة' : `${land.area} م²` },
        { label: 'المالك', value: dossier.owner ? <Link to="/owners/$ownerId" params={{ ownerId: dossier.owner.id }} className="text-primary underline-offset-4 hover:underline">{ownerName}</Link> : ownerName },
        { label: 'سعر المالك', value: land.owner_price == null ? 'غير موثق' : Number(land.owner_price).toFixed(3) },
        { label: 'سعر الشراء', value: land.purchase_price == null ? 'غير موثق' : Number(land.purchase_price).toFixed(3) },
        { label: 'ملاحظات', value: land.notes ?? '—', wide: true },
      ]} /></CardContent></Card>

      {canAccess('commissions.view') ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="size-5 text-primary" />العمولات المرتبطة</CardTitle></CardHeader><CardContent>{dossier.commissions.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد عمولات مرتبطة بهذه الأرض.</p> : <ul className="space-y-2">{dossier.commissions.map((commission) => <li key={commission.id} className="flex items-center justify-between rounded-xl border p-3"><span>{commission.staff_name || 'وسيط مسجل'}</span><span>{Number(commission.amount || 0).toFixed(3)} · {commission.status}</span></li>)}</ul>}</CardContent></Card> : null}
      {canAccess('communication.view') ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-5 text-primary" />آخر النشاط</CardTitle></CardHeader><CardContent>{dossier.latestActivity.length === 0 ? <p className="text-sm text-muted-foreground">لا يوجد نشاط موثق مرتبط بهذه الأرض.</p> : <ul className="space-y-2">{dossier.latestActivity.map((item) => <li key={item.id} className="rounded-xl border p-3"><p className="font-bold">{item.subject || 'متابعة مسجلة'}</p><p className="mt-1 text-sm text-muted-foreground">{item.body}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('ar-OM-u-nu-latn')}</p></li>)}</ul>}</CardContent></Card> : null}
      <ContextualDocumentsSection entityType="land" entityId={land.id} entityLabel="الأرض" />
    </div>
  );
}

export function LandPreviewDialog({ landId, open, onOpenChange }: Readonly<{ landId: string; open: boolean; onOpenChange: (open: boolean) => void }>) {
  return <EntityPreviewDialog open={open} onOpenChange={onOpenChange} title="ملف الأرض" description="البيانات والملكية والعمولات والنشاط والمستندات حسب الصلاحية."><LandDossierContent landId={landId} /></EntityPreviewDialog>;
}

export function LandDetailPage({ landId }: Readonly<{ landId: string }>) {
  return <PageLayout dir="rtl" size="wide" visualVariant="malek-pro"><PageHeader title="ملف الأرض" description="ملف قابل للمشاركة للأرض وعلاقاتها ومستنداتها." /><LandDossierContent landId={landId} /></PageLayout>;
}
