import { AlertTriangle, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { useCommandPaletteStore } from './command-palette-store';
import { useCommandSearch, type SearchResultItem } from './use-command-search';
import type { StaticCommand } from './command-registry';

const categoryLabels: Record<SearchResultItem['category'], string> = {
  people: 'الأشخاص',
  properties: 'العقارات',
  units: 'الوحدات',
  contracts: 'العقود',
  owners: 'الملاك',
  tenants: 'المستأجرون',
  lands: 'الأراضي',
  invoices: 'الفواتير',
  receipts: 'الإيصالات',
  maintenance: 'الصيانة',
};

/**
 * Global search is intentionally lightweight on mobile: one focused modal,
 * instant task/workspace matches, then live entity search after two characters.
 * The phone header Search control opens this component through the shared store.
 */
export function CommandPaletteDialog() {
  const router = useRouter();
  const isOpen = useCommandPaletteStore((state) => state.isOpen);
  const close = useCommandPaletteStore((state) => state.close);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { staticCommands, entities, isLoading, isError } = useCommandSearch(query);

  const trimmed = query.trim();
  const hasResults = staticCommands.length > 0 || entities.length > 0;
  const visibleStatic = useMemo(
    () => (trimmed ? staticCommands.slice(0, 6) : staticCommands.slice(0, 8)),
    [staticCommands, trimmed],
  );

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => inputRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, close]);

  const goToStaticCommand = (command: StaticCommand) => {
    close();
    void router.navigate({
      to: command.canonicalRoute as never,
      search: command.search as never,
    });
  };

  const goToEntity = (entity: SearchResultItem) => {
    close();
    void router.navigate({
      to: entity.route as never,
      params: entity.params as never,
      search: entity.search as never,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120]" data-command-palette-root>
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-black/25 backdrop-blur-[1px]"
        aria-label="إغلاق البحث"
        onClick={close}
        tabIndex={-1}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="البحث السريع"
        data-command-palette-dialog
        className="absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] mx-auto flex max-h-[min(72dvh,34rem)] w-auto max-w-[34rem] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elevated sm:top-20"
      >
        <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border/70 px-3 py-2">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="text"
            role="searchbox"
            inputMode="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="ابحث في مالك..."
            aria-label="ابحث في مالك"
            className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-[16px] font-medium text-foreground outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setQuery('')}
              className="shrink-0 rounded-xl text-muted-foreground"
              aria-label="مسح البحث"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={close}
              className="shrink-0 rounded-xl text-muted-foreground"
              aria-label="إغلاق البحث"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5">
          {visibleStatic.length > 0 ? (
            <div className="space-y-1" data-command-static-results>
              <p className="px-2 pb-1 text-[11px] font-bold text-muted-foreground">
                {trimmed ? 'نتائج سريعة' : 'الانتقال السريع'}
              </p>
              {visibleStatic.map((command) => {
                const Icon = command.icon;
                return (
                  <Button
                    key={command.id}
                    type="button"
                    variant="ghost"
                    fullWidth
                    onClick={() => goToStaticCommand(command)}
                    className="min-h-12 justify-start gap-3 rounded-xl px-2.5 text-sm font-semibold focus-visible:bg-muted"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">
                      <Icon className="size-[18px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{command.title}</span>
                  </Button>
                );
              })}
            </div>
          ) : null}

          {trimmed.length >= 2 ? (
            <div className={cn('space-y-1', visibleStatic.length > 0 && 'mt-3 border-t border-border/60 pt-3')} data-command-entity-results>
              <div className="flex min-h-7 items-center justify-between gap-2 px-2">
                <p className="text-[11px] font-bold text-muted-foreground">الكيانات والسجلات</p>
                {isLoading ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                    جارٍ البحث
                  </span>
                ) : null}
              </div>

              {isError ? (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  تعذر جلب نتائج السجلات الآن. جرّب مرة أخرى.
                </div>
              ) : null}

              {!isError && entities.map((entity) => (
                <Button
                  key={`${entity.category}:${entity.id}`}
                  type="button"
                  variant="ghost"
                  fullWidth
                  onClick={() => goToEntity(entity)}
                  className="min-h-12 justify-start gap-3 rounded-xl px-2.5 font-normal focus-visible:bg-muted"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-[11px] font-bold text-muted-foreground">
                    {categoryLabels[entity.category].slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">{entity.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{entity.subtitle}</span>
                  </span>
                </Button>
              ))}
            </div>
          ) : null}

          {!isLoading && trimmed && !hasResults ? (
            <div className="grid min-h-28 place-items-center px-4 text-center">
              <div>
                <p className="text-sm font-bold text-foreground">لا توجد نتائج</p>
                <p className="mt-1 text-xs text-muted-foreground">جرّب اسمًا أو رقم عقد أو رقم وحدة مختلفًا.</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default CommandPaletteDialog;
