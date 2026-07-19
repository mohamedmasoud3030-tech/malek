import { Link } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
import { Lock, Plus } from 'lucide-react';
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
    <div className="space-y-4">
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
          <section key={sectionTitle} className="space-y-1">
            {expanded ? (
              <div className="px-3 pb-1">
                <p className="text-[10px] font-semibold tracking-[0.08em] text-sidebar-foreground/50">
                  {sectionTitle}
                </p>
              </div>
            ) : (
              <div aria-hidden="true" className="mx-3 mb-1 h-px bg-white/10" />
            )}
            {items.map(([to, labelKey, _description, Icon, permission]) => {
              const isLocked = permission && !canAccessRoute(authorization, permission);
              const isHidden = !canShowNavigationItem(authorization, permission);

              if (isHidden && !isLocked) return null;

              if (isLocked) {
                return (
                  <div
                    key={`${to}:${labelKey}`}
                    className="group flex min-h-11 items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-sidebar-foreground/55 opacity-70"
                    title={`${sharedLabel(labelKey)} — تتطلب صلاحية`}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden="true" />
                    {expanded ? (
                      <span className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="block truncate text-[13px] font-bold">{sharedLabel(labelKey)}</span>
                          <Lock className="size-3 shrink-0 text-warning/80" aria-hidden="true" />
                        </div>
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
                  activeOptions={{ exact: to === '/dashboard' }}
                  className={cn(
                    'group relative flex min-h-11 items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sidebar-foreground transition-all',
                    'hover:bg-white/[0.075] hover:text-white',
                    '[&.active]:border-white/10 [&.active]:bg-white/[0.13] [&.active]:text-white [&.active]:shadow-[inset_-3px_0_0_0_hsl(var(--primary)),0_10px_28px_-18px_rgba(0,0,0,0.75)]',
                  )}
                >
                  <Icon className="size-5 shrink-0 transition-transform group-hover:scale-110" aria-hidden="true" />
                  {expanded ? (
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">{sharedLabel(labelKey)}</span>
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
    <section className={cn('rounded-2xl border border-white/10 bg-white/[0.055] p-3 backdrop-blur', compact ? 'mt-3' : 'mt-5')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-white">وصول سريع</p>
          <p className="text-[10px] font-medium text-sidebar-foreground/60">افتح مساحة العمل ثم أضف من الفورم المنبثق</p>
        </div>
        <Plus className="size-4 text-primary" />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {quickLinks.map(([to, title, Icon]) => (
          <button
            key={to}
            type="button"
            onClick={() => onQuickLink(to)}
            className="group flex min-h-16 min-w-0 flex-col items-start justify-between rounded-xl border border-white/8 bg-black/10 p-2.5 text-right text-[10px] font-semibold text-sidebar-foreground/80 transition hover:border-white/15 hover:bg-white/10 hover:text-white"
          >
            <Icon className="size-4 shrink-0 text-primary transition-transform group-hover:scale-110" />
            <span className="line-clamp-2">{title}</span>
          </button>
        ))}
      </div>
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
          'hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        )}
        aria-label={isOpen ? 'إغلاق الوصول السريع' : 'فتح الوصول السريع'}
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-haspopup="dialog"
        title="الوصول السريع"
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
            <p className="text-xs font-semibold text-white">وصول سريع</p>
            <p className="text-[10px] font-bold text-sidebar-foreground/55">افتح مساحة العمل المطلوبة</p>
          </div>
          <div className="mt-2 space-y-1" aria-label="روابط الوصول السريع">
            {quickLinks.map(([to, title, Icon]) => (
              <button
                key={to}
                type="button"
                onClick={() => handleQuickLink(to)}
                className="group/item flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-right text-[12px] font-semibold text-sidebar-foreground/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/96 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-1px_0_0_hsl(var(--border)/0.6),0_-16px_40px_-20px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:hidden"
      aria-label="التنقل الرئيسي"
    >
      <div className="grid h-[3.75rem] min-w-0 grid-cols-5 items-stretch px-0.5">
        {mobileNavItems.map((item) => {
          const [to, labelKey, Icon] = item;
          const permission = (item as MobileNavItem)[3];
          if (!canShowNavigationItem(authorization, permission)) return null;

          return (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/dashboard' }}
              aria-label={sharedLabel(labelKey)}
              className={cn(
                'group relative flex min-h-0 min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2 text-muted-foreground',
                'transition-colors duration-150 focus-visible:outline-none',
                '[&.active]:text-primary',
              )}
            >
              {/* active pill background */}
              <span
                aria-hidden="true"
                className="absolute inset-x-1.5 inset-y-1 rounded-2xl bg-primary/0 transition-all duration-200 group-[.active]:bg-primary/[0.09]"
              />
              {/* active top hairline */}
              <span
                aria-hidden="true"
                className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary opacity-0 transition-all duration-200 group-[.active]:opacity-100"
              />
              <Icon className="relative z-10 size-[1.2rem] shrink-0 transition-transform duration-150 group-active:scale-90" aria-hidden="true" />
              <span className="relative z-10 max-w-full truncate text-[9.5px] font-bold leading-none tracking-tight">{sharedLabel(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
