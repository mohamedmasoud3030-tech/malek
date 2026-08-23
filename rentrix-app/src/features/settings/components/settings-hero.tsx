import { PageHeader } from '@/components/layout/page-header';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';

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
}>;

export function OverviewRow({ tiles }: Readonly<{ tiles: readonly OverviewTile[] }>) {
  return (
    <ResponsiveCardGrid desktopColumns={3} gap="md" aria-label="ملخص جاهزية الإعدادات">
      {tiles.map((tile) => (
        <div key={tile.label} className="min-w-0 rounded-2xl border border-border/60 bg-card p-3 sm:p-4">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[11px] font-bold text-muted-foreground">{tile.label}</p>
            <StatusBadge tone={tile.tone}>{tile.value}</StatusBadge>
          </div>
          <p className="mt-2 break-words text-sm font-black leading-5 text-foreground [overflow-wrap:anywhere]">{tile.helper}</p>
        </div>
      ))}
    </ResponsiveCardGrid>
  );
}
