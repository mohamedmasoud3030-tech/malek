import { ChevronLeft, Settings2 } from 'lucide-react';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
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
      className="border-b border-border/60 pb-2.5 md:overflow-hidden md:rounded-2xl md:border md:border-primary/20 md:bg-gradient-to-bl md:from-primary/[0.07] md:via-card md:to-card md:pb-0 md:shadow-sm"
      data-settings-cockpit
    >
      <div className="flex min-w-0 items-center gap-2.5 md:block md:p-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary md:hidden">
          <Settings2 className="size-4" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="hidden items-center gap-2 md:flex">
            <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 text-xs font-black text-primary">
              <Settings2 className="size-3.5" aria-hidden="true" />
              مركز الإعدادات
            </span>
            {hasUnsavedChanges ? <StatusBadge tone="warning">تغييرات غير محفوظة</StatusBadge> : null}
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2 md:block">
            <div className="min-w-0">
              <h1 id="settings-page-title" className="truncate text-base font-black leading-6 md:mt-3 md:text-3xl md:leading-10">
                إعدادات المكتب
              </h1>
              <p className="truncate text-[11px] font-bold leading-5 text-muted-foreground md:mt-1 md:max-w-3xl md:whitespace-normal md:text-sm md:font-semibold md:leading-6">
                <span className="md:hidden">{companyName}</span>
                <span className="hidden md:inline">{companyName} — عدّل بيانات المكتب والهوية والمستندات والتشغيل من أقسام واضحة ومستقلة.</span>
              </p>
            </div>
            {hasUnsavedChanges ? <StatusBadge tone="warning" className="shrink-0 md:hidden">غير محفوظ</StatusBadge> : null}
          </div>
        </div>
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
    <ResponsiveCardGrid
      desktopColumns={3}
      gap="sm"
      aria-label="ملخص جاهزية الإعدادات"
      className="items-stretch"
    >
      {tiles.map((tile) => {
        const targetSection = tile.section;
        const isActionable = Boolean(targetSection && onOpenSection);
        const content = (
          <>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 line-clamp-2 text-[11px] font-bold leading-4 text-muted-foreground sm:text-xs">{tile.label}</p>
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
                'min-h-16 min-w-0 rounded-xl border border-border/60 bg-card p-2.5 text-start transition-[border-color,box-shadow,transform,background-color] md:rounded-2xl md:p-3 lg:p-4',
                'hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/[0.025] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              onClick={() => onOpenSection(targetSection)}
            >
              {content}
            </button>
          );
        }

        return (
          <div key={tile.label} className="min-h-16 min-w-0 rounded-xl border border-border/60 bg-card p-2.5 md:rounded-2xl md:p-3 lg:p-4">
            {content}
          </div>
        );
      })}
    </ResponsiveCardGrid>
  );
}
