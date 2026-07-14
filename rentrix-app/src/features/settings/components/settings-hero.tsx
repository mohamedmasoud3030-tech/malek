import { Sparkles } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';

export function SettingsHero({ companyName, hasUnsavedChanges }: Readonly<{ companyName: string; hasUnsavedChanges: boolean }>) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-8 -top-8 size-40 rounded-full bg-primary/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-8 -right-4 size-32 rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-300">
              <Sparkles className="size-4 text-primary" />
              مركز تحكم الإعدادات
            </p>
            <h1 className="mt-0.5 text-xl font-black sm:text-2xl">إعدادات المكتب</h1>
          </div>
          {hasUnsavedChanges ? (
            <StatusBadge tone="gold">تغييرات غير محفوظة</StatusBadge>
          ) : (
            <StatusBadge tone="green">كل الإعدادات محفوظة</StatusBadge>
          )}
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div>
            <p className="text-3xl font-black tabular-nums sm:text-4xl">{companyName}</p>
            <p className="text-xs font-semibold text-slate-400">هوية الشركة المعتمدة حالياً</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-slate-300">
          <span className="rounded-full bg-white/10 px-3 py-1.5">
            بيانات موثقة
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1.5">
            مرجع لقوالب المستندات
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1.5">
            مصدر تفضيلات اللغة والسمة
          </span>
        </div>
      </div>
    </div>
  );
}

type OverviewTile = Readonly<{ label: string; value: string; helper: string; tone: 'green' | 'blue' | 'gold' | 'red' | 'gray' }>;

export function OverviewRow({ tiles }: Readonly<{ tiles: readonly OverviewTile[] }>) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-2xl border border-border/60 bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-muted-foreground">{tile.label}</p>
            <StatusBadge tone={tile.tone}>{tile.value}</StatusBadge>
          </div>
          <p className="mt-2 text-base font-black text-foreground">{tile.helper}</p>
        </div>
      ))}
    </div>
  );
}
