import { Link } from '@tanstack/react-router';
import { Building2, Eye, LinkIcon, Pencil, Users } from 'lucide-react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/empty-state';
import { EntityCell } from '@/components/ui/entity-cell';
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
  const hasSearch = Boolean(search.trim());
  const emptyState = (
    <EmptyState
      title={hasSearch ? 'لا توجد نتائج مطابقة' : 'لا يوجد ملاك'}
      description={hasSearch ? 'جرّب البحث باسم أو هاتف أو بريد أو اسم عقار آخر.' : 'أضف أول مالك لبدء ربطه بالعقارات.'}
      action={hasSearch ? undefined : <Button onClick={onCreateOwner}>إضافة مالك</Button>}
    />
  );

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
          onRowClick={(row) => onSelectOwner(row.owner.id)}
          columns={[
            {
              key: 'name',
              header: 'اسم المالك',
              render: (row) => (
                <EntityCell
                  icon={Users}
                  title={(
                    <Button variant="link" className="min-h-11 px-0 text-start font-bold" asChild>
                      <Link to="/owners/$ownerId" params={{ ownerId: row.owner.id }}>{getOwnerDisplayLabel(row.owner)}</Link>
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
            {
              key: 'contracts',
              header: 'العقود النشطة',
              render: (row) => row.activeContractCount > 0 ? formatLatinNumber(row.activeContractCount, 'ar') : '—',
            },
            {
              key: 'actions',
              header: 'إجراءات',
              render: (row) => (
                <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                  <ActionMenu
                    label={`إجراءات ${getOwnerDisplayLabel(row.owner)}`}
                    items={[
                      { id: 'details', label: 'التفاصيل', icon: Eye, to: '/owners/$ownerId', params: { ownerId: row.owner.id } },
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
                  <Button variant="secondary" className="text-xs" asChild>
                    <Link to="/owners/$ownerId" params={{ ownerId: row.owner.id }}><Eye className="size-4" />التفاصيل</Link>
                  </Button>
                  <Button variant="secondary" className="text-xs" onClick={() => onSelectOwner(row.owner.id)}><LinkIcon className="size-4" />العلاقات</Button>
                  <Button variant="secondary" className="text-xs" onClick={() => onEditOwner(row.owner)}><Pencil className="size-4" />تعديل</Button>
                </div>
              )}
              onClick={() => onSelectOwner(row.owner.id)}
            />
          )}
        />
      ) : emptyState}
    </div>
  );
}
