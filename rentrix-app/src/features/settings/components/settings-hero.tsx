import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { SettingsSectionId } from '../settingsSections';

export function SettingsHero({
  companyName,
  hasUnsavedChanges,
}: Readonly<{ companyName: string; hasUnsavedChanges: boolean }>) {
  return (
    <PageHeader
      title="إعدادات المكتب"
      description={`${companyName} — الهوية والمستندات والتشغيل والمظهر في مساحة عمل واحدة.`}
      secondaryActions={(
        <StatusBadge tone={hasUnsavedChanges ? 'warning' : 'success'}>
          {hasUnsavedChanges ? 'تغييرات غير محفوظة' : 'الإعدادات محفوظة'}
        </StatusBadge>
      )}
    />
  );
}

type OverviewTile = Readonly<{
  label: string;
  value: string;
  helper: string;
  tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral';
  section?: SettingsSectionId;
}>;

export function OverviewRow({
  tiles,
  onOpenSection,
}: Readonly<{
  tiles: readonly OverviewTile[];
  onOpenSection?: (section: SettingsSectionId) => void;
}>) {
  return (
    <ResponsiveCardGrid desktopColumns={3} gap="md" aria-label="ملخص جاهزية الإعدادات">
      {tiles.map((tile) => {
        const targetSection = tile.section;
        const isActionable = Boolean(targetSection && onOpenSection);
        const content = (
          <>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-bold text-muted-foreground">{tile.label}</p>
              <StatusBadge tone={tile.tone}>{tile.value}</StatusBadge>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="min-w-0 break-words text-sm font-black leading-5 text-foreground [overflow-wrap:anywhere]">{tile.helper}</p>
              {isActionable ? <ChevronLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
            </div>
          </>
        );

        if (targetSection && onOpenSection) {
          return (
            <button
              key={tile.label}
              type="button"
              className={cn(
                'min-h-20 min-w-0 rounded-2xl border border-border/60 bg-card p-3 text-start transition-[border-color,box-shadow,transform] sm:p-4',
                'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              onClick={() => onOpenSection(targetSection)}
            >
              {content}
            </button>
          );
        }

        return <div key={tile.label} className="min-h-20 min-w-0 rounded-2xl border border-border/60 bg-card p-3 sm:p-4">{content}</div>;
      })}
    </ResponsiveCardGrid>
  );
}
