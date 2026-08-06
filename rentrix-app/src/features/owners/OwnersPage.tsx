import { Building2, LinkIcon, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { EntityForm } from '@/components/ui/entity-form';
import { AsyncContentState } from '@/components/async-content-state';
import { OwnerFormDialog } from './components/owner-form-dialog';
import { OwnerRelationshipsList, OwnershipLinkForm } from './components/owner-relationships';
import { OwnerWorkspaceTable } from './components/owner-workspace-table';
import { getOwnerDisplayLabel } from './utils/owner-ui-helpers';
import { getOwnerPageErrorMessage, useOwnersPageController } from './useOwnersPageController';

export type OwnersWorkspaceProps = Readonly<{
  embedded?: boolean;
}>;

export function OwnersWorkspace({ embedded = false }: OwnersWorkspaceProps) {
  const c = useOwnersPageController();

  if (c.isLoading || c.hasLoadError) {
    return (
      <AsyncContentState
        status={c.isLoading ? 'loading' : 'error'}
        error={c.firstLoadError}
        errorTitle="تعذر تحميل مساحة عمل الملاك"
        errorFallbackMessage={getOwnerPageErrorMessage(c.firstLoadError, 'حدث خطأ غير متوقع أثناء تحميل الملاك والعقارات المرتبطة.')}
        errorAction={<Button type="button" onClick={c.retryOwnerWorkspace}>إعادة المحاولة</Button>}
      >
        {null}
      </AsyncContentState>
    );
  }

  return (
    <EmbeddableWorkspace
      embedded={embedded}
      dir="rtl"
      size="wide"
      visualVariant="malek-pro"
      title="إدارة الملاك"
      description="إدارة علاقات ملكية العقارات بشكل منفصل عن الحسابات والتسويات المالية."
      primaryAction={<Button className="min-h-11" onClick={c.openCreateForm}><Plus className="me-2 size-4" />إضافة مالك</Button>}
    >

      {/* KPI grid */}
      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="إجمالي الملاك" value={c.summary.totalOwners} icon={Users} accent="primary" />
        <KpiCard label="الملاك النشطون" value={c.summary.activeOwners} icon={Users} accent="emerald" />
        <KpiCard label="عقارات مرتبطة" value={c.summary.linkedPropertiesCount} icon={Building2} accent="sky" />
        <KpiCard label="عقارات بلا مالك" value={c.summary.propertiesWithoutLinkedOwner} icon={LinkIcon} accent="amber" />
      </ResponsiveCardGrid>

      {/* Workspace */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>مساحة عمل الملاك</CardTitle>
            <CardDescription>ملخص آمن من بيانات الملاك والعقارات والعقود الحالية بدون أرصدة أو تسويات افتراضية.</CardDescription>
          </CardHeader>
          <CardContent>
            <OwnerWorkspaceTable
              rows={c.filteredOwnerRows}
              search={c.ownerSearch}
              selectedOwner={c.selectedOwner}
              onCreateOwner={c.openCreateForm}
              onEditOwner={c.openEditForm}
              onSearchChange={c.setOwnerSearch}
              onSelectOwner={c.setSelectedOwnerId}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>علاقات الملكية</CardTitle>
              <CardDescription>{c.selectedOwner ? `العقارات المرتبطة بـ ${getOwnerDisplayLabel(c.selectedOwner)}` : 'اختر مالكاً لعرض علاقات الملكية.'}</CardDescription>
            </div>
            <Button className="min-h-11" type="button" variant="secondary" disabled={!c.selectedOwner || c.availableProperties.length === 0} onClick={c.openLinkForm}>
              <Plus className="me-2 size-4" />ربط عقار
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {c.selectedOwner ? (
              <div className="space-y-3">
                <OwnerRelationshipsList linkedProperties={c.linkedProperties} endLinkPending={c.unlinkPending} onEditLink={c.beginEditLink} onEndLink={c.handleEndPropertyOwnership} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <OwnerFormDialog owner={c.editingOwner} open={c.formOpen} onOpenChange={c.setFormOpen} />
      <EntityForm.Overlay
        open={c.linkFormOpen}
        onOpenChange={(open) => { if (!open) c.resetLinkForm(); else c.setLinkFormOpen(true); }}
        title={c.editingLink ? 'تعديل علاقة الملكية' : 'ربط عقار بالمالك'}
        description={c.editingLink ? 'تحديث النسبة والتواريخ دون إنشاء سجل مالي.' : 'أضف علاقة ملكية مستقلة عن اتفاقية إدارة المكتب والحسابات المالية.'}
      >
        <OwnershipLinkForm values={c.linkFormValues} availableProperties={c.availableProperties} editingLink={c.editingLink} error={c.linkFormError} isSaving={c.isSavingLink} onCancelEdit={c.resetLinkForm} onSubmit={c.handleLinkProperty} onValueChange={c.setLinkField} />
      </EntityForm.Overlay>
    </EmbeddableWorkspace>
  );
}


export function OwnersPage() {
  return <OwnersWorkspace />;
}
