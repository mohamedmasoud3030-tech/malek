import { cn } from '@/lib/utils';

const bars = [42, 68, 55, 80, 63, 90, 74];

/**
 * Decorative, dependency-free mock of the in-app workspace. Used as a graceful
 * fallback when a real captured screenshot is not yet available under
 * `public/landing/`.
 */
export function AppPreview() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
        <span className="size-3 rounded-full bg-rose-400/70" />
        <span className="size-3 rounded-full bg-amber-400/70" />
        <span className="size-3 rounded-full bg-emerald-400/70" />
        <div className="mx-auto rounded-full bg-background px-3 py-1 text-[11px] font-bold text-muted-foreground">
          app.rentrix.com
        </div>
      </div>
      <div className="flex">
        <aside className="hidden w-44 shrink-0 flex-col gap-1.5 border-l border-border/60 bg-[linear-gradient(165deg,hsl(var(--sidebar)),hsl(var(--sidebar-accent))_145%)] p-4 sm:flex">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-xl bg-white/10 text-sm font-black">R</div>
            <span className="text-sm font-black text-white">Rentrix</span>
          </div>
          {['لوحة التحكم', 'العقارات', 'العقود', 'المالية', 'التقارير'].map((item, i) => (
            <div
              key={item}
              className={cn(
                'rounded-xl px-3 py-2 text-xs font-bold',
                i === 0 ? 'bg-white/15 text-white' : 'bg-white/5 text-sidebar-foreground/70',
              )}
            >
              {item}
            </div>
          ))}
        </aside>
        <main className="flex-1 space-y-3 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: 'الفواتير', v: '48K' },
              { l: 'المحصّل', v: '39K' },
              { l: 'المستحق', v: '9K' },
              { l: 'المصروفات', v: '12K' },
            ].map((kpi) => (
              <div key={kpi.l} className="rounded-2xl bg-white p-3 shadow-sm">
                <p className="text-[11px] font-bold text-slate-400">{kpi.l}</p>
                <p className="mt-1 text-lg font-black tabular-nums text-slate-800">{kpi.v}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <p className="mb-3 text-xs font-black text-slate-500">نظرة عامة على التحصيل</p>
            <div className="flex h-24 items-end justify-between gap-2">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="w-full rounded-t-md bg-gradient-to-t from-primary/70 to-primary/30"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-2xl bg-white p-3 shadow-sm">
            <p className="text-xs font-black text-slate-500">أحدث العقود</p>
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                <span className="font-bold text-slate-700">برج النخيل · وحدة 10{row + 1}</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">نشط</span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
