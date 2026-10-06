import { Edit, FolderOpen } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { PreviewFacts } from '@/components/ui/quick-preview';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatLatinNumber } from '@/lib/formatters';
import { getOwnerDisplayLabel, type OwnerWorkspaceRow } from '../utils/owner-ui-helpers';
import type { Owner } from '../services/owner-service';

/**
 * Owner Quick Preview — glance-first, not a miniature dossier.
 *
 * Answers: who is this owner, how do I contact them, how many properties,
 * what is the immediate operational context. Anything deeper (agreements,
 * units, contracts, activity, documents, authority) belongs to the full owner
 * page and is reached through «فتح ملف المالك».
 */
export function OwnerPreviewDialog({
  row,
  open,
  onOpenChange,
  onEdit,
}: Readonly<{
  row: OwnerWorkspaceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (owner: Owner) => void;
}>) {
  const navigate = useNavigate();
  const owner = row?.owner ?? null;
  // The canonical directory row carries property names as directory search
  // text (no per-row ownership presentation); the glance list is derived from
  // it rather than restoring a row-level property model.
  const propertyTitles = row?.propertyNames
    ? row.propertyNames.split('، ').filter(Boolean)
    : [];
  const firstProperties = propertyTitles.slice(0, 2);
  const extraProperties = Math.max(0, (row?.propertyCount ?? 0) - firstProperties.length);

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={owner ? getOwnerDisplayLabel(owner) : 'معاينة المالك'}
      description={owner && owner.full_name !== owner.display_name ? owner.full_name : undefined}
      status={owner ? (
        <StatusBadge tone={owner.is_active ? 'success' : 'neutral'} dot>
          {owner.is_active ? 'نشط' : 'غير نشط'}
        </StatusBadge>
      ) : undefined}
      footer={owner ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => void navigate({ to: '/owners/$ownerId', params: { ownerId: owner.id } })}
          >
            <FolderOpen className="me-2 size-4" aria-hidden="true" />
            فتح ملف المالك
          </Button>
          {onEdit ? (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => onEdit(owner)}
            >
              <Edit className="me-2 size-4" aria-hidden="true" />
              تعديل
            </Button>
          ) : null}
        </div>
      ) : undefined}
    >
      {owner ? (
        <PreviewFacts
          rows={[
            { label: 'الهاتف', value: owner.phone ? <span dir="ltr">{owner.phone}</span> : 'غير موثق' },
            { label: 'البريد الإلكتروني', value: owner.email ? <span dir="ltr">{owner.email}</span> : 'غير موثق' },
            { label: 'رقم الهوية', value: owner.national_id ? <span dir="ltr">{owner.national_id}</span> : 'غير موثق' },
            { label: 'عدد العقارات', value: formatLatinNumber(row?.propertyCount ?? 0, 'ar') },
            { label: 'العقود النشطة', value: formatLatinNumber(row?.activeContractCount ?? 0, 'ar') },
            ...(row?.propertyCount && row?.propertyCount > 0
              ? [{
                  label: 'العقارات',
                  wide: true as const,
                  value: (
                    <span className="flex flex-wrap gap-1.5">
                      {firstProperties.map((title) => (
                        <span key={title} className="rounded-lg bg-muted/50 px-2 py-1 text-xs font-medium">
                          {title}
                        </span>
                      ))}
                      {extraProperties > 0 ? (
                        <span className="rounded-lg bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">
                          +{formatLatinNumber(extraProperties, 'ar')} إضافية
                        </span>
                      ) : null}
                    </span>
                  ),
                }]
              : []),
          ]}
        />
      ) : null}
    </EntityPreviewDialog>
  );
}
