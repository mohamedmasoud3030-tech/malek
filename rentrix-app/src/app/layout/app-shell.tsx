import { Link, Outlet, useMatches, useRouter } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';
import { CircleHelp, LogOut, Menu, Plus, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { MalikBrand } from '@/components/brand/malik-brand';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { canShowNavigationItem, getWriteAccessState, type AuthorizationContext } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { APP_BRAND_NAME } from '@/lib/brand';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';
import { quickCreateItems } from '@/app/navigation/app-nav-items';
import { MobileFloatingControl, NavigationLinks, type SharedLabel } from './layout-navigation-view';
import { CommandPaletteDialog } from '@/features/command-palette/command-palette-dialog';
import { AiAssistantGlobalAction } from '@/features/ai-assistant/ai-assistant-global-action';
import { sanitizeSupportRoute } from '@/features/help-support/help-context';

function Brand({ expanded }: Readonly<{ expanded: boolean }>) {
  return <MalikBrand compact={!expanded} inverse showTagline={expanded} />;
}

function HeaderDateTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const date = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  return (
    <span
      data-header-date-time
      dir="ltr"
      className="inline-flex whitespace-nowrap text-[9px] font-semibold tabular-nums text-muted-foreground min-[380px]:text-[10px] sm:text-[11px]"
      aria-label={`التاريخ ${date}، الوقت ${time}`}
    >
      {date} · {time}
    </span>
  );
}

/**
 * Header quick-create menu (#1240). Retained as a compatibility export for
 * existing call sites/tests, but intentionally removed from the global top bar.
 * Creation remains available in each workspace and through commands.
 */
