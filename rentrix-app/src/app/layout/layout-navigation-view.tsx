import { Link } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
import { Lock, Plus, Sparkles } from 'lucide-react';
import { canShowNavigationItem, canAccessRoute, type AuthorizationContext } from '@/features/auth/permissions';
import { cn } from '@/lib/utils';
import { mobileNavItems, navGroups, quickLinks, type MobileNavItem, type QuickLinkRoute } from '@/app/navigation/app-nav-items';

export type SharedLabel = (key: string) => string;

export function NavigationLinks({
  authorization,
  expanded,
  sharedLabel,
  onNavigate,
}: Readonly<{ authorization: AuthorizationContext | null; expanded: boolean; sharedLabel: SharedLabel; onNavigate?: () => void }>) {
  return (
    <div className="space-y-3">
      {navGroups.map(([sectionTitle, items, adminOnly]) => {
        // UX-019: hide the entire admin group when the user has no admin-style permission
        // across any of its entries.
        if (adminOnly) {
          const hasAnyAdminPermission = items.some(([, , , , permission]) => canShowNavigationItem(authorization, permission));
          if (!hasAnyAdminPermission) return null;
        }
        const visibleItems = items.filter(([, , , , permission]) => {
          if (canShowNavigationItem(authorization, permission)) return true;
          if (permission && !canAccessRoute(authorization, permission)) return true;
          return false;
        });
        if (visibleItems.length === 0) return null;

        return (
          <section key={sectionTitle} className="space-y-1.5">
            {expanded ? (
              <div className="flex items-center gap-2 px-3 pb-1">
                <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-primary/70" />
                <p className="text-[10px] font-black tracking-[0.16em] text-sidebar-foreground/55">
                  {sectionTitle}
                </p>
              </div>
            ) : (
              <div aria-hidden="true" className="mx-3 mb-1 h-px bg-white/10" />
            )}
            {items.map(([to, labelKey, description, Icon, permission]) => {
              const isLocked = permission && !canAccessRoute(authorization, permission);
              const isHidden = !canShowNavigationItem(authorization, permission);

              if (isHidden && !isLocked) return null;

              if (isLocked) {
                return (
                  <div
                    key={`${to}:${labelKey}`}
                    className="group flex min-h-11 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sidebar-foreground/55 opacity-70"
                    title={`${sharedLabel(labelKey)} — تتطلب صلاحية`}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    {expanded ? (
                      <span className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="block truncate text-[13px] font-bold">{sharedLabel(labelKey)}</span>
                          <Lock className="size-3 shrink-0 text-warning/80" aria-hidden="true" />
                        </div>
                        <span className="block truncate text-[10px] font-bold text-sidebar-foreground/45">
                          {description}
                        </span>
                      </span>
                    ) : null}
                  </div>
                );
              }

              return (
                <Link
                  key={`${to}:${labelKey}`}
                  to={to}
                  onClick={onNavigate}
                  aria-label={sharedLabel(labelKey)}
                  title={expanded ? undefined : sharedLabel(labelKey)}
                  activeOptions={{ exact: to === '/' }}
                  className={cn(
                    'group relative flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sidebar-foreground transition-all',
                    'hover:-translate-y-0.5 hover:bg-white/10 hover:text-white',
                    '[&.active]:bg-primary [&.active]:text-primary-foreground [&.active]:shadow-[0_8px_22px_-12px_rgba(0,0,0,0.55)]',
                    '[&.active]:before:absolute [&.active]:before:-end-1 [&.active]:before:top-1/2 [&.active]:before:size-2 [&.active]:before:-translate-y-1/2 [&.active]:before:rounded-full [&.active]:before:bg-white',
                  )}
                >
                  <Icon className="size-5 shrink-0 transition-transform group-hover:scale-110" aria-hidden="true" />
                  {expanded ? (
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-black">{sharedLabel(labelKey)}</span>
                      <span className="block truncate text-[10px] font-bold text-sidebar-foreground/55 group-hover:text-white/75 [&.active]:text-primary-foreground/85">
                        {description}
                      </span>
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

export function WorkspaceCard({
  onQuickLink,
  compact = false,
}: Readonly<{ onQuickLink: (to: QuickLinkRoute) => void; compact?: boolean }>) {
  return (
    <section className={cn('rounded-2xl border border-white/10 bg-white/[0.06] p-3', compact ? 'mt-3' : 'mt-5')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black text-white">مركز العمل</p>
          <p className="text-[10px] font-bold text-sidebar-foreground/55">اختصارات عملية لإنجاز أسرع</p>
        </div>
        <Sparkles className="size-4 text-primary" />
      </div>
      {quickLinks.map(([to, title, Icon]) => (
        <button
          key={to}
          type="button"
          onClick={() => onQuickLink(to)}
          className="group flex w-full items-center gap-2 rounded-xl px-2 py-2 text-right text-[11px] font-black text-sidebar-foreground/80 transition hover:bg-white/10 hover:text-white"
        >
          <Icon className="size-4 shrink-0 text-primary transition-transform group-hover:scale-110" />
          <span>{title}</span>
          <Plus className="ms-auto size-3.5 shrink-0 opacity-50" />
        </button>
      ))}
    </section>
  );
}


export function CollapsedWorkspaceMenu({
  onQuickLink,
}: Readonly<{ onQuickLink: (to: QuickLinkRoute) => void }>) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function handleQuickLink(to: QuickLinkRoute) {
    setIsOpen(false);
    onQuickLink(to);
  }

  return (
    <div ref={menuRef} className="relative mb-2">
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] px-0 py-2 text-sidebar-foreground transition',
          'hover:-translate-y-0.5 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        )}
        aria-label={isOpen ? 'إغلاق اختصارات الإنشاء' : 'فتح اختصارات الإنشاء'}
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-haspopup="dialog"
        title="اختصارات الإنشاء"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Plus className="size-5" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div
          id={menuId}
          className="absolute end-full top-0 z-50 me-2 w-56 rounded-2xl border border-white/10 bg-sidebar p-2 text-sidebar-foreground shadow-sidebar"
        >
          <div className="border-b border-white/10 px-2 pb-2">
            <p className="text-xs font-black text-white">إنشاء سريع</p>
            <p className="text-[10px] font-bold text-sidebar-foreground/55">اختر العملية المطلوبة</p>
          </div>
          <div className="mt-2 space-y-1" aria-label="اختصارات الإنشاء">
            {quickLinks.map(([to, title, Icon]) => (
              <button
                key={to}
                type="button"
                onClick={() => handleQuickLink(to)}
                className="group/item flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-right text-[12px] font-black text-sidebar-foreground/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon className="size-4 shrink-0 text-primary transition-transform group-hover/item:scale-110" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{title}</span>
                <Plus className="size-3.5 shrink-0 opacity-50" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MobileBottomNav({ authorization, sharedLabel }: Readonly<{ authorization: AuthorizationContext | null; sharedLabel: SharedLabel }>) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-12px_30px_-24px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:hidden">
      <div className="grid h-16 min-w-0 grid-cols-5 gap-0.5 px-1">
        {mobileNavItems.map((item) => {
          const [to, labelKey, Icon] = item;
          const permission = (item as MobileNavItem)[3];
          if (!canShowNavigationItem(authorization, permission)) return null;

          return (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/' }}
              aria-label={sharedLabel(labelKey)}
              className="mx-0.5 my-1 flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl px-1 text-muted-foreground transition-colors [&.active]:bg-primary/10 [&.active]:text-primary"
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className="max-w-full truncate text-[10px] font-bold leading-none">{sharedLabel(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
