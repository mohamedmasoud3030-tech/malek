import { Link } from '@tanstack/react-router';
import { Activity, Edit, FileText, MapPinned, WalletCards } from 'lucide-react';
import { useState } from 'react';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailFields } from '@/components/ui/detail-fields';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { SectionTabs } from '@/components/ui/section-tabs';
import { useAuth } from '@/hooks/use-auth';
import { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import { formatCompanyDateTime } from '@/lib/companyFormatters';
import { useLandDossier } from '../use-lands';
import { landStatusLabels, landCategoryLabels } from '../labels';

type LandSection = 'overview' | 'commissions' | 'records';

const landSections = [
  { id: 'overview', label: 'نظرة عامة', icon: MapPinned },
  { id: 'commissions', label: 'العمولات', icon: WalletCards },
  { id: 'records', label: 'السجل والمستندات', icon: FileText },
] as const;

export function LandDossierContent({ landId, section }: Readonly<{ landId: string; section?: LandSection }>) {
  const { canAccess } = useAuth();
  const companyFormatters = useCompanyFormatters();
  const query = useLandDossier(landId, canAccess('commissions.view'), canAccess('communication.view'));
  const dossier = query.data;
  if (query.isLoading) return <LoadingState label="جارٍ تحميل ملف الأرض" />;
  if (query.isError) return <ErrorState title="تعذر تحميل ملف الأرض" error={query.error} onRetry={() => { void query.refetch(); }} />;
  if (!dossier) return null;
  const land = dossier.land;
  const ownerName = dossier.owner?.display_name?.trim() || dossier.owner?.full_name?.trim() || 'غير مرتبط بمالك';
  return (
    <div className="space-y-5">
      {(!section || section === 'overview') ? <Card><CardHeader><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><MapPinned className="size-6" /></span><div><CardTitle>{land.name || land.plot_no || 'أرض مسجلة'}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{land.location || 'الموقع غير موثق'}</p></div></div></CardHeader><CardContent><DetailFields columns={3} fields={[
        { label: 'رقم القطعة', value: land.plot_no ?? 'غير موثق' },
        { label: 'التصنيف', value: landCategoryLabels[land.category ?? ''] ?? land.category ?? '—' },
        { label: 'الحالة', value: <StatusBadge tone={land.status === 'available' ? 'success' : land.status === 'reserved' ? 'warning' : 'neutral'}>{landStatusLabels[land.status ?? ''] ?? land.status ?? '—'}</StatusBadge> },
        { label: 'المساحة', value: land.area == null ? 'غير موثقة' : `${land.area} م²` },
        { label: 'المالك', value: dossier.owner ? <Link to="/owners/$ownerId" params={{ ownerId: dossier.owner.id }} className="text-primary underline-offset-4 hover:underline">{ownerName}</Link> : ownerName },
        { label: 'سعر المالك', value: land.owner_price == null ? 'غير موثق' : companyFormatters.money(land.owner_price) },
        { label: 'سعر الشراء', value: land.purchase_price == null ? 'غير موثق' : companyFormatters.money(land.purchase_price) },
        { label: 'ملاحظات', value: land.notes ?? '—', wide: true },
      ]} /></CardContent></Card> : null}

      {(!section || section === 'commissions') && canAccess('commissions.view') ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="size-5 text-primary" />العمولات المرتبطة</CardTitle></CardHeader><CardContent>{dossier.commissions.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد عمولات مرتبطة بهذه الأرض.</p> : <ul className="space-y-2">{dossier.commissions.map((commission) => <li key={commission.id} className="flex items-center justify-between rounded-xl border p-3"><span>{commission.staff_name || 'وسيط مسجل'}</span><span dir="ltr" className="tabular-nums">{companyFormatters.money(commission.amount ?? 0)} · {commission.status}</span></li>)}</ul>}</CardContent></Card> : null}
      {(!section || section === 'records') && canAccess('communication.view') ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-5 text-primary" />آخر النشاط</CardTitle></CardHeader><CardContent>{dossier.latestActivity.length === 0 ? <p className="text-sm text-muted-foreground">لا يوجد نشاط موثق مرتبط بهذه الأرض.</p> : <ul className="space-y-2">{dossier.latestActivity.map((item) => <li key={item.id} className="rounded-xl border p-3"><p className="font-bold">{item.subject || 'متابعة مسجلة'}</p><p className="mt-1 text-sm text-muted-foreground">{item.body}</p><p className="mt-1 text-xs text-muted-foreground">{formatCompanyDateTime(companyFormatters, item.created_at)}</p></li>)}</ul>}</CardContent></Card> : null}
      {(!section || section === 'records') ? <ContextualDocumentsSection entityType="land" entityId={land.id} entityLabel="الأرض" /> : null}
    </div>
  );
}

export function LandPreviewDialog({ landId, open, onOpenChange }: Readonly<{ landId: string; open: boolean; onOpenChange: (open: boolean) => void }>) {
  return <EntityPreviewDialog open={open} onOpenChange={onOpenChange} title="ملف الأرض" description="البيانات والملكية والعمولات والنشاط والمستندات حسب الصلاحية."><LandDossierContent landId={landId} /></EntityPreviewDialog>;
}

export function LandDetailPage({ landId }: Readonly<{ landId: string }>) {
  const [activeSection, setActiveSection] = useState<LandSection>('overview');

  return (
    <PageLayout dir="rtl" size="wide" visualVariant="malek-pro">
      <EntityDetailHeader title="ملف الأرض" subtitle="بيانات الأرض وعلاقاتها وعمولاتها ومستنداتها." backTo="/lands" backLabel="الأراضي" />
      <SectionTabs items={landSections} activeId={activeSection} onChange={setActiveSection} ariaLabel="أقسام ملف الأرض" panelId="land-detail-panel" idPrefix="land-detail" compactMobile />
      <div id="land-detail-panel" role="tabpanel" aria-labelledby={`land-detail-tab-${activeSection}`}>
        <LandDossierContent landId={landId} section={activeSection} />
      </div>
    </PageLayout>
  );
}
