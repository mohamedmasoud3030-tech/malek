import { Eye, LinkIcon, Pencil } from 'lucide-react';
import { useState } from 'react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { EmptyState } from '@/components/ui/state-surfaces';
import { EntityCell } from '@/components/ui/entity-cell';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { DetailFields } from '@/components/ui/detail-fields';
import { FilterBar } from '@/components/ui/filter-bar';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatLatinNumber } from '@/lib/formatters';
import type { Owner } from '../services/owner-service';
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
      <div dir="ltr" className="text-right">{owner.phone ?? '—'}</div>
      <div dir="ltr" className="text-right text-muted-foreground">{owner.email ?? '—'}</div>
    </div>
  );
}

function OwnerPropertyLinks({ row }: Readonly<{ row: OwnerWorkspaceRow }>) {
  const navigate = useNavigate();
  const location = useLocation();
  if (!row.properties.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {row.properties.map((property) => (
        <Button
          key={`${row.owner.id}-${property.id}`}
          variant="secondary"
          size="sm"
          onClick={() => (navigate as unknown as (opts: unknown) => void)({ to: '/properties/$propertyId', params: { propertyId: property.id }, state: { backgroundLocation: location } as unknown as Record<string, unknown> })}
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
  const navigate = useNavigate();
  const location = useLocation();
  const [previewOwnerId, setPreviewOwnerId] = useState<string | null>(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultOwnerColumns]);
  const previewRow = rows.find((row) => row.owner.id === previewOwnerId) ?? null;
  const hasSearch = Boolean(search.trim());
  const emptyState = (
    <EmptyState
      title={hasSearch ? 'لا توجد نتائج مطابقة' : 'لا يوجد ملاك'}
      description={hasSearch ? 'جرّب البحث باسم أو هاتف أو بريد أو اسم عقار آخر.' : 'أضف أول مالك لبدء ربطه بالعقارات.'}
      action={hasSearch ? undefined : <Button onClick={onCreateOwner}>إضافة مالك</Button>}
    />
  );

  const openPreview = (ownerId: string) => setPreviewOwnerId(ownerId);
  const editFromPreview = () => {
    if (!previewRow) return;
    setPreviewOwnerId(null);
    onEditOwner(previewRow.owner);
  };

  const columns: ColumnDef<OwnerWorkspaceRow>[] = [
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
              { id: 'details', label: 'التفاصيل', icon: Eye, onClick: () => openPreview(row.owner.id) },
              { id: 'relationships', label: 'العلاقات', icon: LinkIcon, onClick: () => onSelectOwner(row.owner.id) },
              { id: 'edit', label: 'تعديل', icon: Pencil, onClick: () => onEditOwner(row.owner) },
            ]}
          />
        </div>
      ),
    },
  ];

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
          mobileSummaryKeys={['contact', 'property_count']}
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

      <EntityPreviewDialog
        open={Boolean(previewRow)}
        onOpenChange={(open) => { if (!open) setPreviewOwnerId(null); }}
        title={previewRow ? getOwnerDisplayLabel(previewRow.owner) : 'معاينة المالك'}
        description="بيانات المالك وعلاقاته الأساسية بدون مغادرة سجل الملاك."
        actions={previewRow ? <Button onClick={editFromPreview}><Pencil className="me-2 size-4" />تعديل</Button> : undefined}
      >
        {previewRow ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <DetailFields
                columns={3}
                fields={[
                  { label: 'الاسم', value: getOwnerDisplayLabel(previewRow.owner) },
                  { label: 'الهاتف', value: previewRow.owner.phone ? <span dir="ltr">{previewRow.owner.phone}</span> : '—' },
                  { label: 'البريد الإلكتروني', value: previewRow.owner.email ? <span dir="ltr">{previewRow.owner.email}</span> : '—' },
                  { label: 'الحالة', value: <StatusBadge tone={previewRow.owner.is_active ? 'success' : 'neutral'}>{previewRow.owner.is_active ? 'نشط' : 'غير نشط'}</StatusBadge> },
                  { label: 'عدد العقارات', value: formatLatinNumber(previewRow.propertyCount, 'ar') },
                  { label: 'العقود النشطة', value: formatLatinNumber(previewRow.activeContractCount, 'ar') },
                ]}
              />
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h4 className="font-black">العقارات المرتبطة</h4>
              {previewRow.properties.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {previewRow.properties.map((property) => (
                    <button
                      key={property.id}
                      type="button"
                      onClick={() => (navigate as unknown as (opts: unknown) => void)({ to: '/properties/$propertyId', params: { propertyId: property.id }, state: { backgroundLocation: location } as unknown as Record<string, unknown> })}
                      className="rounded-xl border border-border/60 bg-muted/20 p-4 text-start transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                    >
                      <p className="font-bold">{property.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{getOwnerPropertyOwnershipLabel(property)}</p>
                    </button>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-muted-foreground">لا توجد عقارات مرتبطة بهذا المالك.</p>}
            </div>
          </div>
        ) : null}
      </EntityPreviewDialog>
    </div>
  );
}
