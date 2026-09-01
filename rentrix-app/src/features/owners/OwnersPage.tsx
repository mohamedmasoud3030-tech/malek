import { Building2, LinkIcon, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { EntityForm } from '@/components/ui/entity-form';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import { AsyncContentState } from '@/components/async-content-state';
import { OwnerFormDialog } from './components/owner-form-dialog';
import { OwnerRelationshipsList, OwnershipLinkForm } from './components/owner-relationships';
import { OwnerWorkspaceTable } from './components/owner-workspace-table';
import { getOwnerDisplayLabel } from './utils/owner-ui-helpers';
import { getOwnerPageErrorMessage, useOwnersPageController } from './useOwnersPageController';
import { formatCount } from '@/lib/formatters';

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
      title="إدارة الملاك"
      count={formatCount(controller.summary.totalOwners)}
      primaryAction={(
        <Button className="min-h-11" onClick={controller.openCreateForm}>
          <Plus className="me-2 size-4" />
          إضافة مالك
        </Button>
      )}
    >
      <section data-owner-summary aria-label="ملخص الملاك والملكية">
        <RegisterMetricStrip
          aria-label="ملخص الملاك والملكية"
          items={[
            { id: 'total', label: 'الملاك', value: formatCount(controller.summary.totalOwners), icon: Users },
            { id: 'active', label: 'نشطون', value: formatCount(controller.summary.activeOwners), icon: Users, tone: 'success' },
            { id: 'coverage', label: 'تغطية الربط', value: `${formatCount(linkedCoverage)}%`, hint: `${formatCount(controller.summary.linkedPropertiesCount)} عقار`, icon: LinkIcon },
            { id: 'unlinked', label: 'بلا مالك', value: formatCount(controller.summary.propertiesWithoutLinkedOwner), icon: Building2, tone: 'warning', hideWhenEmpty: true },
          ]}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(22rem,0.82fr)]">
        <section data-owner-register className="min-w-0">
          <OwnerWorkspaceTable
            rows={controller.filteredOwnerRows}
            search={controller.ownerSearch}
            selectedOwner={controller.selectedOwner}
            onCreateOwner={controller.openCreateForm}
            onEditOwner={controller.openEditForm}
            onSearchChange={controller.setOwnerSearch}
            onSelectOwner={controller.setSelectedOwnerId}
          />
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
