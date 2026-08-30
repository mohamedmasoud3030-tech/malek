import { Link, useLocation } from '@tanstack/react-router';
import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState, type Ref } from 'react';
import { ChevronDown, FileText, HandCoins, Lock, LogOut, Menu, Plus, ReceiptText, Search, Sparkles, Wrench, X } from 'lucide-react';
import { OPEN_AI_ASSISTANT_EVENT } from '@/features/ai-assistant/ai-assistant-global-action';
import { useCommandPaletteStore } from '@/features/command-palette/command-palette-store';
import { canShowNavigationItem, canAccessRoute, type AuthorizationContext, type AppPermission } from '@/features/auth/permissions';
import { PermissionRequestDialog } from '@/components/layout/permission-request-dialog';
import { getNavRoot } from '@/app/navigation/route-nav-map';
import { navigationLabels } from '@/app/navigation/terminology-registry';
import { cn } from '@/lib/utils';
import { navGroups, workspaceChildNavItems, type NavItem } from '@/app/navigation/app-nav-items';
import { useAuth } from '@/hooks/use-auth';
import { type SharedLabel } from '@/lib/i18n';
import { NotificationsMenu } from './notifications-menu';

function navLabel(labelKey: string, sharedLabel: SharedLabel) {
  return navigationLabels[labelKey] ?? sharedLabel(labelKey);
}

function searchMatches(current: Record<string, unknown>, expected?: Readonly<Record<string, string>>) {
  if (!expected) return true;
  return Object.entries(expected).every(([key, value]) => current[key] === value);
}

