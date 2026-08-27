import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { BriefcaseBusiness, Edit, FolderCog, Mail, MapPin, Phone, Wrench } from 'lucide-react';
import { AsyncContentState } from '@/components/async-content-state';
import { ContextualDocumentsSection } from '@/components/documents/contextual-documents-section';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailFields } from '@/components/ui/detail-fields';
import { EntityTable } from '@/components/ui/entity-table';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { SectionTabPanel, SectionTabs } from '@/components/ui/section-tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { useDialogNavigate } from '@/app/router/background-location';
import { useAuth } from '@/hooks/use-auth';
import { useServiceProviderDossier } from './use-service-providers';
import { formatCount } from '@/lib/formatters';

const maintenanceStatusLabels: Record<string, string> = { open: 'مفتوح', in_progress: 'قيد التنفيذ', resolved: 'تم الحل', closed: 'مغلق' };
const maintenancePriorityLabels: Record<string, string> = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', urgent: 'عاجلة' };

function statusTone(status: string | null): 'info' | 'warning' | 'success' | 'neutral' {
  if (status === 'open') return 'info';
  if (status === 'in_progress') return 'warning';
  if (status === 'resolved') return 'success';
  return 'neutral';
}


type ProviderSection = 'overview' | 'operations' | 'documents';

const providerSections = [
  { id: 'overview', label: 'نظرة عامة', icon: BriefcaseBusiness },
  { id: 'operations', label: 'التشغيل', icon: Wrench },
  { id: 'documents', label: 'المستندات', icon: FolderCog },
] as const;

