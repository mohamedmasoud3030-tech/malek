import { Outlet, useMatches, useRouter } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
import { Bell, ChevronLeft, LogOut, Menu, Moon, ShieldAlert, Sun, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { getWriteAccessState, type AuthorizationContext } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';
import type { SyncStatus } from '@/types/domain';
import { CollapsedWorkspaceMenu, MobileBottomNav, NavigationLinks, WorkspaceCard, type SharedLabel } from './layout-navigation-view';
import type { QuickLinkRoute } from '@/app/navigation/app-nav-items';

function statusLabel(status: SyncStatus) {
  if (status === 'syncing') return 'جارٍ التحديث';
  if (status === 'offline') return 'وضع دون اتصال';
  if (status === 'error') return 'تحتاج المزامنة إلى مراجعة';
  return 'متصل';
}

function Brand({ expanded }: Readonly<{ expanded: boolean }>) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', !expanded && 'justify-center')}>
      <div
        className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground"
        aria-hidden="true"
      >
        R
      </div>
      {expanded ? (
        <div className="min-w-0">
          <p className="truncate text-lg font-bold tracking-tight text-white">Rentrix</p>
          <p className="truncate text-[10px] font-medium text-sidebar-foreground/55">
            مكتبك العقاري في مساحة واحدة
          </p>
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
  onQuickLink,
}: Readonly<{
  authorization: AuthorizationContext | null;
  sharedLabel: SharedLabel;
  onClose: () => void;
  onLogout: () => void;
  onQuickLink: (to: QuickLinkRoute) => void;
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
        className="animate-slide-up fixed bottom-0 left-auto right-0 top-0 z-[101] flex h-dvh w-[min(20rem,88vw)] max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 border-l border-white/10 bg-sidebar text-sidebar-foreground shadow-2xl sm:max-h-none sm:w-[min(20rem,88vw)] sm:p-0 lg:hidden"
      >
        <DialogTitle className="sr-only">القائمة الرئيسية</DialogTitle>
        {/* Brand bar */}
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
          <WorkspaceCard compact onQuickLink={onQuickLink} />
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
      ?.staticData as { title?: string } | undefined)?.title ?? 'Rentrix';

  useEffect(() => {
    document.title = `${pageTitle} | Rentrix`;
  }, [pageTitle]);

  const navigateToQuickLink = async (to: QuickLinkRoute) => {
    setMobileNavOpen(false);
    await router.navigate({ to });
  };

  const handleLogout = async () => {
    await logout();
    setMobileNavOpen(false);
    toast.success(sharedLabel('logoutSuccess'));
    await router.navigate({ to: '/login' });
  };

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsTriggerRef = useRef<HTMLButtonElement>(null);
  const notificationsMenuRef = useRef<HTMLDivElement>(null);
  const notificationsMenuId = useId();

  useEffect(() => {
    if (!notificationsOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (notificationsMenuRef.current?.contains(event.target as Node)) return;
      setNotificationsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        notificationsTriggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen]);

  return (
    <div
      className="min-h-screen min-h-dvh overflow-x-hidden bg-background text-foreground"
      dir={appLanguage.direction}
    >
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:right-4 focus:top-4"
      >
        {sharedLabel('skipToContent')}
      </a>

      {/* Mobile nav drawer */}
      {mobileNavOpen ? (
        <MobileNavigationDrawer
          authorization={authorization}
          sharedLabel={sharedLabel}
          onClose={() => setMobileNavOpen(false)}
          onLogout={handleLogout}
          onQuickLink={navigateToQuickLink}
        />
      ) : null}

      {/* Desktop sidebar — solid, clean, no gradient */}
      <aside
        data-sidebar
        className={cn(
          'fixed inset-y-0 right-0 z-30 hidden border-l border-white/8 bg-sidebar text-sidebar-foreground shadow-sidebar transition-all duration-250 lg:flex lg:flex-col',
          sidebarCollapsed ? 'w-[4.5rem] overflow-visible' : 'w-64 overflow-hidden',
        )}
      >
        <div className="min-h-24 border-b border-white/8 px-5 py-5">
          <Brand expanded={isSidebarExpanded} />
        </div>
        <nav className="sidebar-scroll flex-1 overflow-y-auto p-4">
          <NavigationLinks authorization={authorization} expanded={isSidebarExpanded} sharedLabel={sharedLabel} />
          {isSidebarExpanded ? <WorkspaceCard onQuickLink={navigateToQuickLink} /> : null}
        </nav>
        <div className="border-t border-white/8 p-3">
          {sidebarCollapsed ? <CollapsedWorkspaceMenu onQuickLink={navigateToQuickLink} /> : null}
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

      {/* Main content area */}
      <div className={cn('w-full transition-all duration-250 lg:pe-64', sidebarCollapsed && 'lg:pe-[4.5rem]')}>
        {/* Sticky header — clean, flat, mobile-optimised */}
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/92 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
          <div className="flex min-h-[3.25rem] items-center gap-1 px-2 py-1 sm:min-h-[3.5rem] sm:gap-2 sm:px-4">
            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              className="size-10 shrink-0 px-0 text-muted-foreground hover:text-foreground lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label={sharedLabel('openMenu')}
            >
              <Menu className="size-[1.1rem]" aria-hidden="true" />
            </Button>

            {/* Desktop sidebar toggle */}
            <Button
              variant="ghost"
              className="hidden size-10 shrink-0 px-0 text-muted-foreground hover:text-foreground lg:inline-flex"
              onClick={toggleSidebar}
              aria-label={sharedLabel('collapseMenu')}
            >
              <Menu className="size-[1.1rem]" aria-hidden="true" />
            </Button>

            {/* Mobile keeps the shell neutral; PageHeader owns the page title. */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold tracking-wide text-foreground sm:hidden">Rentrix</p>
              <div className="hidden items-center gap-1 sm:flex">
                <span className="text-[11px] font-medium text-muted-foreground">{sharedLabel('home')}</span>
                <ChevronLeft className="size-3 text-muted-foreground/60" aria-hidden="true" />
                <span className="truncate text-[11px] font-semibold text-foreground">{pageTitle}</span>
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {/* Sync status — desktop only */}
              <span className="hidden rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-muted-foreground sm:inline-flex lg:text-[11px] lg:px-3 lg:py-1.5">
                {statusLabel(syncStatus)}
                {lastSyncedAt
                  ? ` · ${new Date(lastSyncedAt).toLocaleTimeString(appLanguage.locale)}`
                  : ''}
              </span>

              {/* Notifications */}
              <div className="relative">
                <button
                  ref={notificationsTriggerRef}
                  type="button"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  aria-label={sharedLabel('notificationsNone')}
                  aria-haspopup="dialog"
                  aria-expanded={notificationsOpen}
                  aria-controls={notificationsOpen ? notificationsMenuId : undefined}
                  className="pressable inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/25 sm:size-10 sm:rounded-lg"
                >
                  <Bell className="size-[1rem]" aria-hidden="true" />
                </button>
                {notificationsOpen ? (
                  <div
                    ref={notificationsMenuRef}
                    id={notificationsMenuId}
                    role="dialog"
                    aria-label={sharedLabel('notificationsNone')}
                    className="absolute end-0 top-11 z-50 w-64 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-card p-3 text-start text-card-foreground shadow-elevated sm:top-12 sm:w-72"
                  >
                    <p className="text-xs font-semibold">{sharedLabel('notificationsNone')}</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      {sharedLabel('notificationsHint')}
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Theme toggle */}
              <Button
                variant="ghost"
                className="size-9 px-0 text-muted-foreground hover:text-foreground sm:size-10"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={sharedLabel('toggleTheme')}
              >
                {theme === 'dark' ? (
                  <Sun className="size-[1rem]" aria-hidden="true" />
                ) : (
                  <Moon className="size-[1rem]" aria-hidden="true" />
                )}
              </Button>

              {/* User avatar — sm and up */}
              <span
                className="hidden size-8 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground sm:grid xl:size-9"
                title={user?.email}
                aria-label={user?.email ?? undefined}
              >
                {user?.email?.charAt(0).toUpperCase() || 'R'}
              </span>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main id="main-content" tabIndex={-1} className="animate-route-in safe-bottom-app overflow-x-hidden p-3 outline-none sm:p-4 lg:p-6 lg:pb-6">
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

      {/* Mobile bottom nav */}
      <MobileBottomNav authorization={authorization} sharedLabel={sharedLabel} />
    </div>
  );
}
