import { Building2, LinkIcon, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { EntityForm } from '@/components/ui/entity-form';
import { OperationalCommandPanel, OperationalMetricCard } from '@/components/ui/operational-summary';
import { AsyncContentState } from '@/components/async-content-state';
import { OwnerFormDialog } from './components/owner-form-dialog';
import { OwnerRelationshipsList, OwnershipLinkForm } from './components/owner-relationships';
import { OwnerWorkspaceTable } from './components/owner-workspace-table';
import { getOwnerDisplayLabel } from './utils/owner-ui-helpers';
import { getOwnerPageErrorMessage, useOwnersPageController } from './useOwnersPageController';

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

export type OwnersWorkspaceProps = Readonly<{
  embedded?: boolean;
}>;

export function OwnersWorkspace({ embedded = false }: OwnersWorkspaceProps) {
  const controller = useOwnersPageController();

  if (controller.isLoading || controller.hasLoadError) {
    return (
      <AsyncContentState
        status={controller.isLoading ? 'loading' : 'error'}
        error={controller.firstLoadError}
        errorTitle="تعذر تحميل مساحة عمل الملاك"
        errorFallbackMessage={getOwnerPageErrorMessage(
          controller.firstLoadError,
          'حدث خطأ غير متوقع أثناء تحميل الملاك والعقارات المرتبطة.',
        )}
        errorAction={(
          <Button type="button" onClick={controller.retryOwnerWorkspace}>
            إعادة المحاولة
          </Button>
        )}
      >
        {null}
      </AsyncContentState>
    );
  }

  const totalProperties =
    controller.summary.linkedPropertiesCount +
    controller.summary.propertiesWithoutLinkedOwner;
  const linkedCoverage = totalProperties > 0
    ? Math.round((controller.summary.linkedPropertiesCount / totalProperties) * 100)
    : 0;

  return (
    <EmbeddableWorkspace
      embedded={embedded}
      dir="rtl"
      size="wide"
      visualVariant="malek-pro"
      title="إدارة الملاك"
      description="مساحة تشغيل موحدة لملفات الملاك وربط العقارات ونسب الملكية، بعيدًا عن التسويات المالية."
      count={formatCount(controller.summary.totalOwners)}
      primaryAction={(
        <Button className="min-h-11" onClick={controller.openCreateForm}>
          <Plus className="me-2 size-4" />
          إضافة مالك
        </Button>
      )}
    >
      <section
        data-owner-summary
        aria-label="ملخص الملاك والملكية"
        className="grid gap-3 lg:grid-cols-[minmax(17rem,1.05fr)_minmax(0,2fr)]"
      >
        <OperationalCommandPanel
          label="تغطية ربط العقارات"
          value={`${formatCount(linkedCoverage)}%`}
          icon={LinkIcon}
          progress={linkedCoverage}
          footer={(
            <>
              <span>{formatCount(controller.summary.linkedPropertiesCount)} مرتبطة</span>
              <span>{formatCount(controller.summary.propertiesWithoutLinkedOwner)} بلا مالك</span>
            </>
          )}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <OperationalMetricCard
            label="إجمالي الملاك"
            value={formatCount(controller.summary.totalOwners)}
            hint="كل ملفات الملاك"
            icon={Users}
          />
          <OperationalMetricCard
            label="الملاك النشطون"
            value={formatCount(controller.summary.activeOwners)}
            hint="متاحون للتشغيل والربط"
            icon={Users}
          />
          <OperationalMetricCard
            label="عقارات مرتبطة"
            value={formatCount(controller.summary.linkedPropertiesCount)}
            hint="علاقات ملكية سارية"
            icon={Building2}
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(22rem,0.82fr)]">
        <section
          data-owner-register
          className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border/70 bg-muted/35 px-4 py-4 sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-primary/9 text-primary">
                  <Users className="size-4.5" aria-hidden="true" />
                </span>
                <h2 className="text-base font-black">سجل الملاك</h2>
              </div>
              <p className="mt-1.5 max-w-2xl text-xs font-medium leading-5 text-muted-foreground">
                بيانات الملاك والعقارات المرتبطة فقط، دون أرصدة أو أرقام تسويات افتراضية.
              </p>
            </div>
          </header>
          <div className="p-3 sm:p-4">
            <OwnerWorkspaceTable
              rows={controller.filteredOwnerRows}
              search={controller.ownerSearch}
              selectedOwner={controller.selectedOwner}
              onCreateOwner={controller.openCreateForm}
              onEditOwner={controller.openEditForm}
              onSearchChange={controller.setOwnerSearch}
              onSelectOwner={controller.setSelectedOwnerId}
            />
          </div>
        </section>

        <aside
          data-owner-relationships
          className="min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card"
        >
          <header className="border-b border-border/70 bg-muted/35 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/9 text-primary">
                    <Building2 className="size-4.5" aria-hidden="true" />
                  </span>
                  <h2 className="text-base font-black">علاقات الملكية</h2>
                </div>
                <p className="mt-1.5 text-xs font-medium leading-5 text-muted-foreground">
                  {controller.selectedOwner
                    ? `العقارات المرتبطة بـ ${getOwnerDisplayLabel(controller.selectedOwner)}`
                    : 'اختر مالكًا من السجل لعرض علاقات الملكية.'}
                </p>
              </div>
              <Button
                className="min-h-11 shrink-0"
                type="button"
                variant="secondary"
                disabled={!controller.selectedOwner || controller.availableProperties.length === 0}
                onClick={controller.openLinkForm}
              >
                <Plus className="me-2 size-4" />
                ربط عقار
              </Button>
            </div>
          </header>

          <div className="min-h-52 p-4 sm:p-5">
            {controller.selectedOwner ? (
              <OwnerRelationshipsList
                linkedProperties={controller.linkedProperties}
                endLinkPending={controller.unlinkPending}
                onEditLink={controller.beginEditLink}
                onEndLink={controller.handleEndPropertyOwnership}
              />
            ) : (
              <div className="grid min-h-44 place-items-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center">
                <div>
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/9 text-primary">
                    <LinkIcon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-black">لم يتم اختيار مالك</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    اختر سجلًا من القائمة لعرض العقارات ونسب الملكية.
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <OwnerFormDialog
        owner={controller.editingOwner}
        open={controller.formOpen}
        onOpenChange={controller.setFormOpen}
      />

      <EntityForm.Overlay
        open={controller.linkFormOpen}
        onOpenChange={(open) => {
          if (!open) controller.resetLinkForm();
          else controller.setLinkFormOpen(true);
        }}
        title={controller.editingLink ? 'تعديل علاقة الملكية' : 'ربط عقار بالمالك'}
        description={controller.editingLink
          ? 'تحديث النسبة والتواريخ دون إنشاء سجل مالي.'
          : 'أضف علاقة ملكية مستقلة عن اتفاقية إدارة المكتب والحسابات المالية.'}
      >
        <OwnershipLinkForm
          values={controller.linkFormValues}
          availableProperties={controller.availableProperties}
          editingLink={controller.editingLink}
          error={controller.linkFormError}
          isSaving={controller.isSavingLink}
          onCancelEdit={controller.resetLinkForm}
          onSubmit={controller.handleLinkProperty}
          onValueChange={controller.setLinkField}
        />
      </EntityForm.Overlay>
    </EmbeddableWorkspace>
  );
}

export function OwnersPage() {
  return <OwnersWorkspace />;
}
