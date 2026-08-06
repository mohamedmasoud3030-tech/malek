import { Grid2X2, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "grid";

export interface ViewModeToggleProps {
  readonly value: ViewMode;
  readonly onChange: (value: ViewMode) => void;
  readonly className?: string;
}

export function ViewModeToggle({
  value,
  onChange,
  className,
}: ViewModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="طريقة العرض"
      className={cn(
        "inline-flex rounded-xl border border-border/70 bg-muted/40 p-1",
        className,
      )}
    >
      <button
        type="button"
        title="عرض كقائمة"
        aria-label="عرض كقائمة"
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none sm:px-3",
          value === "list"
            ? "bg-background text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <List className="size-4" aria-hidden="true" />
        <span className="hidden text-xs font-bold sm:inline">قائمة</span>
      </button>
      <button
        type="button"
        title="عرض كبطاقات"
        aria-label="عرض كبطاقات"
        aria-pressed={value === "grid"}
        onClick={() => onChange("grid")}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none sm:px-3",
          value === "grid"
            ? "bg-background text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Grid2X2 className="size-4" aria-hidden="true" />
        <span className="hidden text-xs font-bold sm:inline">بطاقات</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {value === "grid"
          ? "تم تغيير طريقة العرض إلى البطاقات"
          : "تم تغيير طريقة العرض إلى القائمة"}
      </span>
    </div>
  );
}
