import { Link, Outlet, useMatches, useRouter } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronLeft, LogOut, Menu, Moon, Plus, ShieldAlert, Sun, X } from 'lucide-react';
import { toast } from 'sonner';
import { MalikBrand } from '@/components/brand/malik-brand';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { canShowNavigationItem, getWriteAccessState, type AuthorizationContext } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { APP_BRAND_NAME } from '@/lib/brand';
import { formatLatinTime } from '@/lib/formatters';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';
import type { SyncStatus } from '@/types/domain';
import { quickCreateItems } from '@/app/navigation/app-nav-items';
import { MobileBottomNav, NavigationLinks, type SharedLabel } from './layout-navigation-view';
import { NotificationsMenu } from './notifications-menu';

function statusLabel(status: SyncStatus) {
  if (status === 'syncing') return 'جارٍ التحديث';
  if (status === 'offline') return 'وضع دون اتصال';
  if (status === 'error') return 'تحتاج المزامنة إلى مراجعة';
  return 'متصل';
}

function Brand({ expanded }: Readonly<{ expanded: boolean }>) {
  return <MalikBrand compact={!expanded} inverse showTagline={expanded} />;
}

/**
 * Header quick-create menu (#1240). Only offered to roles with write access;
 * each entry additionally respects its destination route guard so MANAGER
 * never sees actions they cannot complete. Exported for interaction regression
 * coverage; it remains owned and rendered exclusively by <AppShell> in production.
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
        className="pressable inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-900/20 outline-none transition-colors hover:bg-emerald-700 focus-visible:ring-4 focus-visible:ring-emerald-400/35 motion-reduce:transition-none"
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
}: Readonly<{
  authorization: AuthorizationContext | null;
  sharedLabel: SharedLabel;
  onClose: () => void;
  onLogout: () => void;
}>) {
  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="fixed bottom-0 left-auto right-0 top-0 z-[101] flex h-dvh w-[min(20rem,88vw)] max-h-none max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 border-l border-slate-800 bg-slate-950 text-slate-100 shadow-2xl sm:max-h-none sm:w-[min(20rem,88vw)] sm:p-0 lg:hidden"
      >
        <DialogTitle className="sr-only">القائمة الرئيسية</DialogTitle>
        <div className="flex min-h-24 items-center justify-between gap-3 border-b border-white/8 px-4 py-4 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
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
        <nav className="sidebar-scroll flex-1 overflow-y-auto overscroll-contain p-3">
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
        <div className="border-t border-white/8 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
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
  const { authorization, logout, user } = useAuth();
  const { sidebarCollapsed, theme, toggleSidebar, setTheme, syncStatus, lastSyncedAt } = useUiStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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

  const handleLogout = async () => {
    await logout();
    setMobileNavOpen(false);
    toast.success(sharedLabel('logoutSuccess'));
    await router.navigate({ to: '/login' });
  };

  return (
    <div
      data-app-shell
      className="min-h-screen min-h-dvh overflow-x-hidden bg-slate-50 text-foreground dark:bg-slate-950"
      dir={appLanguage.direction}
    >
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:end-4 focus:top-4 focus-visible:outline-2 focus-visible:outline-emerald-300 focus-visible:outline-offset-2"
      >
        {sharedLabel('skipToContent')}
      </a>

      {mobileNavOpen ? (
        <MobileNavigationDrawer
          authorization={authorization}
          sharedLabel={sharedLabel}
          onClose={() => setMobileNavOpen(false)}
          onLogout={handleLogout}
        />
      ) : null}

      <aside
        data-sidebar
        className={cn(
          'fixed inset-y-0 right-0 z-30 hidden border-l border-slate-800 bg-slate-950 text-slate-100 shadow-sidebar transition-[width] duration-200 motion-reduce:transition-none lg:flex lg:flex-col',
          sidebarCollapsed ? 'w-[4.5rem] overflow-visible' : 'w-64 overflow-hidden',
        )}
      >
        <div
          className={cn(
            'min-h-24 border-b border-white/8 py-5',
            // The collapsed rail is 4.5rem wide; tighten the inline padding so the
            // compact MALIK mark stays centered and has a comfortable touch target.
            isSidebarExpanded ? 'px-5' : 'px-1.5',
          )}
        >
          <Brand expanded={isSidebarExpanded} />
        </div>
        <nav className="sidebar-scroll flex-1 overflow-y-auto p-4">
          <NavigationLinks authorization={authorization} expanded={isSidebarExpanded} sharedLabel={sharedLabel} />
        </nav>
        <div className="border-t border-white/8 p-3">
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
          className="sticky top-0 z-20 border-b border-slate-200/80 bg-slate-50/92 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/92"
        >
          <div className="mx-auto flex min-h-[3.25rem] w-full max-w-[110rem] items-center gap-1 px-2 py-1 sm:min-h-[3.5rem] sm:gap-2 sm:px-4 sm:py-1.5">
            <Button
              variant="ghost"
              className="size-10 shrink-0 px-0 text-muted-foreground hover:text-foreground lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label={sharedLabel('openMenu')}
            >
              <Menu className="size-[1.1rem]" aria-hidden="true" />
            </Button>

            <Button
              variant="ghost"
              className="hidden size-10 shrink-0 px-0 text-muted-foreground hover:text-foreground lg:inline-flex"
              onClick={toggleSidebar}
              aria-label={sharedLabel('collapseMenu')}
            >
              <Menu className="size-[1.1rem]" aria-hidden="true" />
            </Button>

            <div className="min-w-0 flex-1">
              <div className="hidden items-center gap-1 sm:flex">
                <span className="text-[11px] font-medium text-muted-foreground">{sharedLabel('home')}</span>
                <ChevronLeft className="size-3 text-muted-foreground/60" aria-hidden="true" />
                <span className="truncate text-[11px] font-semibold text-foreground">{pageTitle}</span>
              </div>
              <p className="truncate text-[0.9375rem] font-bold tracking-tight sm:hidden">{pageTitle}</p>
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1">
              {writeAccessState === 'full' ? (
                <QuickAddMenu authorization={authorization} sharedLabel={sharedLabel} />
              ) : null}

              <span className="hidden rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground sm:inline-flex lg:text-[11px] lg:px-3 lg:py-1.5">
                {statusLabel(syncStatus)}
                {lastSyncedAt
                  ? ` · ${formatLatinTime(new Date(lastSyncedAt), appLanguage.locale)}`
                  : ''}
              </span>

              <NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />

              <Button
                variant="ghost"
                className="size-11 px-0 text-slate-500 hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={sharedLabel('toggleTheme')}
              >
                {theme === 'dark' ? (
                  <Sun className="size-[1rem]" aria-hidden="true" />
                ) : (
                  <Moon className="size-[1rem]" aria-hidden="true" />
                )}
              </Button>

              <span
                className="hidden size-8 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground sm:grid xl:size-9"
                title={user?.email}
                aria-label={user?.email ?? undefined}
              >
                {user?.email?.charAt(0).toUpperCase() || 'M'}
              </span>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="safe-bottom-app min-w-0 overflow-x-hidden bg-slate-50/70 p-3 outline-none dark:bg-slate-950 sm:p-4 lg:p-5 lg:pb-6">
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

      <MobileBottomNav authorization={authorization} sharedLabel={sharedLabel} />
    </div>
  );
}
