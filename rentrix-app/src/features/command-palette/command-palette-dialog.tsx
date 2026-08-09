import { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Command } from 'cmdk';
import { Search, Loader2, KeyRound } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useCommandPaletteStore } from './command-palette-store';
import { useCommandSearch } from './use-command-search';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/ui/loading-state';

export function CommandPaletteDialog() {
  const { isOpen, close, toggle } = useCommandPaletteStore();
  const [search, setSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const { staticCommands, entities, isLoading, isError, error } = useCommandSearch(search);

  // Keyboard shortcut listener: ⌘K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  // Reset search when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  const handleSelectStatic = (cmd: typeof staticCommands[number]) => {
    close();
    void navigate({
      to: cmd.canonicalRoute,
      search: cmd.search,
    });
  };

  const handleSelectEntity = (item: typeof entities[number]) => {
    close();
    // Every result owns a canonical record URL/search binding. The current
    // workspace is retained as background so native detail routes open as
    // dialogs and Back/Forward restore the exact previous location.
    void (navigate as unknown as (options: unknown) => void)({
      to: item.route,
      params: item.params,
      search: item.search,
      state: { backgroundLocation: location },
    });
  };

  // Group entities by category
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
    for (const item of entities) {
      if (groups[item.category]) {
        groups[item.category].push(item);
      }
    }
    return groups;
  }, [entities]);

  const categoryLabels: Record<string, string> = {
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-w-[46rem] p-0 overflow-hidden bg-card border border-border/80 shadow-elevated rounded-2xl max-h-[85vh] flex flex-col md:max-h-[75vh]">
        <DialogTitle className="sr-only">قائمة البحث والوصول السريع</DialogTitle>
        <Command className="flex flex-col w-full h-full min-h-[26rem] focus-visible:outline-none" label="قائمة البحث السريع">
          {/* Input field */}
          <div className="flex items-center border-b border-border/70 px-4 py-1.5 bg-muted/20" data-command-input-container>
            {isLoading ? (
              <Loader2 className="me-3 size-4.5 text-primary animate-spin shrink-0" />
            ) : (
              <Search className="me-3 size-4.5 text-muted-foreground shrink-0" />
            )}
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder="البحث السريع عن صفحات، أو أشخاص، أو عقارات، أو عقود..."
              className="flex-1 min-h-12 bg-transparent text-sm text-foreground focus-visible:outline-none placeholder:text-muted-foreground/60 font-sans border-0 outline-none ring-0 w-full text-right"
              dir="rtl"
            />
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-card px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-70">
              ESC
            </kbd>
          </div>

          {/* List content */}
          <Command.List className="flex-1 overflow-y-auto p-3 space-y-1.5 focus-visible:outline-none scrollbar-thin max-h-[55vh]" data-command-list>
            {/* Loading Indicator */}
            {isLoading && (
              <div className="p-4" data-command-loading>
                <LoadingState variant="table" rows={3} label="جاري استعلام السجلات من الخادم..." />
              </div>
            )}

            {/* Error Message */}
            {isError && (
              <div className="p-4 text-center text-xs text-danger font-bold bg-danger-bg border border-danger/20 rounded-xl" data-command-error>
                تعذر تحميل نتائج البحث الحية. تحقق من اتصالك بالشبكة.
              </div>
            )}

            {/* Empty state */}
            <Command.Empty className="p-8 text-center" data-command-empty>
              <p className="text-sm font-bold text-foreground">لا توجد نتائج مطابقة</p>
              <p className="mt-1 text-xs text-muted-foreground">
                لم نجد أي مطابقات لـ "{search}" في سجل الصفحات أو الكيانات.
              </p>
            </Command.Empty>

            {/* 1. Static navigation commands (Always visible or filtered) */}
            {staticCommands.length > 0 && (
              <Command.Group heading="روابط سريعة صفحات النظام" className="text-[11px] font-bold text-muted-foreground px-2 py-1">
                {staticCommands.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    value={cmd.title}
                    onSelect={() => handleSelectStatic(cmd)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 text-xs font-semibold rounded-xl transition-colors cursor-pointer select-none',
                      'aria-selected:bg-primary aria-selected:text-primary-foreground text-foreground hover:bg-muted/40'
                    )}
                    data-command-item-static
                  >
                    <cmd.icon className="size-4 shrink-0 opacity-80" />
                    <span className="truncate">{cmd.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* 2. Dynamically searched Entities (Only shown when query has length >= 2) */}
            {search.trim().length >= 2 && !isLoading && !isError && (
              <>
                {Object.entries(groupedEntities).map(([catKey, items]) => {
                  if (items.length === 0) return null;
                  return (
                    <Command.Group
                      key={catKey}
                      heading={categoryLabels[catKey]}
                      className="text-[11px] font-bold text-muted-foreground px-2 py-1 mt-2 border-t border-border/40 pt-2"
                    >
                      {items.map((item) => (
                        <Command.Item
                          key={item.id}
                          value={`${item.title} ${item.subtitle}`}
                          onSelect={() => handleSelectEntity(item)}
                          className={cn(
                            'flex items-center justify-between gap-3 px-3 py-3 text-xs font-semibold rounded-xl transition-colors cursor-pointer select-none',
                            'aria-selected:bg-primary aria-selected:text-primary-foreground text-foreground hover:bg-muted/40'
                          )}
                          data-command-item-entity
                          data-category={catKey}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="truncate font-bold">{item.title}</span>
                            <span className="truncate text-[11px] font-normal opacity-70 group-aria-selected:text-primary-foreground/80">
                              {item.subtitle}
                            </span>
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
              </>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
export default CommandPaletteDialog;
