import { Link } from '@tanstack/react-router';
import { Building2, Eye, LinkIcon, Pencil, Users } from 'lucide-react';
import { useState } from 'react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/empty-state';
import { EntityCell } from '@/components/ui/entity-cell';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { DetailFields } from '@/components/ui/detail-fields';
import { FilterBar } from '@/components/ui/filter-bar';
import { MobileCard } from '@/components/ui/mobile-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatLatinNumber } from '@/lib/formatters';
import type { Owner } from '../services/owner-service';
import {
  getOwnerDisplayLabel,
  getOwnerPropertyOwnershipLabel,
  type OwnerWorkspaceRow,
} from '../utils/owner-ui-helpers';

function OwnerContact({ owner }: Readonly<{ owner: Owner }>) {
  return (
    <div className="space-y-1 text-sm">
      <div dir="ltr" className="text-right">{owner.phone ?? '—'}</div>
      <div dir="ltr" className="text-right text-muted-foreground">{owner.email ?? '—'}</div>
    </div>
  );
}

function OwnerPropertyLinks({ row }: Readonly<{ row: OwnerWorkspaceRow }>) {
  if (!row.properties.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {row.properties.map((property) => (
        <Button key={`${row.owner.id}-${property.id}`} variant="secondary" size="sm" asChild>
          <Link to="/properties/$propertyId" params={{ propertyId: property.id }}>{property.title}</Link>
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

  return (
    <div className="space-y-4">
      <FilterBar
        searchValue={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="بحث باسم المالك أو الهاتف أو الإيميل أو العقار"
        searchAriaLabel="بحث في الملاك"
      />
      {rows.length > 0 ? (
        <DataTable
          aria-label="جدول الملاك"
          rows={rows}
          onRowClick={(row) => openPreview(row.owner.id)}
          columns={[
            {
              key: 'name',
              header: 'اسم المالك',
              render: (row) => (
                <EntityCell
                  icon={Users}
                  title={(
                    <Button variant="link" className="min-h-11 px-0 text-start font-bold" onClick={() => openPreview(row.owner.id)}>
                      {getOwnerDisplayLabel(row.owner)}
                    </Button>
                  )}
                  subtitle={row.owner.display_name ? row.owner.full_name : null}
                />
              ),
            },
            { key: 'contact', header: 'الهاتف والإيميل', render: (row) => <OwnerContact owner={row.owner} /> },
            { key: 'property_count', header: 'عدد العقارات', render: (row) => formatLatinNumber(row.propertyCount, 'ar') },
            { key: 'property_links', header: 'العقارات', render: (row) => <OwnerPropertyLinks row={row} /> },
            { key: 'ownership', header: 'الملكية/الدور', render: (row) => <OwnershipSummary row={row} /> },
            { key: 'contracts', header: 'العقود النشطة', render: (row) => row.activeContractCount > 0 ? formatLatinNumber(row.activeContractCount, 'ar') : '—' },
            {
              key: 'actions',
              header: 'إجراءات',
              render: (row) => (
                <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                  <ActionMenu
                    label={`إجراءات ${getOwnerDisplayLabel(row.owner)}`}
                    items={[
                      { id: 'details', label: 'معاينة', icon: Eye, onClick: () => openPreview(row.owner.id) },
                      { id: 'relationships', label: 'العلاقات', icon: LinkIcon, onClick: () => onSelectOwner(row.owner.id) },
                      { id: 'edit', label: 'تعديل', icon: Pencil, onClick: () => onEditOwner(row.owner) },
                    ]}
                  />
                </div>
              ),
            },
          ]}
          keyOf={(row) => row.owner.id}
          emptyTitle="لا يوجد ملاك"
          emptyDescription="أضف أول مالك لبدء ربطه بالعقارات."
          enableViewModeToggle
          viewModeStorageKey="rentrix:view-mode:owners"
          renderMobileCard={(row) => (
            <MobileCard
              title={getOwnerDisplayLabel(row.owner)}
              subtitle={row.owner.display_name ? row.owner.full_name : 'مالك'}
              badge={<StatusBadge tone={row.owner.is_active ? 'success' : 'neutral'} dot>{row.owner.is_active ? 'نشط' : 'غير نشط'}</StatusBadge>}
              meta={(
                <div className="space-y-1 text-xs text-muted-foreground">
                  {row.owner.phone ? <p dir="ltr">{row.owner.phone}</p> : null}
                  {row.owner.email ? <p dir="ltr" className="truncate">{row.owner.email}</p> : null}
                </div>
              )}
              stats={(
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span><Building2 className="me-1 inline size-3.5" />{formatLatinNumber(row.propertyCount, 'ar')} عقار</span>
                  <span className="font-bold text-primary">{formatLatinNumber(row.activeContractCount, 'ar')} عقد نشط</span>
                </div>
              )}
              actions={(
                <div className="grid w-full grid-cols-3 gap-2">
                  <Button variant="secondary" className="text-xs" onClick={() => openPreview(row.owner.id)}><Eye className="size-4" />معاينة</Button>
                  <Button variant="secondary" className="text-xs" onClick={() => onSelectOwner(row.owner.id)}><LinkIcon className="size-4" />العلاقات</Button>
                  <Button variant="secondary" className="text-xs" onClick={() => onEditOwner(row.owner)}><Pencil className="size-4" />تعديل</Button>
                </div>
              )}
              onClick={() => openPreview(row.owner.id)}
            />
          )}
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
                    <div key={property.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="font-bold">{property.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{getOwnerPropertyOwnershipLabel(property)}</p>
                    </div>
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
