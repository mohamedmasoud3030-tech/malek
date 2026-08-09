import { Search } from 'lucide-react';
import { useCommandPaletteStore } from './command-palette-store';

export function CommandPaletteTrigger() {
  const { open } = useCommandPaletteStore();

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

  return (
    <button
      type="button"
      onClick={open}
      className="hidden lg:flex items-center justify-between w-60 min-h-9 px-3 py-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/70 rounded-xl hover:bg-muted/60 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 cursor-pointer shadow-sm shrink-0"
      aria-label="البحث السريع للنظام والكيانات"
      data-command-trigger
    >
      <div className="flex items-center gap-2">
        <Search className="size-3.5" />
        <span className="font-semibold">البحث السريع...</span>
      </div>
      <kbd className="inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-card px-1.5 font-mono text-[10px] font-bold opacity-80" aria-hidden="true">
        {shortcutLabel}
      </kbd>
    </button>
  );
}
export default CommandPaletteTrigger;
