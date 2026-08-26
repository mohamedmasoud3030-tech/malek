import { Link, Outlet, useMatches, useRouter } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { CircleHelp, KeyRound, LogOut, Menu, Moon, Settings, ShieldAlert, Sun, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { MalikBrand } from '@/components/brand/malik-brand';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { canAccessRoute, getWriteAccessState, type AuthorizationContext } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { APP_BRAND_NAME } from '@/lib/brand';
import { getAppLanguageState, translateSharedLabel, type SharedLabel } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';
import { MobileFloatingControl, NavigationLinks } from './layout-navigation-view';
import { CommandPaletteDialog } from '@/features/command-palette/command-palette-dialog';
import { AiAssistantGlobalAction } from '@/features/ai-assistant/ai-assistant-global-action';
import { sanitizeSupportRoute } from '@/features/help-support/help-context';

function Brand({ expanded }: Readonly<{ expanded: boolean }>) {
  return <MalikBrand compact={!expanded} inverse showTagline={expanded} />;
}

function HeaderWordmark() {
  return (
    <p
      dir="ltr"
      data-header-wordmark
      className="malik-wordmark malek-wordmark shrink-0 select-none truncate text-[16px] font-extrabold uppercase leading-none tracking-[0.16em] text-foreground sm:text-[17px] lg:text-[18px]"
      aria-label={APP_BRAND_NAME}
    >
      {APP_BRAND_NAME}
    </p>
  );
}

function HeaderDateCenter({ language }: Readonly<{ language: string }>) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const isArabic = language === 'ar';
  const locale = isArabic ? 'ar-EG' : 'en-US';
  const dayName = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(now);
  const date = new Intl.DateTimeFormat(isArabic ? 'ar-EG' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);

  return (
    <div
      data-header-date-center
      data-lang={language}
      className="pointer-events-none flex max-w-[32vw] flex-col items-center justify-center gap-0.5 leading-none sm:max-w-[40vw]"
      aria-label={`${dayName}, ${date}`}
    >
      <span className="max-w-full truncate whitespace-nowrap text-center text-[11px] font-semibold leading-none tracking-wide text-foreground sm:text-xs">
        {dayName}
      </span>
      <span
        dir={isArabic ? 'rtl' : 'ltr'}
        className="max-w-full truncate whitespace-nowrap text-center text-[11px] font-medium leading-none tabular-nums text-muted-foreground sm:text-[11px]"
      >
        {date}
      </span>
    </div>
  );
}

function HeaderUserMenu({
  email,
  canOpenSettings,
  supportFrom,
  onLogout,
}: Readonly<{
  email?: string | null;
  canOpenSettings: boolean;
  supportFrom: string;
  onLogout: () => void | Promise<void>;
}>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const initial = email?.trim().charAt(0).toUpperCase() || 'M';

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const itemClass = 'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-semibold text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-4 focus-visible:ring-primary/20';

  return (
    <div ref={rootRef} className="relative" data-header-user-menu>
      <button
        ref={triggerRef}
        type="button"
        aria-label="فتح قائمة المستخدم"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full border border-border/70 bg-card text-foreground outline-none transition-[background-color,border-color,box-shadow,transform]',
          'hover:bg-muted active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transform-none sm:size-10',
          open && 'border-foreground/20 bg-muted shadow-sm',
        )}
      >
        <UserRound className="size-4 sm:size-[1.05rem]" aria-hidden="true" />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="قائمة المستخدم"
          className="absolute end-0 top-11 z-50 w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-border/90 bg-card text-card-foreground shadow-elevated sm:top-12"
        >
          <div className="flex items-center gap-3 border-b border-border/70 bg-muted/25 px-3.5 py-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground" aria-hidden="true">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-muted-foreground">الحساب</p>
              <p dir="ltr" className="mt-0.5 truncate text-start text-sm font-semibold text-foreground">
                {email || 'مستخدم مالك'}
              </p>
            </div>
          </div>

          <div className="space-y-0.5 p-1.5">
            {canOpenSettings ? (
              <Link to="/settings" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
                <Settings className="size-[1.125rem] shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>إعدادات المنشأة</span>
              </Link>
            ) : null}

            <Link to="/change-password" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
              <KeyRound className="size-[1.125rem] shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>تغيير كلمة المرور</span>
            </Link>

            <Link
              to="/help"
              search={{ from: supportFrom }}
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              <CircleHelp className="size-[1.125rem] shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>المساعدة والدعم</span>
            </Link>

            <div className="my-1 h-px bg-border/70" aria-hidden="true" />

            <button
              type="button"
              role="menuitem"
              className={cn(itemClass, 'text-destructive hover:bg-destructive/8')}
              onClick={() => {
                setOpen(false);
                void onLogout();
              }}
            >
              <LogOut className="size-[1.125rem] shrink-0" aria-hidden="true" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileNavigationDrawer({
  authorization,
  sharedLabel,
  onClose,
  triggerRef,
}: Readonly<{
  authorization: AuthorizationContext | null;
  sharedLabel: SharedLabel;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
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
        className="fixed inset-x-0 bottom-0 top-auto z-[101] flex max-h-[64dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none rounded-t-2xl border-0 border-t border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[0_-12px_32px_-16px_rgb(0_0_0_/_0.55)] sm:max-h-none lg:hidden"
      >
        <DialogTitle className="sr-only">القائمة الرئيسية</DialogTitle>
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-sidebar-foreground/20" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-sidebar-border/50 px-3.5 py-2.5">
          <Brand expanded />
          <Button
            autoFocus
            variant="ghost"
            className="size-9 shrink-0 px-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={onClose}
            aria-label="إغلاق القائمة"
          >
            <X className="size-[1.125rem]" />
          </Button>
        </div>
        <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
          {authorization === null && (
            <div className="mb-2 rounded-lg border border-[hsl(var(--color-warning-text)/0.2)] bg-[hsl(var(--color-warning-bg)/0.07)] px-2.5 py-2">
              <p className="text-xs font-semibold text-warning">الصلاحيات غير مكتملة</p>
              <p className="mt-0.5 text-xs font-medium leading-4 text-warning/75">
                راجع مسؤول النظام لاستكمال صلاحيات الحساب.
              </p>
            </div>
          )}
          <NavigationLinks authorization={authorization} expanded sharedLabel={sharedLabel} onNavigate={onClose} />
        </nav>
      </DialogContent>
    </Dialog>
  );
}

