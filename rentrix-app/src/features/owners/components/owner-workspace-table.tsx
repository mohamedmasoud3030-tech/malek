import { Eye, LinkIcon, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { EmptyState } from '@/components/ui/state-surfaces';
import { EntityCell } from '@/components/ui/entity-cell';
import { FilterBar } from '@/components/ui/filter-bar';
import { formatLatinNumber } from '@/lib/formatters';
import type { Owner } from '../services/owner-service';
import { OwnerPreviewDialog } from './OwnerPreviewDialog';
import {
  getOwnerDisplayLabel,
  getOwnerPropertyOwnershipLabel,
  type OwnerWorkspaceRow,
} from '../utils/owner-ui-helpers';

const ownerColumnOptions = [
  { key: 'name', label: 'اسم المالك', locked: true },
  { key: 'contact', label: 'الهاتف والإيميل' },
  { key: 'property_count', label: 'عدد العقارات' },
  { key: 'property_links', label: 'العقارات' },
  { key: 'ownership', label: 'الملكية/الدور' },
  { key: 'contracts', label: 'العقود النشطة' },
  { key: 'actions', label: 'الإجراءات', locked: true },
] as const;

const defaultOwnerColumns = ownerColumnOptions.map((column) => column.key);

function OwnerContact({ owner }: Readonly<{ owner: Owner }>) {
  return (
    <div className="space-y-1 text-sm">
      <div dir="ltr" className="text-end">{owner.phone ?? '—'}</div>
      <div dir="ltr" className="text-end text-muted-foreground">{owner.email ?? '—'}</div>
    </div>
  );
}

function OwnerPropertyLinks({ row }: Readonly<{ row: OwnerWorkspaceRow }>) {
  const navigate = useNavigate();
  if (!row.properties.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {row.properties.map((property) => (
        <Button
          key={`${row.owner.id}-${property.id}`}
          variant="secondary"
          size="sm"
          onClick={() => void navigate({ to: '/properties/$propertyId', params: { propertyId: property.id } })}
        >
          {property.title}
        </Button>
      ))}
    </div>
  );
}

function OwnershipSummary({ row }: Readonly<{ row: OwnerWorkspaceRow }>) {
  if (!row.properties.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      {row.properties.map((property) => (
        <div key={`${row.owner.id}-${property.id}-ownership`}>{getOwnerPropertyOwnershipLabel(property)}</div>
      ))}
    </div>
  );
}

export type OwnerWorkspaceTableProps = Readonly<{
  rows: OwnerWorkspaceRow[];
  search: string;
  selectedOwner: Owner | null;
  onCreateOwner: () => void;
  onEditOwner: (owner: Owner) => void;
  onSearchChange: (search: string) => void;
  onSelectOwner: (ownerId: string) => void;
}>;

export function OwnerWorkspaceTable({
  rows,
  search,
  selectedOwner: _selectedOwner,
  onCreateOwner,
  onEditOwner,
  onSearchChange,
  onSelectOwner,
}: OwnerWorkspaceTableProps) {
  const [previewOwnerId, setPreviewOwnerId] = useState<string | null>(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultOwnerColumns]);
  const hasSearch = Boolean(search.trim());
  const emptyState = (
    <EmptyState
      title={hasSearch ? 'لا توجد نتائج مطابقة' : 'لا يوجد ملاك'}
      description={hasSearch ? 'جرّب البحث باسم أو هاتف أو بريد أو اسم عقار آخر.' : 'أضف أول مالك لبدء ربطه بالعقارات.'}
      action={hasSearch ? undefined : <Button onClick={onCreateOwner}>إضافة مالك</Button>}
    />
  );

  const openPreview = (ownerId: string) => setPreviewOwnerId(ownerId);

  const columns = useMemo((): ColumnDef<OwnerWorkspaceRow>[] => [
    {
      key: 'name',
      header: 'اسم المالك',
      priority: 'identity',
      render: (row) => (
        <EntityCell
          title={<span className="font-bold">{getOwnerDisplayLabel(row.owner)}</span>}
          subtitle={row.owner.display_name ? row.owner.full_name : null}
        />
      ),
    },
    { key: 'contact', header: 'الهاتف والإيميل', priority: 'secondary', render: (row) => <OwnerContact owner={row.owner} /> },
    { key: 'property_count', header: 'عدد العقارات', priority: 'secondary', render: (row) => formatLatinNumber(row.propertyCount, 'ar') },
    { key: 'property_links', header: 'العقارات', priority: 'detail', render: (row) => <OwnerPropertyLinks row={row} /> },
    { key: 'ownership', header: 'الملكية/الدور', priority: 'detail', render: (row) => <OwnershipSummary row={row} /> },
    {
      key: 'contracts',
      header: 'العقود النشطة',
      priority: 'primary',
      render: (row) => (row.activeContractCount > 0 ? formatLatinNumber(row.activeContractCount, 'ar') : '—'),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      priority: 'actions',
      render: (row) => (
        <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <ActionMenu
            label={`إجراءات ${getOwnerDisplayLabel(row.owner)}`}
            items={[
              { id: 'preview', label: 'معاينة', icon: Eye, onClick: () => openPreview(row.owner.id) },
              { id: 'relationships', label: 'العلاقات', icon: LinkIcon, onClick: () => onSelectOwner(row.owner.id) },
              { id: 'edit', label: 'تعديل', icon: Pencil, onClick: () => onEditOwner(row.owner) },
            ]}
          />
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-3" data-owner-workspace-table>
      <FilterBar
        searchValue={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="بحث باسم المالك أو الهاتف أو الإيميل أو العقار"
        searchAriaLabel="بحث في الملاك"
        actions={(
          <DataTableColumnsMenu
            columns={ownerColumnOptions}
            visibleKeys={visibleColumnKeys}
            onChange={setVisibleColumnKeys}
          />
        )}
      />
      {rows.length > 0 ? (
        <EntityTable
          aria-label="جدول الملاك"
          rows={rows}
          onRowClick={(row) => openPreview(row.owner.id)}
          columns={columns}
          visibleColumnKeys={visibleColumnKeys}
          mobileCardType="owner"
          mobileSupportingKey="contact"
          mobilePrimaryMetaKeys={['contracts', 'property_count']}
          mobileSecondaryMetaKeys={['ownership']}
          mobileCardActions={(row) => [
            {
              label: 'العلاقات',
              icon: LinkIcon,
              variant: 'secondary',
              onClick: () => onSelectOwner(row.owner.id),
              ariaLabel: `علاقات ${getOwnerDisplayLabel(row.owner)}`,
            },
            {
              label: 'تعديل',
              icon: Pencil,
              variant: 'secondary',
              onClick: () => onEditOwner(row.owner),
              ariaLabel: `تعديل ${getOwnerDisplayLabel(row.owner)}`,
            },
          ]}
          keyOf={(row) => row.owner.id}
          emptyTitle="لا يوجد ملاك"
          emptyDescription="أضف أول مالك لبدء ربطه بالعقارات."
        />
      ) : emptyState}

      <OwnerPreviewDialog
        ownerId={previewOwnerId}
        open={Boolean(previewOwnerId)}
        onOpenChange={(open) => { if (!open) setPreviewOwnerId(null); }}
      />
    </div>
  );
}
