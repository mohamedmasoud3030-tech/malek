import { cn } from '@/lib/utils';

export function BrandMark({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      className={cn(
        'relative grid size-11 shrink-0 place-items-center rounded-[1.15rem] bg-gradient-to-br from-white to-cyan-100 text-lg font-black text-slate-950 shadow-[0_12px_32px_-12px_rgba(34,211,238,0.8)]',
        className,
      )}
      aria-hidden="true"
    >
      R
      <span className="absolute -bottom-1 -left-1 size-3 rounded-full border-2 border-sidebar bg-emerald-400" />
    </div>
  );
}