export function AppShell() {
  const router = useRouter();
  const matches = useMatches();
  const { authorization, logout, user } = useAuth();
  const { sidebarCollapsed, theme, setTheme, syncStatus, setSyncStatus } = useUiStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavTriggerRef = useRef<HTMLButtonElement | null>(null);
  const appLanguage = getAppLanguageState();
  const isSidebarExpanded = sidebarCollapsed === false;
  const sharedLabel = (key: string) => translateSharedLabel(key, appLanguage.language);
  const writeAccessState = getWriteAccessState(authorization);
  const supportFrom = sanitizeSupportRoute(router.state?.location?.pathname ?? '/dashboard');
  const canOpenSettings = canAccessRoute(authorization, 'company.settings.manage');
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
          triggerRef={mobileNavTriggerRef}
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
            'min-h-24 border-b border-sidebar-border/50 py-5',
            isSidebarExpanded ? 'px-5' : 'px-1.5',
          )}
        >
          <Brand expanded={isSidebarExpanded} />
        </div>
        <nav className="sidebar-scroll flex-1 overflow-y-auto p-4 pb-6">
          <NavigationLinks authorization={authorization} expanded={isSidebarExpanded} sharedLabel={sharedLabel} />
        </nav>
      </aside>

      <div className={cn('w-full transition-[padding] duration-200 motion-reduce:transition-none lg:pr-64', sidebarCollapsed && 'lg:pr-[4.5rem]')}>
        <header
          data-app-shell-header
          className="sticky top-0 z-20 border-b border-border/70 bg-card/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md supports-[backdrop-filter]:bg-card/85"
        >
          <div className="relative mx-auto flex min-h-14 w-full max-w-[110rem] items-center justify-between gap-2 px-3 py-1.5 sm:px-4">
            {/* Right side visually (first in RTL) - Controls: Menu + User + Theme */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 z-10" data-header-right-controls>
              <button
                ref={mobileNavTriggerRef}
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="فتح القائمة"
                aria-haspopup="dialog"
                data-mobile-top-menu
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/60 bg-card text-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/20 active:scale-[0.97] motion-reduce:transform-none sm:size-10 lg:hidden"
              >
                <Menu className="size-4 sm:size-[18px]" aria-hidden="true" />
              </button>

              <HeaderUserMenu
                email={user?.email}
                canOpenSettings={canOpenSettings}
                supportFrom={supportFrom}
                onLogout={handleLogout}
              />

              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={sharedLabel('toggleTheme')}
                title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-border/60 bg-card text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/20 active:scale-[0.97] motion-reduce:transform-none sm:size-10"
                data-header-theme-toggle
              >
                {theme === 'dark' ? (
                  <Sun className="size-4 sm:size-[1.05rem]" aria-hidden="true" />
                ) : (
                  <Moon className="size-4 sm:size-[1.05rem]" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Center - Day + Date exactly centered, localized */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center">
              <HeaderDateCenter language={appLanguage.language} />
            </div>

            {/* Left side visually (last in RTL) - MALEK text only, no M mark */}
            <div className="flex shrink-0 items-center z-10" data-header-wordmark-side>
              <HeaderWordmark />
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="min-w-0 overflow-x-hidden outline-none">
          {syncStatus === 'offline' ? (
            <div
              data-global-offline-notice
              role="status"
              aria-live="polite"
              className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-[hsl(var(--color-warning-text)/0.25)] bg-[hsl(var(--color-warning-bg)/0.09)] px-3 py-2 text-warning sm:mx-4"
            >
              <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 sm:flex sm:items-baseline sm:gap-2">
                <p className="text-xs font-semibold">لا يوجد اتصال بالشبكة</p>
                <p className="mt-0.5 text-xs leading-4 text-warning/80 sm:mt-0">قد يفشل الحفظ والتحديث حتى يعود الاتصال.</p>
              </div>
            </div>
          ) : null}
          {writeAccessNotice ? (
            <div
              data-write-access-notice
              role="status"
              className="mx-3 mb-2 mt-2 flex items-center gap-2 rounded-lg border border-[hsl(var(--color-warning-text)/0.2)] bg-[hsl(var(--color-warning-bg)/0.07)] px-3 py-2 text-warning sm:mx-4"
            >
              <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 sm:flex sm:items-baseline sm:gap-2">
                <p className="text-xs font-semibold">{writeAccessNotice.title}</p>
                <p className="mt-0.5 text-xs leading-4 text-warning/75 sm:mt-0">{writeAccessNotice.description}</p>
              </div>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      <MobileFloatingControl menuRef={mobileNavTriggerRef} onMenu={() => setMobileNavOpen(true)} />
      <AiAssistantGlobalAction showTrigger={false} />
      <CommandPaletteDialog />
    </div>
  );
}
