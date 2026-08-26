import { Building2, ChevronLeft, Settings2, ShieldCheck } from 'lucide-react';
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
      className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-bl from-primary/[0.09] via-card to-card shadow-card"
      data-settings-cockpit
    >
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 text-xs font-black text-primary">
              <Settings2 className="size-3.5" aria-hidden="true" />
              مركز الإعدادات
            </span>
            <StatusBadge tone={hasUnsavedChanges ? 'warning' : 'success'}>
              {hasUnsavedChanges ? 'تغييرات غير محفوظة' : 'الإعدادات محفوظة'}
            </StatusBadge>
          </div>

          <h1 id="settings-page-title" className="mt-3 text-balance text-2xl font-black leading-9 sm:text-3xl">
            إعدادات المكتب بدون صفحة مزدحمة
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm font-semibold leading-6 text-muted-foreground">
            {companyName} — الهوية والمستندات والتشغيل والجاهزية المالية والمظهر مقسمة إلى أقسام مستقلة وواضحة.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/60 bg-background/65 p-3 backdrop-blur-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black">هوية المكتب</p>
              <p className="truncate text-[11px] font-bold text-muted-foreground">بيانات الشركة واللغة والمستندات</p>
            </div>
          </div>
          <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/60 bg-background/65 p-3 backdrop-blur-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black">تغيير آمن</p>
              <p className="truncate text-[11px] font-bold text-muted-foreground">الحفظ والتراجع وحماية المسودة في مكان واحد</p>
            </div>
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
                'min-h-20 min-w-0 rounded-2xl border border-border/60 bg-card p-3 text-start transition-[border-color,box-shadow,transform,background-color] sm:p-4',
                'hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/[0.025] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
