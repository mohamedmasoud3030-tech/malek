import { useState } from 'react';
import { Building2, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { ListPage } from '@/components/layout/list-page';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import { AsyncContentState } from '@/components/async-content-state';
import { OwnerFormDialog } from './components/owner-form-dialog';
import {
  defaultOwnerColumns,
  ownerColumnOptions,
  OwnerWorkspaceTable,
} from './components/owner-workspace-table';
import { getOwnerPageErrorMessage, useOwnersPageController } from './useOwnersPageController';
import { formatCount } from '@/lib/formatters';

export type OwnersWorkspaceProps = Readonly<{
  embedded?: boolean;
}>;

export function OwnersWorkspace({ embedded = false }: OwnersWorkspaceProps) {
  const controller = useOwnersPageController();
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultOwnerColumns]);

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
    <>
      <ListPage
        embedded={embedded}
        workspaceName="owners"
        viewModeStorageKey="malek:list-page:owners"
        dir="rtl"
        title="الملاك"
        count={controller.summary.totalOwners}
        primaryAction={(
          <Button className="min-h-11" onClick={controller.openCreateForm}>
            <Plus className="me-2 size-4" />
            إضافة مالك
          </Button>
        )}
        search={{
          value: controller.ownerSearch,
          onChange: controller.setOwnerSearch,
          placeholder: 'بحث باسم المالك أو الهاتف أو الإيميل أو العقار',
        }}
        toolbarActions={(
          <DataTableColumnsMenu
            columns={ownerColumnOptions}
            visibleKeys={visibleColumnKeys}
            onChange={setVisibleColumnKeys}
          />
        )}
      >
        <RegisterMetricStrip
          aria-label="ملخص الملاك"
          items={[
            { id: 'active', label: 'نشطون', value: formatCount(controller.summary.activeOwners), icon: Users, tone: 'success' },
            { id: 'coverage', label: 'تغطية الربط', value: `${formatCount(linkedCoverage)}%`, hint: `${formatCount(controller.summary.linkedPropertiesCount)} عقار`, icon: Building2 },
            { id: 'unlinked', label: 'بلا مالك', value: formatCount(controller.summary.propertiesWithoutLinkedOwner), icon: Building2, tone: 'warning', hideWhenEmpty: true },
          ]}
        />

        <section data-owner-register className="min-w-0 space-y-2.5">
          <OwnerWorkspaceTable
            rows={controller.filteredOwnerRows}
            visibleColumnKeys={visibleColumnKeys}
            onCreateOwner={controller.openCreateForm}
            onEditOwner={controller.openEditForm}
          />
        </section>
      </ListPage>

      <OwnerFormDialog
        owner={controller.editingOwner}
        open={controller.formOpen}
        onOpenChange={controller.setFormOpen}
      />
    </>
  );
}

export function OwnersPage() {
  return <OwnersWorkspace />;
}
