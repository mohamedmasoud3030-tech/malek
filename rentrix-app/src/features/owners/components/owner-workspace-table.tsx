import { Eye, Pencil, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { DataTableColumnsMenu } from '@/components/ui/data-table';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { EmptyState } from '@/components/ui/state-surfaces';
import { EntityCell } from '@/components/ui/entity-cell';
import { formatLatinNumber } from '@/lib/formatters';
import { OwnerPreviewDialog } from './OwnerPreviewDialog';
import type { Owner } from '../services/owner-service';
import { getOwnerDisplayLabel, type OwnerWorkspaceRow } from '../utils/owner-ui-helpers';

const ownerColumnOptions = [
  { key: 'name', label: 'اسم المالك', locked: true },
  { key: 'contact', label: 'الهاتف والإيميل' },
  { key: 'property_count', label: 'عدد العقارات' },
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

export type OwnerWorkspaceTableProps = Readonly<{
  rows: OwnerWorkspaceRow[];
  onCreateOwner: () => void;
  onEditOwner: (owner: Owner) => void;
}>;

export function OwnerWorkspaceTable({ rows, onCreateOwner, onEditOwner }: OwnerWorkspaceTableProps) {
  const navigate = useNavigate();
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => [...defaultOwnerColumns]);
  const [previewOwnerId, setPreviewOwnerId] = useState<string | null>(null);

  const openPreview = (ownerId: string) => setPreviewOwnerId(ownerId);
  const openDetail = (ownerId: string) => void navigate({ to: '/owners/$ownerId', params: { ownerId } });

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
              { id: 'details', label: 'فتح ملف المالك', icon: UserRound, onClick: () => openDetail(row.owner.id) },
              { id: 'edit', label: 'تعديل', icon: Pencil, onClick: () => onEditOwner(row.owner) },
            ]}
          />
        </div>
      ),
    },
  ], [navigate, onEditOwner]);

  const emptyState = (
    <EmptyState
      title="لا يوجد ملاك"
      description="أضف أول مالك لبدء ربطه بالعقارات."
      action={<Button onClick={onCreateOwner}>إضافة مالك</Button>}
    />
  );

  return (
    <div className="space-y-3" data-owner-workspace-table>
      <div className="flex justify-end">
        <DataTableColumnsMenu
          columns={ownerColumnOptions}
          visibleKeys={visibleColumnKeys}
          onChange={setVisibleColumnKeys}
        />
      </div>
      {rows.length > 0 ? (
        <EntityTable
          aria-label="جدول الملاك"
          rows={rows}
          onRowClick={(row) => openPreview(row.owner.id)}
          columns={columns}
          visibleColumnKeys={visibleColumnKeys}
          mobileCardType="owner"
          mobileSupportingKey="contact"
          mobileCardSecondaryToOverflow
          mobilePrimaryMetaKeys={['contracts', 'property_count']}
          mobileCardPrimaryAction={(row) => ({
            label: 'معاينة',
            icon: Eye,
            variant: 'default',
            onClick: () => openPreview(row.owner.id),
            ariaLabel: `معاينة ${getOwnerDisplayLabel(row.owner)}`,
          })}
          mobileCardActions={(row) => [
            {
              label: 'فتح الملف',
              icon: UserRound,
              variant: 'secondary',
              onClick: () => openDetail(row.owner.id),
              ariaLabel: `فتح ملف ${getOwnerDisplayLabel(row.owner)}`,
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
        open={previewOwnerId !== null}
        onOpenChange={(open) => { if (!open) setPreviewOwnerId(null); }}
      />
    </div>
  );
}
