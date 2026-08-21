import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Command } from 'cmdk';
import { ArrowUpLeft, Loader2, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useCommandPaletteStore } from './command-palette-store';
import { useCommandSearch } from './use-command-search';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/ui/loading-state';
import type { StaticCommand } from './command-registry';

const STATIC_GROUP_ORDER: StaticCommand['category'][] = ['navigation', 'financial', 'operational', 'system'];
const STATIC_GROUP_LABELS: Record<StaticCommand['category'], string> = {
  navigation: 'الوصول السريع',
  financial: 'المال والتحصيل',
  operational: 'التشغيل والخدمات',
  system: 'النظام والإعدادات',
};

const ENTITY_CATEGORY_LABELS: Record<string, string> = {
  people: 'الأشخاص وجهات التعامل',
  properties: 'العقارات والمنشآت',
  units: 'الوحدات السكنية والتجارية',
  contracts: 'العقود الإيجارية',
  owners: 'الملاك',
  tenants: 'المستأجرون',
  lands: 'الأراضي والمخططات',
  invoices: 'الفواتير',
  receipts: 'الإيصالات والتحصيلات',
  maintenance: 'طلبات الصيانة',
};

export function CommandPaletteDialog() {
  const { isOpen, close, toggle } = useCommandPaletteStore();
  const [search, setSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { staticCommands, entities, isLoading, isError } = useCommandSearch(search);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  const groupedStaticCommands = useMemo(() => {
    const groups = new Map<StaticCommand['category'], typeof staticCommands>();
    for (const category of STATIC_GROUP_ORDER) groups.set(category, []);
    for (const command of staticCommands) groups.get(command.category)?.push(command);
    return groups;
  }, [staticCommands]);

  const groupedEntities = useMemo(() => {
    const groups: Record<string, typeof entities> = {
      people: [],
      properties: [],
      units: [],
      contracts: [],
      owners: [],
      tenants: [],
      lands: [],
      invoices: [],
      receipts: [],
      maintenance: [],
    };
    for (const item of entities) groups[item.category]?.push(item);
    return groups;
  }, [entities]);

  const handleSelectStatic = (command: typeof staticCommands[number]) => {
    close();
    void navigate({
      to: command.canonicalRoute,
      search: command.search,
    });
  };

  const handleSelectEntity = (item: typeof entities[number]) => {
    close();
    void (navigate as unknown as (options: unknown) => void)({
      to: item.route,
      params: item.params,
      search: item.search,
      state: { backgroundLocation: location },
    });
  };

  const hasLiveQuery = search.trim().length >= 2;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        data-command-center
        className="bottom-0 left-0 top-auto flex h-[min(82dvh,46rem)] max-h-[calc(100dvh-0.75rem)] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none rounded-t-[2rem] border-x-0 border-b-0 border-t border-border/80 bg-background p-0 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-24px_70px_-28px_hsl(var(--foreground)/0.45)] sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[min(82dvh,46rem)] sm:w-[min(92vw,46rem)] sm:max-w-[46rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.5rem] sm:border sm:pb-0"
      >
        <DialogTitle className="sr-only">مركز البحث والأوامر</DialogTitle>
        <Command className="flex min-h-0 flex-1 flex-col bg-transparent focus-visible:outline-none" label="مركز البحث والأوامر">
          <div className="shrink-0 border-b border-border/70 bg-background/95 px-3 pb-3 pt-2 backdrop-blur-xl sm:px-4 sm:pt-4" data-command-input-container>
            <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-border sm:hidden" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <div className="flex min-h-12 min-w-0 flex-1 items-center rounded-xl border border-border bg-muted/20 px-3 shadow-[inset_0_1px_0_hsl(var(--background))] transition focus-within:border-foreground/30 focus-within:bg-background focus-within:ring-4 focus-within:ring-primary/10">
                {isLoading ? (
                  <Loader2 className="me-2 size-[1.1rem] shrink-0 animate-spin text-primary" aria-hidden="true" />
                ) : (
                  <Search className="me-2 size-[1.1rem] shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <Command.Input
                  autoFocus
                  value={search}
                  onValueChange={setSearch}
                  placeholder="ابحث أو نفّذ أمراً..."
                  className="min-h-12 min-w-0 flex-1 border-0 bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground/70 sm:text-sm"
                  dir="rtl"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/15"
                    aria-label="مسح البحث"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                ) : (
                  <kbd className="hidden h-6 shrink-0 select-none items-center rounded-md border border-border bg-background px-2 font-mono text-[10px] font-semibold text-muted-foreground sm:inline-flex">
                    ⌘K
                  </kbd>
                )}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="إغلاق مركز الأوامر"
                className="grid size-12 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/15"
              >
                <X className="size-[1.1rem]" aria-hidden="true" />
              </button>
            </div>
          </div>

          <Command.List
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-gutter:stable] sm:px-4 sm:py-4 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted-foreground"
            data-command-list
          >
            {isLoading ? (
              <div className="pb-3" data-command-loading>
                <LoadingState variant="table" rows={3} label="جاري البحث في السجلات..." />
              </div>
            ) : null}

            {isError ? (
              <div className="mb-3 rounded-xl border border-danger/20 bg-danger-bg p-3 text-center text-xs font-bold text-danger" data-command-error>
                تعذر تحميل نتائج البحث الحية. ما زالت أوامر التنقل المحلية متاحة.
              </div>
            ) : null}

            <Command.Empty className="px-4 py-12 text-center" data-command-empty>
              <p className="text-sm font-black text-foreground">لا توجد نتائج مطابقة</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                جرّب اسم مستأجر أو عقار أو رقم عقد أو إيصال، أو اكتب اسم الشاشة التي تريد فتحها.
              </p>
            </Command.Empty>

            {STATIC_GROUP_ORDER.map((category) => {
              const commands = groupedStaticCommands.get(category) ?? [];
              if (commands.length === 0) return null;
              return (
                <Command.Group key={category} heading={STATIC_GROUP_LABELS[category]} data-command-static-group={category}>
                  <div className="space-y-0.5">
                    {commands.map((command) => (
                      <Command.Item
                        key={command.id}
                        value={command.title}
                        onSelect={() => handleSelectStatic(command)}
                        className={cn(
                          'group flex min-h-12 cursor-pointer select-none items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold text-foreground outline-none transition-colors',
                          'hover:bg-muted/70 aria-selected:bg-muted aria-selected:text-foreground',
                        )}
                        data-command-item-static
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/70 bg-background text-muted-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.04)] group-aria-selected:text-foreground">
                          <command.icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{command.title}</span>
                        <ArrowUpLeft className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                      </Command.Item>
                    ))}
                  </div>
                </Command.Group>
              );
            })}

            {hasLiveQuery && !isLoading && !isError ? (
              <>
                {Object.entries(groupedEntities).map(([category, items]) => {
                  if (items.length === 0) return null;
                  return (
                    <Command.Group key={category} heading={ENTITY_CATEGORY_LABELS[category] ?? category} data-command-entity-group={category}>
                      <div className="space-y-0.5">
                        {items.map((item) => (
                          <Command.Item
                            key={`${category}:${item.id}`}
                            value={`${item.title} ${item.subtitle}`}
                            onSelect={() => handleSelectEntity(item)}
                            className="group flex min-h-12 cursor-pointer select-none items-center gap-3 rounded-xl px-2.5 py-2 text-start outline-none transition-colors hover:bg-muted/70 aria-selected:bg-muted"
                            data-command-item-entity
                            data-category={category}
                          >
                            <span className="size-2 shrink-0 rounded-full bg-primary/70 ring-4 ring-primary/8" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black text-foreground">{item.title}</span>
                              <span className="mt-0.5 block truncate text-[11px] font-medium text-muted-foreground">{item.subtitle}</span>
                            </span>
                            <ArrowUpLeft className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                          </Command.Item>
                        ))}
                      </div>
                    </Command.Group>
                  );
                })}
              </>
            ) : null}
          </Command.List>

          <div className="hidden shrink-0 items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2 text-[10px] font-semibold text-muted-foreground sm:flex">
            <span>↑↓ للتنقل · Enter للفتح</span>
            <span>ESC للإغلاق</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export default CommandPaletteDialog;
