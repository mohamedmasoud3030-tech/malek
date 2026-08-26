import { ChevronLeft, Settings2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { SettingsSectionId } from '../settingsSections';

export function SettingsHero({
  companyName,
  hasUnsavedChanges,
}: Readonly<{ companyName: string; hasUnsavedChanges: boolean }>) {
  return (
    <section
      aria-labelledby="settings-page-title"
      className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-bl from-primary/[0.07] via-card to-card shadow-sm"
      data-settings-cockpit
    >
      <div className="p-3.5 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 text-[11px] font-black text-primary sm:px-3 sm:text-xs">
            <Settings2 className="size-3.5" aria-hidden="true" />
            مركز الإعدادات
          </span>
          <StatusBadge tone={hasUnsavedChanges ? 'warning' : 'success'}>
            {hasUnsavedChanges ? 'تغييرات غير محفوظة' : 'الإعدادات محفوظة'}
          </StatusBadge>
        </div>

        <h1 id="settings-page-title" className="mt-2.5 text-xl font-black leading-8 sm:mt-3 sm:text-3xl sm:leading-10">
          إعدادات المكتب
        </h1>
        <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-muted-foreground sm:text-sm sm:leading-6">
          {companyName} — عدّل بيانات المكتب والهوية والمستندات والتشغيل من أقسام واضحة ومستقلة.
        </p>
      </div>
    </section>
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
    <div
      className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto pb-0.5 md:grid md:grid-cols-3 md:overflow-visible md:pb-0"
      aria-label="ملخص جاهزية الإعدادات"
    >
      {tiles.map((tile) => {
        const targetSection = tile.section;
        const isActionable = Boolean(targetSection && onOpenSection);
        const content = (
          <>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[11px] font-bold text-muted-foreground sm:text-xs">{tile.label}</p>
              <StatusBadge tone={tile.tone}>{tile.value}</StatusBadge>
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <p className="min-w-0 break-words text-xs font-black leading-5 text-foreground sm:text-sm [overflow-wrap:anywhere]">{tile.helper}</p>
              {isActionable ? <ChevronLeft className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
            </div>
          </>
        );

        if (targetSection && onOpenSection) {
          return (
            <button
              key={tile.label}
              type="button"
              className={cn(
                'min-h-16 w-[12.5rem] shrink-0 rounded-xl border border-border/60 bg-card p-2.5 text-start transition-[border-color,box-shadow,transform,background-color] md:w-auto md:min-w-0 md:rounded-2xl md:p-3 lg:p-4',
                'hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/[0.025] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              onClick={() => onOpenSection(targetSection)}
            >
              {content}
            </button>
          );
        }

        return (
          <div key={tile.label} className="min-h-16 w-[12.5rem] shrink-0 rounded-xl border border-border/60 bg-card p-2.5 md:w-auto md:min-w-0 md:rounded-2xl md:p-3 lg:p-4">
            {content}
          </div>
        );
      })}
    </div>
  );
}
