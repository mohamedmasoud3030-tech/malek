/**
 * EnterprisePreviewPanel — Enterprise UX Foundation (Wave 4A)
 *
 * Read-only record preview (drawer/side-panel content): header row with
 * title + status, grouped label/value field sections, and an action footer.
 * Values arrive pre-formatted — the panel never computes domain values.
 *
 * @example
 * <EnterprisePreviewPanel
 *   title={property.name}
 *   subtitle={`كود: ${property.code}`}
 *   status={<EnterpriseStatusBadge status={property.status} statusMap={map} />}
 *   sections={[{ id: 'main', fields: [{ label: 'المالك', value: ownerName }] }]}
 *   footer={<Button>فتح التفاصيل</Button>}
 * />
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EnterpriseSection } from './enterprise-section';
import { EnterpriseLoadingState } from './enterprise-loading-state';
import { EnterpriseEmptyState } from './enterprise-empty-state';

export interface EnterprisePreviewField {
  label: string;
  /** Pre-formatted display value; null/empty render as "—". */
  value: ReactNode;
  /** Span the full row in a 2-column grid. */
  wide?: boolean;
}

export interface EnterprisePreviewSection {
  id: string;
  title?: string;
  description?: string;
  fields: EnterprisePreviewField[];
}

export interface EnterprisePreviewPanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Trailing status node (EnterpriseStatusBadge or any chip). */
  status?: ReactNode;
  /** Leading icon/visual node (avatar, property thumbnail…). */
  media?: ReactNode;

  sections?: EnterprisePreviewSection[];
  /** Free-form body content instead of/in addition to sections. */
  children?: ReactNode;

  /** Trailing action row (buttons, links). */
  actions?: ReactNode;
  /** Sticky bottom slot. */
  footer?: ReactNode;

  isLoading?: boolean;
  /** Nothing to preview yet. */
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;

  /** Field grid columns. */
  columns?: 1 | 2;
  className?: string;
}

function PreviewFields({
  fields,
  columns,
}: {
  fields: EnterprisePreviewField[];
  columns: 1 | 2;
}) {
  return (
    <dl
      className={cn(
        'grid gap-3',
        columns === 2 && 'sm:grid-cols-2',
      )}
    >
      {fields.map((field) => (
        <div
          key={field.label}
          className={cn(
            'rounded-xl border border-border/60 bg-background px-3 py-2.5',
            field.wide && columns === 2 && 'sm:col-span-2',
          )}
        >
          <dt className="text-[0.6875rem] font-bold text-muted-foreground">{field.label}</dt>
          <dd className="mt-0.5 min-w-0 text-sm font-semibold break-words">
            {field.value === null || field.value === undefined || field.value === '' ? '—' : field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EnterprisePreviewPanel({
  title,
  subtitle,
  status,
  media,
  sections,
  children,
  actions,
  footer,
  isLoading = false,
  isEmpty = false,
  emptyTitle = 'لا يوجد عنصر للمعاينة',
  emptyDescription,
  columns = 2,
  className,
}: EnterprisePreviewPanelProps) {
  if (isLoading) {
    return <EnterpriseLoadingState context="drawer" className={className} />;
  }

  if (isEmpty) {
    return (
      <EnterpriseEmptyState
        title={emptyTitle}
        description={emptyDescription}
        compact
        className={className}
      />
    );
  }

  const hasHeader = title !== undefined || subtitle !== undefined || status !== undefined || media !== undefined;

  return (
    <div data-enterprise-preview-panel className={cn('flex flex-col gap-4', className)}>
      {hasHeader ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {media ? <div className="shrink-0">{media}</div> : null}
            <div className="min-w-0">
              {title !== undefined ? <h3 className="truncate text-base font-bold">{title}</h3> : null}
              {subtitle !== undefined ? (
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {status}
            {actions}
          </div>
        </div>
      ) : null}

      {sections?.map((section) =>
        section.title || section.description ? (
          <EnterpriseSection key={section.id} id={section.id} title={section.title} description={section.description} dense>
            <PreviewFields fields={section.fields} columns={columns} />
          </EnterpriseSection>
        ) : (
          <PreviewFields key={section.id} fields={section.fields} columns={columns} />
        ),
      )}

      {children}

      {footer ? (
        <div className="mt-auto border-t border-border/60 pt-3">{footer}</div>
      ) : null}
    </div>
  );
}
