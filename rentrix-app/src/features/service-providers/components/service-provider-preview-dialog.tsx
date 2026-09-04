import { FolderOpen, Pencil } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { PreviewFacts } from '@/components/ui/quick-preview';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCount } from '@/lib/formatters';
import type { ServiceProviderListItem } from '../service-provider-service';

/**
 * Service Provider Quick Preview — glance-first.
 * Identity, contact, supported service categories and open work load.
 * The provider workspace (jobs, documents, history) is the detail page.
 */
export function ServiceProviderPreviewDialog({
  provider,
  open,
  onOpenChange,
  onEdit,
}: Readonly<{
  provider: ServiceProviderListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (provider: ServiceProviderListItem) => void;
}>) {
  const navigate = useNavigate();

  return (
    <EntityPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title={provider?.name ?? 'معاينة مزود الخدمة'}
      description={provider?.legal_name && provider.legal_name !== provider.name ? provider.legal_name : provider?.service_area ?? undefined}
      status={provider ? (
        <StatusBadge tone={provider.is_active ? 'success' : 'neutral'} dot>
          {provider.is_active ? 'نشط' : 'غير نشط'}
        </StatusBadge>
      ) : undefined}
      footer={provider ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => void navigate({ to: '/service-providers/$providerId', params: { providerId: provider.id } })}
          >
            <FolderOpen className="me-2 size-4" aria-hidden="true" />
            فتح ملف مزود الخدمة
          </Button>
          {onEdit ? (
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => onEdit(provider)}>
              <Pencil className="me-2 size-4" aria-hidden="true" />
              تعديل
            </Button>
          ) : null}
        </div>
      ) : undefined}
    >
      {provider ? (
        <PreviewFacts
          rows={[
            { label: 'الهاتف', value: provider.phone ? <span dir="ltr">{provider.phone}</span> : 'غير موثق' },
            { label: 'البريد', value: provider.email ? <span dir="ltr">{provider.email}</span> : 'غير موثق' },
            { label: 'الشخص المسؤول', value: provider.contact_name ?? '—' },
            { label: 'منطقة الخدمة', value: provider.service_area ?? '—' },
            { label: 'أعمال الصيانة', value: `${formatCount(provider.maintenance_jobs_count)} (${formatCount(provider.open_jobs_count)} جارية)` },
            {
              label: 'الخدمات المدعومة',
              wide: true,
              value: provider.categories.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {provider.categories.slice(0, 4).map((category) => (
                    <span key={category.id} className="rounded-lg bg-muted/50 px-2 py-1 text-xs font-medium">
                      {category.name}
                    </span>
                  ))}
                  {provider.categories.length > 4 ? (
                    <span className="rounded-lg bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">
                      +{formatCount(provider.categories.length - 4)}
                    </span>
                  ) : null}
                </span>
              ) : 'غير محددة',
            },
          ]}
        />
      ) : null}
    </EntityPreviewDialog>
  );
}