export function NavigationLinks({
  authorization,
  expanded,
  sharedLabel,
  onNavigate,
}: Readonly<{
  authorization: AuthorizationContext | null;
  expanded: boolean;
  sharedLabel: SharedLabel;
  onNavigate?: () => void;
}>) {
  const location = useLocation();
  const { logout } = useAuth();
  const activeRoot = getNavRoot(location.pathname);
  const navigationId = useId();
  const [lockedRequest, setLockedRequest] = useState<{ permission: AppPermission; route: string; label: string } | null>(null);
  const [expandedRoots, setExpandedRoots] = useState<ReadonlySet<string>>(() => new Set([activeRoot]));
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setExpandedRoots((current) => current.has(activeRoot) ? current : new Set([...current, activeRoot]));
  }, [activeRoot]);

  const isItemLocked = (permission?: Parameters<typeof canAccessRoute>[1]) => Boolean(permission) && !canAccessRoute(authorization, permission);

  const renderItem = (item: NavItem, isChild = false) => {
    const [to, labelKey, description, Icon, permission, search] = item;
    const isLocked = isItemLocked(permission);
    const currentSearch = location.search as Record<string, unknown>;
    const isActive = isChild
      ? (location.pathname === to || location.pathname.startsWith(`${to}/`)) && searchMatches(currentSearch, search)
      : activeRoot === to;
    const label = navLabel(labelKey, sharedLabel);
    const resourceRoute = search
      ? `${to}?${new URLSearchParams(search as Record<string, string>).toString()}`
      : to;

    return (
      <Link
        key={`${to}:${labelKey}`}
        to={to}
        search={search as Record<string, string> | undefined}
        onClick={(event) => {
          if (isLocked && permission) {
            event.preventDefault();
            setLockedRequest({ permission, route: resourceRoute, label });
            return;
          }
          onNavigate?.();
        }}
        aria-current={isActive ? 'page' : undefined}
        aria-disabled={isLocked ? 'true' : undefined}
        aria-label={label}
        title={expanded ? description : label}
        activeOptions={{ exact: true }}
        data-nav-item
        data-nav-child={isChild ? 'true' : undefined}
        data-active={isActive ? 'true' : undefined}
        className={cn(
          'group relative flex min-h-11 items-center gap-2.5 rounded-lg border border-transparent px-3 py-2 text-[14px] font-semibold leading-5 text-sidebar-foreground outline-none transition-[background-color,border-color,color] duration-150',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-primary/20',
          '[[data-mobile-nav-drawer]_&]:min-h-11 [[data-mobile-nav-drawer]_&]:rounded-lg [[data-mobile-nav-drawer]_&]:px-2.5 [[data-mobile-nav-drawer]_&]:text-sidebar-foreground/90 [[data-mobile-nav-drawer]_&]:hover:bg-sidebar-accent',
          '[[data-mobile-nav-sheet]_&]:min-h-12 [[data-mobile-nav-sheet]_&]:rounded-xl [[data-mobile-nav-sheet]_&]:px-3 [[data-mobile-nav-sheet]_&]:py-2.5 [[data-mobile-nav-sheet]_&]:text-[15px] [[data-mobile-nav-sheet]_&]:font-bold [[data-mobile-nav-sheet]_&]:text-foreground [[data-mobile-nav-sheet]_&]:hover:bg-muted [[data-mobile-nav-sheet]_&]:hover:text-foreground',
          isChild && 'ms-3 min-h-11 border-s-2 border-s-sidebar-border/60 ps-3 [[data-mobile-nav-drawer]_&]:ms-2 [[data-mobile-nav-sheet]_&]:ms-2 [[data-mobile-nav-sheet]_&]:border-s-border [[data-mobile-nav-sheet]_&]:ps-3',
          isLocked && 'cursor-not-allowed opacity-70 [[data-mobile-nav-sheet]_&]:opacity-80 [[data-mobile-nav-sheet]_&]:text-muted-foreground',
          isActive && 'border-sidebar-accent/20 bg-sidebar-accent text-sidebar-accent-foreground shadow-none [[data-mobile-nav-drawer]_&]:border-sidebar-border [[data-mobile-nav-drawer]_&]:bg-sidebar-accent [[data-mobile-nav-sheet]_&]:border-primary/20 [[data-mobile-nav-sheet]_&]:bg-primary/10 [[data-mobile-nav-sheet]_&]:text-foreground',
        )}
      >
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center',
            'text-sidebar-foreground/80 group-hover:text-sidebar-foreground',
            '[[data-mobile-nav-sheet]_&]:text-foreground/80 [[data-mobile-nav-sheet]_&]:group-hover:text-foreground',
            isActive && 'text-sidebar-accent-foreground [[data-mobile-nav-sheet]_&]:text-primary',
          )}
        >
          <Icon className={cn(isChild ? 'size-[18px]' : 'size-[20px]', 'shrink-0')} aria-hidden="true" />
        </span>
        {expanded ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
        {isLocked ? <Lock className="ms-auto size-3.5 text-warning" aria-hidden="true" /> : null}
        {isActive ? <span className="ms-auto size-1.5 shrink-0 rounded-full bg-sidebar-accent-foreground [[data-mobile-nav-drawer]_&]:bg-primary [[data-mobile-nav-sheet]_&]:bg-primary" aria-hidden="true" /> : null}
      </Link>
    );
  };

  const handleMobileLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      onNavigate?.();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="space-y-4 [[data-mobile-nav-drawer]_&]:space-y-2 [[data-mobile-nav-sheet]_&]:space-y-3">
      {navGroups.map(([sectionTitle, items, adminOnly]) => {
        if (adminOnly && !items.some(([, , , , permission]) => canShowNavigationItem(authorization, permission))) return null;
        if (items.length === 0) return null;
        return (
          <section key={sectionTitle} className="space-y-1">
            {expanded
              ? <div className="px-3 pb-1 pt-2"><p className="text-[11px] font-bold text-sidebar-foreground/45 [[data-mobile-nav-sheet]_&]:text-xs [[data-mobile-nav-sheet]_&]:font-bold [[data-mobile-nav-sheet]_&]:text-muted-foreground">{sectionTitle}</p></div>
              : <div aria-hidden="true" className="mx-3 mb-2 h-px bg-sidebar-foreground/10" />}
            {items.map((item) => {
              const [to] = item;
              const children = workspaceChildNavItems[to] ?? [];
              const isOpen = expandedRoots.has(to);
              const childrenId = `${navigationId}-${to.replace(/[^a-z]/gi, '') || 'root'}`;
              return (
                <div key={to} className="space-y-1">
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">{renderItem(item)}</div>
                    {expanded && children.length > 0 ? (
                      <button
                        type="button"
                        className="me-1 grid size-11 shrink-0 place-items-center rounded-lg text-sidebar-foreground/60 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-primary/20 [[data-mobile-nav-sheet]_&]:text-muted-foreground [[data-mobile-nav-sheet]_&]:hover:bg-muted [[data-mobile-nav-sheet]_&]:hover:text-foreground"
                        aria-label={`${isOpen ? 'طي' : 'توسيع'} ${navLabel(item[1], sharedLabel)}`}
                        aria-expanded={isOpen}
                        aria-controls={childrenId}
                        onClick={() => setExpandedRoots((current) => {
                          const next = new Set(current);
                          if (next.has(to)) next.delete(to); else next.add(to);
                          return next;
                        })}
                      >
                        <ChevronDown className={cn('size-4 transition-transform', !isOpen && '-rotate-90')} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {expanded && children.length > 0 ? (
                    <div id={childrenId} hidden={!isOpen} className="space-y-1 ps-1">
                      {children.map((child) => renderItem(child, true))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        );
      })}

      <button
        type="button"
        onClick={() => { void handleMobileLogout(); }}
        disabled={loggingOut}
        data-mobile-nav-logout
        className="hidden min-h-12 w-full items-center gap-3 rounded-xl border border-destructive/20 px-3 text-start text-[15px] font-bold text-destructive outline-none transition-colors hover:bg-destructive/5 focus-visible:ring-2 focus-visible:ring-destructive/20 disabled:opacity-50 [[data-mobile-nav-sheet]_&]:flex"
      >
        <span className="grid size-8 shrink-0 place-items-center">
          <LogOut className="size-5" aria-hidden="true" />
        </span>
        <span>{loggingOut ? 'جارٍ تسجيل الخروج...' : 'تسجيل الخروج'}</span>
      </button>

      <PermissionRequestDialog
        open={lockedRequest !== null}
        onOpenChange={(open) => { if (!open) setLockedRequest(null); }}
        permission={lockedRequest?.permission ?? 'company.settings.manage'}
        resourceRoute={lockedRequest?.route ?? '/settings'}
        label={lockedRequest?.label ?? 'هذا القسم'}
      />
    </div>
  );
}

type MobileQuickAction = Readonly<{
  id: string;
  label: string;
  to: string;
  search?: Readonly<Record<string, string>>;
  icon: typeof FileText;
  permission?: AppPermission;
}>;

const mobileQuickActions: readonly MobileQuickAction[] = [
  { id: 'contract', label: 'عقد جديد', to: '/contracts/new', icon: FileText, permission: 'contracts.create' },
  { id: 'collect', label: 'تحصيل مبلغ', to: '/financials', search: { section: 'collections', view: 'invoices', quickAdd: 'collect' }, icon: HandCoins, permission: 'financial.payments.create' },
  { id: 'maintenance', label: 'طلب صيانة', to: '/maintenance', search: { section: 'maintenance', quickAdd: 'maintenance' }, icon: Wrench, permission: 'maintenance.create' },
  { id: 'utility-bill', label: 'فاتورة مرافق', to: '/maintenance', search: { section: 'utilities', quickAdd: 'utility-bill' }, icon: ReceiptText, permission: 'maintenance.create' },
];

/**
 * Phone chrome contract:
 * - Search and Quick Add are real header controls, portaled into the header DOM.
 * - The lower dock keeps only Menu, Notifications, and AI.
 * - Header and dock hide on downward page scroll and return on upward scroll.
 */
export function MobileFloatingControl({
  onMenu,
  menuRef,
  drawerOpen = false,
}: Readonly<{
  onMenu: () => void;
  menuRef?: Ref<HTMLButtonElement>;
  drawerOpen?: boolean;
}>) {
  const { authorization } = useAuth();
  const [quickOpen, setQuickOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);
  const quickRootRef = useRef<HTMLDivElement>(null);
  const quickTriggerRef = useRef<HTMLButtonElement>(null);
  const lastScrollYRef = useRef(0);
  const quickAddTitleId = useId();
  const visibleQuickActions = mobileQuickActions.filter(
    (item) => !item.permission || canAccessRoute(authorization, item.permission),
  );

  const utilityActionClass =
    'grid size-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border-0 bg-transparent text-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground active:bg-muted/80 focus-visible:ring-2 focus-visible:ring-primary/20';
  const headerActionClass =
    'grid size-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border-0 bg-transparent text-foreground outline-none transition-colors duration-150 hover:bg-muted hover:text-foreground active:bg-muted/80 focus-visible:ring-2 focus-visible:ring-primary/20 md:hidden';

  useEffect(() => {
    const target = document.querySelector<HTMLElement>('[data-header-utility-side]');
    setHeaderTarget(target);
    if (!target) return;

    const userMenu = target.querySelector<HTMLElement>('[data-header-user-menu]');
    const phoneMedia = window.matchMedia('(max-width: 767px)');
    const syncPhoneOnlyChrome = () => {
      if (userMenu) userMenu.style.display = phoneMedia.matches ? 'none' : '';
    };

    syncPhoneOnlyChrome();
    phoneMedia.addEventListener('change', syncPhoneOnlyChrome);
    return () => {
      phoneMedia.removeEventListener('change', syncPhoneOnlyChrome);
      if (userMenu) userMenu.style.display = '';
    };
  }, []);

  useEffect(() => {
    if (!quickOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (quickRootRef.current?.contains(target)) return;
      if (quickTriggerRef.current?.contains(target)) return;
      setQuickOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQuickOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [quickOpen]);

  useEffect(() => {
    const phoneMedia = window.matchMedia('(max-width: 767px)');
    const header = document.querySelector<HTMLElement>('[data-app-shell-header]');
    if (!header) return;

    header.style.transition = 'transform 180ms ease, opacity 180ms ease';
    header.style.willChange = 'transform';
    lastScrollYRef.current = window.scrollY;
    let frame = 0;

    const applyVisibility = (visible: boolean) => {
      setChromeVisible(visible);
      if (!phoneMedia.matches) {
        header.style.transform = '';
        header.style.opacity = '';
        return;
      }
      header.style.transform = visible ? 'translateY(0)' : 'translateY(-100%)';
      header.style.opacity = visible ? '1' : '0';
    };

    const onScroll = () => {
      if (!phoneMedia.matches) return;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nextY = Math.max(0, window.scrollY);
        const delta = nextY - lastScrollYRef.current;

        if (drawerOpen || quickOpen || nextY <= 12) {
          applyVisibility(true);
          lastScrollYRef.current = nextY;
          return;
        }
        if (delta > 8) {
          applyVisibility(false);
          lastScrollYRef.current = nextY;
          return;
        }
        if (delta < -8) {
          applyVisibility(true);
          lastScrollYRef.current = nextY;
        }
      });
    };

    const onViewportChange = () => {
      if (!phoneMedia.matches) applyVisibility(true);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    phoneMedia.addEventListener('change', onViewportChange);
    if (drawerOpen || quickOpen) applyVisibility(true);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      phoneMedia.removeEventListener('change', onViewportChange);
      header.style.transform = '';
      header.style.opacity = '';
      header.style.transition = '';
      header.style.willChange = '';
    };
  }, [drawerOpen, quickOpen]);

  const openAiAssistant = () => {
    setQuickOpen(false);
    window.dispatchEvent(new Event(OPEN_AI_ASSISTANT_EVENT));
  };

  const openSearch = () => {
    setQuickOpen(false);
    useCommandPaletteStore.getState().open();
  };

  const headerActions = headerTarget
    ? createPortal(
      <>
        <button
          ref={quickTriggerRef}
          type="button"
          onClick={() => setQuickOpen((value) => !value)}
          aria-label="فتح الإضافة السريعة"
          aria-haspopup="menu"
          aria-expanded={quickOpen}
          aria-controls={quickOpen ? quickAddTitleId : undefined}
          title="إضافة سريعة"
          data-header-quick-add
          className={cn(headerActionClass, 'order-[-2] text-primary hover:text-primary', quickOpen && 'bg-primary/10')}
          disabled={visibleQuickActions.length === 0}
        >
          <Plus className="size-6" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={openSearch}
          aria-label="البحث السريع للنظام والكيانات"
          title="البحث"
          data-header-search-button
          data-header-phone-search
          className={cn(headerActionClass, 'order-[-1]')}
        >
          <Search className="size-6" aria-hidden="true" />
        </button>
      </>,
      headerTarget,
    )
    : null;

  if (drawerOpen) return null;

  return (
    <>
      {headerActions}

      {quickOpen && visibleQuickActions.length > 0 ? (
        <div
          ref={quickRootRef}
          data-mobile-quick-add-menu
          className="fixed end-3 top-[calc(env(safe-area-inset-top,0px)+var(--app-header-height)+0.5rem)] z-[70] w-[min(18.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-elevated md:hidden"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-bold tracking-wide text-muted-foreground" data-mobile-quick-add-title id={quickAddTitleId}>
              إضافة سريعة
            </p>
            <button
              type="button"
              onClick={() => setQuickOpen(false)}
              className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="إغلاق الإضافة السريعة"
            >
              <X className="size-4" />
            </button>
          </div>
          <div
            role="menu"
            aria-labelledby={quickAddTitleId}
            className="flex flex-col gap-0.5 p-1.5"
            data-mobile-quick-add-list
          >
            {visibleQuickActions.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  search={item.search as Record<string, string> | undefined}
                  role="menuitem"
                  data-mobile-quick-add-item
                  onClick={() => setQuickOpen(false)}
                  className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[14px] font-bold text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <Icon className="size-[18px] shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 whitespace-nowrap font-bold text-foreground">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(1.15rem+env(safe-area-inset-bottom,0px))] transition-[transform,opacity] duration-200 motion-reduce:transition-none md:hidden',
          chromeVisible ? 'translate-y-0 opacity-100' : 'translate-y-[calc(100%+2rem)] opacity-0',
        )}
        data-mobile-floating-control
        data-mobile-control-center
        data-scroll-visible={chromeVisible ? 'true' : 'false'}
        aria-label="مركز التحكم"
      >
        <div
          data-mobile-dock-surface
          className="pointer-events-auto relative flex w-auto items-center gap-1 rounded-full border border-border bg-card px-1.5 py-1 shadow-sm"
        >
          <button
            ref={menuRef}
            type="button"
            onClick={onMenu}
            aria-label="فتح القائمة"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            title="القائمة الرئيسية"
            data-mobile-dock-menu
            className={utilityActionClass}
          >
            <Menu className="size-[21px]" aria-hidden="true" />
          </button>

          <div className="relative" data-mobile-dock-notifications>
            <NotificationsMenu authorization={authorization} />
          </div>

          <button
            type="button"
            onClick={openAiAssistant}
            aria-label="فتح المساعد الذكي"
            title="المساعد الذكي"
            data-mobile-dock-ai
            className={utilityActionClass}
          >
            <Sparkles className="size-[21px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}
