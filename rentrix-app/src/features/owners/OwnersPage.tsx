import { Building2, ChevronDown, LinkIcon, Plus, Users } from 'lucide-react';
import { useState } from 'react';
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

type OwnerMobileRelationshipsProps = Readonly<{
  open: boolean;
  onToggle: () => void;
  owner: { id: string } | null;
  canLink: boolean;
  onLinkProperty: () => void;
} & Parameters<typeof OwnerRelationshipsList>[0]>;

/**
 * Progressive disclosure for the owner relationships panel on phones and
 * tablets. Desktop keeps the contextual side panel; below xl the relationships
 * start collapsed so the register itself owns the first view, and the card /
 * table «العلاقات» action opens it directly at the selected owner.
 */
function OwnerMobileRelationships({
  open,
  onToggle,
  owner,
  canLink,
  onLinkProperty,
  ...listProps
}: OwnerMobileRelationshipsProps) {
  if (!owner) return null;

  return (
    <div data-owner-relationships-mobile className="min-w-0 xl:hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-3.5 text-start outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/20"
      >
        <span className="flex min-w-0 items-center gap-2">
          <LinkIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 text-[13px] font-black text-foreground">
            علاقات الملكية
            <span className="ms-1.5 text-[11px] font-semibold text-muted-foreground">
              {listProps.linkedProperties.length > 0
                ? `${formatCount(listProps.linkedProperties.length)} عقار`
                : 'بلا عقارات مرتبطة'}
            </span>
          </span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div hidden={!open} className="space-y-3 border-s-2 border-s-primary/35 px-1 pb-1 pt-3">
        <OwnerRelationshipsList {...listProps} />
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full"
          disabled={!canLink}
          onClick={onLinkProperty}
        >
          <Plus className="me-2 size-4" />
          ربط عقار
        </Button>
      </div>
    </div>
  );
}

export type OwnersWorkspaceProps = Readonly<{
  embedded?: boolean;
}>;

export function OwnersWorkspace({ embedded = false }: OwnersWorkspaceProps) {
  const controller = useOwnersPageController();
  const [mobileRelationshipsOpen, setMobileRelationshipsOpen] = useState(false);

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
            onSelectOwner={(ownerId) => {
              controller.setSelectedOwnerId(ownerId);
              setMobileRelationshipsOpen(true);
            }}
          />
        </section>

        <OwnerMobileRelationships
          open={mobileRelationshipsOpen}
          onToggle={() => setMobileRelationshipsOpen((open) => !open)}
          owner={controller.selectedOwner}
          linkedProperties={controller.linkedProperties}
          endLinkPending={controller.unlinkPending}
          onEditLink={controller.beginEditLink}
          onEndLink={controller.handleEndPropertyOwnership}
          onLinkProperty={controller.openLinkForm}
          canLink={controller.availableProperties.length > 0}
        />

        <aside
          data-owner-relationships
          className="hidden min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card xl:block"
        >
          <header className="border-b border-border/70 bg-muted/35 px-4 py-3 sm:px-5 sm:py-4">
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

          <div className="min-h-40 p-3.5 sm:min-h-52 sm:p-5">
            {controller.selectedOwner ? (
              <OwnerRelationshipsList
                linkedProperties={controller.linkedProperties}
                endLinkPending={controller.unlinkPending}
                onEditLink={controller.beginEditLink}
                onEndLink={controller.handleEndPropertyOwnership}
              />
            ) : (
              <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-center sm:min-h-44 sm:p-6">
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