export function QuickAddMenu({
  authorization,
  sharedLabel,
}: Readonly<{ authorization: AuthorizationContext | null; sharedLabel: SharedLabel }>) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const visibleItems = quickCreateItems.filter(([, , , permission]) => canShowNavigationItem(authorization, permission));

  const closeAndRestoreFocus = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1 + visibleItems.length) % visibleItems.length;
    if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = visibleItems.length - 1;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    itemRefs.current[nextIndex]?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;
    itemRefs.current[0]?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeAndRestoreFocus();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (visibleItems.length === 0) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={sharedLabel('quickAdd')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className="pressable inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm outline-none transition-colors hover:bg-primary/90 focus-visible:ring-4 focus-visible:ring-primary/35 motion-reduce:transition-none"
      >
        <Plus className="size-[1.1rem]" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label={sharedLabel('quickAdd')}
          onKeyDown={handleMenuKeyDown}
          className="absolute end-0 top-12 z-50 w-56 max-w-[calc(100vw-1rem)] rounded-2xl border border-border/90 bg-card p-1.5 text-start text-card-foreground shadow-elevated"
        >
          <p className="border-b border-border/60 px-3 pb-2 pt-0.5 text-[11px] font-semibold text-muted-foreground">
            {sharedLabel('quickAdd')}
          </p>
          {visibleItems.map(([to, labelKey, Icon], index) => (
            <Link
              key={to}
              ref={(node) => { itemRefs.current[index] = node; }}
              to={to}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="mt-0.5 flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[12px] font-semibold text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none"
            >
              <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{sharedLabel(labelKey)}</span>
              <Plus className="size-3.5 shrink-0 opacity-40" aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MobileNavigationDrawer({
  authorization,
  sharedLabel,
  onClose,
  onLogout,
  triggerRef,
  supportFrom,
}: Readonly<{
  authorization: AuthorizationContext | null;
  sharedLabel: SharedLabel;
  onClose: () => void;
  onLogout: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  supportFrom: string;
}>) {
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      const trigger = triggerRef.current;
      if (trigger && trigger.isConnected) trigger.focus();
    };
  }, [triggerRef]);

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          const trigger = triggerRef.current;
          if (!trigger) return;
          event.preventDefault();
          trigger.focus();
        }}
        data-mobile-drawer
        data-mobile-nav-sheet
        className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[82dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none rounded-t-3xl border-0 border-t border-white/10 bg-sidebar text-sidebar-foreground shadow-[0_-18px_50px_-18px_rgb(0_0_0_/_0.7)] sm:max-h-none lg:hidden"
      >
        <DialogTitle className="sr-only">القائمة الرئيسية</DialogTitle>
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-white/20" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
          <Brand expanded />
          <Button
            autoFocus
            variant="ghost"
            className="size-10 shrink-0 px-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            onClick={onClose}
            aria-label="إغلاق القائمة"
          >
            <X className="size-5" />
          </Button>
        </div>
        <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          {authorization === null && (
            <div className="mb-4 rounded-xl border border-[hsl(var(--color-warning-text)/0.25)] bg-[hsl(var(--color-warning-bg)/0.08)] px-3 py-2.5">
              <p className="text-xs font-semibold text-warning">الصلاحيات غير مكتملة</p>
              <p className="mt-1 text-[11px] font-medium text-warning/80">
                يرجى التواصل مع مسؤول النظام لاستكمال إعداد صلاحيات حسابك.
              </p>
            </div>
          )}
          <NavigationLinks authorization={authorization} expanded sharedLabel={sharedLabel} onNavigate={onClose} />
        </nav>
        <div className="shrink-0 space-y-1 border-t border-white/8 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <Button asChild variant="ghost" className="min-h-11 w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white">
            <Link to="/help" search={{ from: supportFrom }} onClick={onClose}>
              <CircleHelp className="size-5" aria-hidden="true" />
              <span>المساعدة والدعم</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="min-h-11 w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            onClick={onLogout}
          >
            <LogOut className="size-5" />
            <span>{sharedLabel('logout')}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AppShell() {
  const router = useRouter();
  const matches = useMatches();
  const { authorization, logout } = useAuth();
  const { sidebarCollapsed, syncStatus, setSyncStatus } = useUiStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavTriggerRef = useRef<HTMLButtonElement | null>(null);
  const appLanguage = getAppLanguageState();
  const isSidebarExpanded = sidebarCollapsed === false;
  const sharedLabel = (key: string) => translateSharedLabel(key, appLanguage.language);
  const writeAccessState = getWriteAccessState(authorization);
  const writeAccessNotice =
    writeAccessState === 'read-only'
      ? {
          title: 'وضع العرض فقط',
          description: 'يمكنك استعراض البيانات، لكن الإضافة والتعديل يحتاجان صلاحية مدير أو مسؤول.',
        }
      : writeAccessState === 'unconfigured'
        ? {
            title: 'صلاحيات الحساب غير مكتملة',
            description: 'لن تتوفر الإضافة والتعديل حتى يراجع مسؤول النظام إعداد صلاحيات حسابك.',
          }
        : null;
  const pageTitle =
    ([...matches]
      .reverse()
      .find((match) => (match.staticData as { title?: string } | undefined)?.title)
      ?.staticData as { title?: string } | undefined)?.title ?? APP_BRAND_NAME;

  useEffect(() => {
    document.title = `${pageTitle} | ${APP_BRAND_NAME}`;
  }, [pageTitle]);

  useEffect(() => {
    const updateNetworkState = () => setSyncStatus(navigator.onLine ? 'idle' : 'offline');
    updateNetworkState();
    window.addEventListener('online', updateNetworkState);
    window.addEventListener('offline', updateNetworkState);
    return () => {
      window.removeEventListener('online', updateNetworkState);
      window.removeEventListener('offline', updateNetworkState);
    };
  }, [setSyncStatus]);

  const handleLogout = async () => {
    await logout();
    setMobileNavOpen(false);
    toast.success(sharedLabel('logoutSuccess'));
    await router.navigate({ to: '/login' });
  };

  return (
    <div
      data-app-shell
      className="min-h-screen min-h-dvh overflow-x-hidden bg-background text-foreground"
      dir={appLanguage.direction}
    >
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:end-4 focus:top-4 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        {sharedLabel('skipToContent')}
      </a>

      {mobileNavOpen ? (
        <MobileNavigationDrawer
          authorization={authorization}
          sharedLabel={sharedLabel}
          onClose={() => setMobileNavOpen(false)}
          onLogout={handleLogout}
          triggerRef={mobileNavTriggerRef}
          supportFrom={sanitizeSupportRoute(router.state?.location?.pathname ?? '/dashboard')}
        />
      ) : null}

      <aside
        data-sidebar
        className={cn(
          'fixed inset-y-0 right-0 z-30 hidden border-l border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sidebar transition-[width] duration-200 motion-reduce:transition-none lg:flex lg:flex-col',
          sidebarCollapsed ? 'w-[4.5rem] overflow-visible' : 'w-64 overflow-hidden',
        )}
      >
        <div
          className={cn(
            'min-h-24 border-b border-white/8 py-5',
            isSidebarExpanded ? 'px-5' : 'px-1.5',
          )}
        >
          <Brand expanded={isSidebarExpanded} />
        </div>
        <nav className="sidebar-scroll flex-1 overflow-y-auto p-4">
          <NavigationLinks authorization={authorization} expanded={isSidebarExpanded} sharedLabel={sharedLabel} />
        </nav>
        <div className="space-y-1 border-t border-white/8 p-3">
          <Button
            asChild
            variant="ghost"
            className={cn(
              'w-full gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
              sidebarCollapsed ? 'justify-center px-0' : 'justify-start',
            )}
          >
            <Link to="/help" search={{ from: sanitizeSupportRoute(router.state?.location?.pathname ?? '/dashboard') }} title="المساعدة والدعم">
              <CircleHelp className="size-5" aria-hidden="true" />
              {sidebarCollapsed ? null : <span>المساعدة والدعم</span>}
            </Link>
          </Button>
          <Button
            variant="ghost"
            className={cn(
              'w-full gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white',
              sidebarCollapsed ? 'justify-center px-0' : 'justify-start',
            )}
            onClick={handleLogout}
          >
            <LogOut className="size-5" />
            {sidebarCollapsed ? null : <span>{sharedLabel('logout')}</span>}
          </Button>
        </div>
      </aside>

      <div className={cn('w-full transition-[padding] duration-200 motion-reduce:transition-none lg:pr-64', sidebarCollapsed && 'lg:pr-[4.5rem]')}>
        <header
          data-app-shell-header
          className="sticky top-0 z-20 border-b border-border/70 bg-card/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-[backdrop-filter]:bg-card/85"
        >
          <div className="mx-auto flex min-h-14 w-full max-w-[110rem] items-center px-3 py-1 sm:px-4">
            <MalikBrand className="min-w-0" />

            <div className="ms-auto flex shrink-0 items-center gap-2 sm:gap-3" data-header-quiet-utilities>
              <HeaderDateTime />
              <Link
                to="/help"
                search={{ from: sanitizeSupportRoute(router.state?.location?.pathname ?? '/dashboard') }}
                aria-label="فتح المساعدة والدعم"
                title="المساعدة والدعم"
                className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <CircleHelp className="size-[1.05rem]" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="min-w-0 overflow-x-hidden outline-none">
          {syncStatus === 'offline' ? (
            <div
              data-global-offline-notice
              role="status"
              aria-live="polite"
              className="mx-3 mt-3 flex items-start gap-3 rounded-xl border border-[hsl(var(--color-warning-text)/0.28)] bg-[hsl(var(--color-warning-bg)/0.12)] px-4 py-3 text-warning sm:mx-4"
            >
              <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">لا يوجد اتصال بالشبكة</p>
                <p className="mt-0.5 text-xs leading-5 text-warning/85">يمكنك مراجعة البيانات الظاهرة، لكن الحفظ والتحديث قد يفشلان حتى يعود الاتصال.</p>
              </div>
            </div>
          ) : null}
          {writeAccessNotice ? (
            <div
              role="status"
              className="mb-4 flex items-start gap-3 rounded-xl border border-[hsl(var(--color-warning-text)/0.25)] bg-[hsl(var(--color-warning-bg)/0.1)] px-4 py-3 text-warning"
            >
              <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{writeAccessNotice.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-warning/80">{writeAccessNotice.description}</p>
              </div>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      <MobileFloatingControl menuRef={mobileNavTriggerRef} onMenu={() => setMobileNavOpen(true)} />
      <AiAssistantGlobalAction />
      <CommandPaletteDialog />
    </div>
  );
}
