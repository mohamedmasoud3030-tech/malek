import { Building2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';

export function SettingsHero({
  companyName,
  hasUnsavedChanges,
}: Readonly<{ companyName: string; hasUnsavedChanges: boolean }>) {
  return (
    <header className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black text-muted-foreground">إعدادات المكتب</p>
            <h1 className="truncate text-xl font-black sm:text-2xl">{companyName}</h1>
            <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground">
              الهوية والمستندات والتشغيل والمظهر في مساحة عمل واحدة.
            </p>
          </div>
        </div>
        <StatusBadge tone={hasUnsavedChanges ? 'gold' : 'green'}>
          {hasUnsavedChanges ? 'تغييرات غير محفوظة' : 'الإعدادات محفوظة'}
        </StatusBadge>
      </div>
    </header>
  );
}

type OverviewTile = Readonly<{
  label: string;
  value: string;
  helper: string;
  tone: 'green' | 'blue' | 'gold' | 'red' | 'gray';
}>;

export function OverviewRow({ tiles }: Readonly<{ tiles: readonly OverviewTile[] }>) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="ملخص جاهزية الإعدادات">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-muted-foreground">{tile.label}</p>
            <StatusBadge tone={tile.tone}>{tile.value}</StatusBadge>
          </div>
          <p className="mt-2 text-sm font-black leading-6 text-foreground">{tile.helper}</p>
        </div>
      ))}
    </div>
  );
}
