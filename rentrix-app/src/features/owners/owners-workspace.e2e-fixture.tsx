import { useMemo, useState } from 'react';
import { Building2, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { ListPage } from '@/components/layout/list-page';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import { formatCount } from '@/lib/formatters';
import {
  defaultOwnerColumns,
  ownerColumnOptions,
  OwnerWorkspaceTable,
} from './components/owner-workspace-table';
import type { OwnerWorkspaceRow } from './utils/owner-ui-helpers';
import { ownerRowFixtureDefaults } from '@/test/ownerRowFixture';

const owners: OwnerWorkspaceRow[] = [
  {
    owner: {
      ...ownerRowFixtureDefaults,
      id: 'owner-fixture-1',
      full_name: 'محمد الكندي',
      display_name: 'أبو سالم',
      phone: '+968 9911 2233',
      email: 'owner1@example.test',
      national_id: null,
      tax_number: null,
      address: 'مسقط',
      notes: null,
      is_active: true,
      created_at: '2026-06-01T00:00:00.000Z',
      updated_at: '2026-06-01T00:00:00.000Z',
    },
    propertyCount: 2,
    activeContractCount: 3,
    propertyNames: 'برج الخليج، واحة مسقط',
  },
  {
    owner: {
      ...ownerRowFixtureDefaults,
      id: 'owner-fixture-2',
      full_name: 'سالم الرواحي',
      display_name: null,
      phone: '+968 9922 3344',
      email: null,
      national_id: null,
      tax_number: null,
      address: 'السيب',
      notes: null,
      is_active: true,
      created_at: '2026-06-02T00:00:00.000Z',
      updated_at: '2026-06-02T00:00:00.000Z',
    },
    propertyCount: 1,
    activeContractCount: 1,
    propertyNames: 'مجمع الخوير',
  },
  {
    owner: {
      ...ownerRowFixtureDefaults,
      id: 'owner-fixture-3',
      full_name: 'خالد البلوشي',
      display_name: null,
      phone: null,
      email: 'owner3@example.test',
      national_id: null,
      tax_number: null,
      address: 'بوشر',
      notes: null,
      is_active: false,
      created_at: '2026-06-03T00:00:00.000Z',
      updated_at: '2026-06-03T00:00:00.000Z',
    },
    propertyCount: 0,
    activeContractCount: 0,
    propertyNames: '',
  },
];

export function OwnersWorkspaceE2EFixture() {
  const [search, setSearch] = useState('');
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultOwnerColumns]);
  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return owners;
    return owners.filter((row) => [
      row.owner.full_name,
      row.owner.display_name,
      row.owner.phone,
      row.owner.email,
      row.propertyNames,
    ].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [search]);

  return (
    <main
      className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground outline-none"
      dir="rtl"
      tabIndex={-1}
      data-e2e-owners-workspace
    >
      <ListPage
        workspaceName="owners-e2e"
        viewModeStorageKey="malek:e2e:owners"
        dir="rtl"
        title="الملاك"
        count={owners.length}
        primaryAction={(
          <Button className="min-h-11">
            <Plus className="me-2 size-4" />
            إضافة مالك
          </Button>
        )}
        search={{
          value: search,
          onChange: setSearch,
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
            { id: 'active', label: 'نشطون', value: formatCount(2), icon: Users, tone: 'success' },
            { id: 'coverage', label: 'تغطية الربط', value: '75%', hint: '3 عقارات', icon: Building2 },
            { id: 'unlinked', label: 'بلا مالك', value: formatCount(1), icon: Building2, tone: 'warning' },
          ]}
        />

        <section data-owner-register className="min-w-0 space-y-2.5">
          <OwnerWorkspaceTable
            rows={filteredRows}
            visibleColumnKeys={visibleColumnKeys}
            onCreateOwner={() => undefined}
            onEditOwner={() => undefined}
          />
        </section>
      </ListPage>
    </main>
  );
}