export function ServiceProviderDetailPage() {
  const params = useParams({ strict: false }) as { providerId?: string };
  const providerId = params.providerId ?? '';
  const dossierQuery = useServiceProviderDossier(providerId);
  const auth = useAuth();
  const navigate = useNavigate();
  const dialogNavigate = useDialogNavigate();
  const canWrite = auth.canAccess('service_providers.write');
  const [activeSection, setActiveSection] = useState<ProviderSection>('overview');

  if (!providerId) {
    return <AsyncContentState status="empty" emptyTitle="ملف مزود الخدمة غير متاح" emptyDescription="معرف مزود الخدمة غير موجود في الرابط.">{null}</AsyncContentState>;
  }
  if (dossierQuery.isLoading) return <AsyncContentState status="loading">{null}</AsyncContentState>;
  if (dossierQuery.isError || !dossierQuery.data) {
    return (
      <AsyncContentState
        status="error"
        error={dossierQuery.error}
        errorTitle="تعذر تحميل ملف مزود الخدمة"
        errorFallbackMessage="تعذر تحميل بيانات مزود الخدمة وسجل الصيانة المرتبط."
        errorAction={<Button type="button" onClick={() => void dossierQuery.refetch()}>إعادة المحاولة</Button>}
      >{null}</AsyncContentState>
    );
  }

  const { provider, maintenanceJobs } = dossierQuery.data;
  const openJobs = maintenanceJobs.filter((job) => job.status === 'open' || job.status === 'in_progress').length;
  const resolvedJobs = maintenanceJobs.filter((job) => job.status === 'resolved' || job.status === 'closed').length;

  return (
    <PageLayout dir="rtl" size="wide" visualVariant="malek-pro">
      <EntityDetailHeader
        title={provider.name}
        subtitle="ملف مزود الخدمة وبيانات التواصل والتغطية وأنواع الخدمات وأعمال الصيانة والمستندات."
        backTo="/service-providers"
        backLabel="مزودو الخدمات"
        status={<StatusBadge tone={provider.is_active ? 'success' : 'neutral'} dot>{provider.is_active ? 'نشط' : 'غير نشط'}</StatusBadge>}
        actions={canWrite ? <Button className="min-h-11" onClick={() => dialogNavigate({ to: '/service-providers/$providerId/edit', params: { providerId: provider.id } })}><Edit className="me-2 size-4" aria-hidden="true" />تعديل</Button> : undefined}
      />

      <SectionTabs
        items={providerSections}
        activeId={activeSection}
        onChange={setActiveSection}
        ariaLabel="أقسام ملف مزود الخدمة"
        compactMobile
      />

      <SectionTabPanel id="overview" activeId={activeSection}>
      <div className="space-y-5" data-provider-detail-overview>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><BriefcaseBusiness className="size-6" aria-hidden="true" /></span>
              <div><CardTitle>{provider.legal_name ?? provider.name}</CardTitle><CardDescription>الهوية القانونية والتشغيلية المسجلة للمزود.</CardDescription></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DetailFields columns={3} fields={[
            { label: 'الاسم التشغيلي', value: provider.name },
            { label: 'الاسم القانوني', value: provider.legal_name ?? 'غير موثق' },
            { label: 'رقم السجل التجاري', value: provider.registration_number ? <span dir="ltr">{provider.registration_number}</span> : 'غير موثق' },
            { label: 'الرقم الضريبي', value: provider.tax_number ? <span dir="ltr">{provider.tax_number}</span> : 'غير موثق' },
            { label: 'العنوان', value: provider.address ?? 'غير موثق', wide: true },
            { label: 'ملاحظات', value: provider.notes ?? '—', wide: true },
          ]} />
        </CardContent>
      </Card>

      <ResponsiveCardGrid>
        <KpiCard label="أنواع الخدمات" value={formatCount(provider.categories.length)} icon={FolderCog} accent="primary" />
        <KpiCard label="إجمالي أعمال الصيانة" value={formatCount(maintenanceJobs.length)} icon={Wrench} accent="sky" />
        <KpiCard label="أعمال جارية" value={formatCount(openJobs)} icon={Wrench} accent="amber" />
        <KpiCard label="أعمال مكتملة" value={formatCount(resolvedJobs)} icon={Wrench} accent="emerald" />
      </ResponsiveCardGrid>

      </div>
      </SectionTabPanel>

      <SectionTabPanel id="operations" activeId={activeSection}>
      <div className="space-y-5" data-provider-detail-operations>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>التواصل</CardTitle><CardDescription>قنوات التنسيق المسجلة لفريق التشغيل.</CardDescription></CardHeader>
          <CardContent>
            <DetailFields columns={2} fields={[
              { label: 'جهة الاتصال', value: provider.contact_name ?? 'غير موثقة' },
              { label: 'الهاتف', value: provider.phone ? <a dir="ltr" className="inline-flex items-center gap-1 text-primary hover:underline" href={`tel:${provider.phone}`}><Phone className="size-4" aria-hidden="true" />{provider.phone}</a> : 'غير موثق' },
              { label: 'هاتف بديل', value: provider.alternate_phone ? <span dir="ltr">{provider.alternate_phone}</span> : 'غير موثق' },
              { label: 'البريد', value: provider.email ? <a dir="ltr" className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${provider.email}`}><Mail className="size-4" aria-hidden="true" />{provider.email}</a> : 'غير موثق' },
              { label: 'الموقع الإلكتروني', value: provider.website ? <a dir="ltr" className="break-all text-primary hover:underline" href={provider.website} target="_blank" rel="noopener noreferrer">{provider.website}</a> : 'غير موثق', wide: true },
            ]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>التشغيل والتغطية</CardTitle><CardDescription>المعلومات المستخدمة عند اختيار المزود لطلب صيانة.</CardDescription></CardHeader>
          <CardContent>
            <DetailFields columns={2} fields={[
              { label: 'نطاق الخدمة', value: provider.service_area ? <span className="inline-flex items-start gap-1"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{provider.service_area}</span> : 'غير موثق', wide: true },
              { label: 'ملاحظات التوفر', value: provider.availability_notes ?? 'غير موثقة', wide: true },
            ]} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>أنواع الخدمات المدعومة</CardTitle><CardDescription>الأنواع المعرفة في السجل القابل للصيانة والمستخدمة لتصفية المزودين داخل طلب الصيانة.</CardDescription></CardHeader>
        <CardContent>
          {provider.categories.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">لم تُربط أنواع خدمات بهذا المزود بعد.</p> : <div className="flex flex-wrap gap-2">{provider.categories.map((category) => <StatusBadge key={category.id} tone="info">{category.name}</StatusBadge>)}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>سجل أعمال الصيانة</CardTitle><CardDescription>كل طلبات الصيانة المرتبطة فعليًا بهذا المزود داخل الشركة الحالية.</CardDescription></CardHeader>
        <CardContent>
          <EntityTable
            aria-label="أعمال صيانة مزود الخدمة"
            rows={[...maintenanceJobs]}
            columns={[
              { key: 'title', priority: 'identity' as const, header: 'الطلب', render: (job) => <div><p className="font-bold">{job.title ?? 'طلب صيانة'}</p><p className="text-xs text-muted-foreground" dir="ltr">{job.reference ?? ''}</p></div> },
              { key: 'location', priority: 'secondary' as const, header: 'الموقع', render: (job) => `${job.properties?.title ?? 'عقار غير محدد'}${job.units?.unit_number ? ` / ${job.units.unit_number}` : ''}` },
              { key: 'category', priority: 'detail' as const, header: 'نوع الخدمة', render: (job) => job.category?.name ?? 'غير محدد' },
              { key: 'priority', priority: 'secondary' as const, header: 'الأولوية', render: (job) => maintenancePriorityLabels[job.priority ?? ''] ?? job.priority ?? '—' },
              { key: 'status', priority: 'primary' as const, header: 'الحالة', render: (job) => <StatusBadge tone={statusTone(job.status)}>{maintenanceStatusLabels[job.status ?? ''] ?? job.status ?? '—'}</StatusBadge> },
            ]}
            keyOf={(job) => job.id}
            emptyTitle="لا توجد أعمال صيانة مرتبطة"
            emptyDescription="سيظهر هنا سجل الطلبات بعد تعيين هذا المزود من مساحة الصيانة."
            onRowClick={(job) => void navigate({ to: '/maintenance', search: (previous: Record<string, unknown>) => ({ ...previous, section: 'maintenance', requestId: job.id }) })}
          />
        </CardContent>
      </Card>

      </div>
      </SectionTabPanel>

      <SectionTabPanel id="documents" activeId={activeSection}>
      <Card data-provider-detail-documents>
        <CardHeader><CardTitle>المستندات والمرفقات</CardTitle><CardDescription>المستندات محفوظة في منصة المستندات المشتركة ومربوطة بملف المزود.</CardDescription></CardHeader>
        <CardContent><ContextualDocumentsSection entityType="service_provider" entityId={provider.id} entityLabel="مزود الخدمة" /></CardContent>
      </Card>
      </SectionTabPanel>
    </PageLayout>
  );
}
