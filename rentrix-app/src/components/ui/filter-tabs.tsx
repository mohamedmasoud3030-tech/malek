import { cn } from "@/lib/utils";

interface FilterOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface FilterTabsProps<T extends string> {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Horizontal pill-style filter tabs — used on list pages for status filtering.
 * Replaces the repeated "الكل / نشط / منتهي / ملغي" button groups.
 *
 * @example
 * <FilterTabs
 *   options={[
 *     { value: "all", label: "الكل" },
 *     { value: "active", label: "نشط", count: 12 },
 *     { value: "expired", label: "منتهي" },
 *   ]}
 *   value={filter}
 *   onChange={setFilter}
 * />
 */
export function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel = "خيارات التصفية",
}: FilterTabsProps<T>) {
  return (
    <div
      className={cn("flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar", className)}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
            value === opt.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          )}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums",
                value === opt.value
                  ? "bg-white/20 text-primary-foreground"
                  : "bg-background text-foreground",
              )}
            >
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
