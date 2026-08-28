import { Link, Outlet, useMatches, useRouter } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { CircleHelp, KeyRound, LogOut, Moon, Settings, ShieldAlert, Sun, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { MalekBrandWordmark } from '@/components/brand/malek-wordmark';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { canAccessRoute, getWriteAccessState, type AuthorizationContext } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { APP_BRAND_NAME, APP_BRAND_TAGLINE_AR } from '@/lib/brand';
import { getAppLanguageState, translateSharedLabel, type SharedLabel } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';
import { MobileFloatingControl, NavigationLinks } from './layout-navigation-view';
import { CommandPaletteDialog } from '@/features/command-palette/command-palette-dialog';
import { AiAssistantGlobalAction } from '@/features/ai-assistant/ai-assistant-global-action';
import { sanitizeSupportRoute } from '@/features/help-support/help-context';

function Brand({ expanded, showTagline }: Readonly<{ expanded: boolean; showTagline?: boolean }>) {
  return (
    <div className="flex min-w-0 flex-col gap-2" data-malek-brand-lockup data-layout="horizontal" data-sidebar-brand>
      <MalekBrandWordmark size="sidebar" />
      {showTagline && expanded ? (
        <p className="text-xs font-medium leading-tight text-sidebar-foreground/60">{APP_BRAND_TAGLINE_AR}</p>
      ) : null}
    </div>
  );
}

/**
 * MALEK final header brand — M Malek wordmark, M larger than Malek, no icon container.
 * Tapping opens primary navigation on mobile. No surrounding shape/background tile.
 * Theme-aware colors via [data-malek-brand-wordmark] CSS.
 */
function HeaderBrandWordmarkButton({
  onClick,
  buttonRef,
}: Readonly<{
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}>) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label="القائمة الرئيسية - مالك"
      aria-haspopup="dialog"
      title="القائمة الرئيسية"
      data-header-brand-button
      data-header-brand-monogram
      data-header-brand-wordmark-button
      className="inline-flex min-h-11 items-center justify-center rounded-lg p-1.5 -ms-1.5 outline-none transition-[background-color,opacity] duration-150 hover:bg-muted/70 active:opacity-85 focus-visible:ring-2 focus-visible:ring-primary/20"
    >
      <MalekBrandWordmark size="header" />
    </button>
  );
}

function HeaderBrandLockup({
  onOpenNav,
  monogramRef,
}: Readonly<{
  onOpenNav: () => void;
  monogramRef?: Ref<HTMLButtonElement>;
}>) {
  return (
    <div className="flex min-w-0 shrink-0 items-center" data-header-brand-lockup data-header-wordmark-side>
      <HeaderBrandWordmarkButton onClick={onOpenNav} buttonRef={monogramRef} />
    </div>
  );
}

/**
 * Header control — standalone icon, no visible box, 44px touch target via padding.
 * Clearly visible, aligned, consistent size, not dominating.
 */
function HeaderControl({
  label,
  children,
  ref,
  ...props
}: Readonly<{
  label: string;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>>) {
  const { className, ...rest } = props;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      data-header-control-standalone
      data-header-control-hit
      className={cn(
        'grid place-items-center min-h-11 min-w-11 rounded-lg border-0 bg-transparent p-2.5 text-foreground outline-none transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80 focus-visible:ring-2 focus-visible:ring-primary/20',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
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

  const itemClass =
    'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-semibold text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/20';

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center" data-header-user-menu data-header-control-hit>
      <button
        ref={triggerRef}
        type="button"
        aria-label="فتح قائمة المستخدم"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        data-header-control-standalone
        className={cn(
          'grid place-items-center min-h-11 min-w-11 rounded-lg border-0 bg-transparent p-2.5 text-foreground outline-none transition-colors hover:bg-muted hover:text-foreground active:bg-muted/80 focus-visible:ring-2 focus-visible:ring-primary/20',
          open && 'bg-muted text-foreground',
        )}
      >
        <UserRound className="size-[18px]" aria-hidden="true" />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/15 backdrop-blur-[1px] md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            id={menuId}
            role="menu"
            aria-label="قائمة المستخدم"
            data-account-menu-panel
            className="absolute end-0 top-[calc(100%+0.5rem)] z-50 w-[min(17rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-elevated"
          >
            <div className="flex items-center gap-3 border-b border-border bg-muted/60 px-3.5 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-black text-primary-foreground" aria-hidden="true">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-muted-foreground">الحساب</p>
                <p dir="ltr" className="mt-0.5 truncate text-start text-[13px] font-semibold text-foreground">
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

              <div className="my-1 h-px bg-border" aria-hidden="true" />

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
        </>
      ) : null}
    </div>
  );
}

function MobileNavigationSheet({
  authorization,
  sharedLabel,
  onClose,
}: Readonly<{
  authorization: AuthorizationContext | null;
  sharedLabel: SharedLabel;
  onClose: () => void;
}>) {
  return (
    <BottomSheet
      open
      onClose={onClose}
      title="القائمة الرئيسية"
      className="max-h-[min(86dvh,52rem)] lg:hidden"
    >
      <div data-mobile-nav-sheet data-mobile-nav-bottom-sheet className="space-y-3">
        {authorization === null ? (
          <div className="rounded-xl border border-[hsl(var(--color-warning-text)/0.2)] bg-[hsl(var(--color-warning-bg)/0.07)] px-3 py-2.5">
            <p className="text-xs font-semibold text-warning">الصلاحيات غير مكتملة</p>
            <p className="mt-0.5 text-xs font-medium leading-4 text-warning/75">
              راجع مسؤول النظام لاستكمال صلاحيات الحساب.
            </p>
          </div>
        ) : null}
        <nav className="min-h-0" aria-label="القائمة الرئيسية">
          <NavigationLinks authorization={authorization} expanded sharedLabel={sharedLabel} onNavigate={onClose} />
        </nav>
      </div>
    </BottomSheet>
  );
}

export function AppShell() {
  const router = useRouter();
  const matches = useMatches();
  const { authorization, logout, user } = useAuth();
  const { theme, setTheme, syncStatus, setSyncStatus } = useUiStore();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const dockMenuTriggerRef = useRef<HTMLButtonElement | null>(null);

  const handleOpenNav = () => setMobileNavOpen(true);
  const appLanguage = getAppLanguageState();
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
    >
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:end-4 focus:top-4 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        {sharedLabel('skipToContent')}
      </a>

      {mobileNavOpen ? (
        <MobileNavigationSheet
          authorization={authorization}
          sharedLabel={sharedLabel}
          onClose={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        data-sidebar
        className="fixed inset-y-0 right-0 z-30 hidden w-[14rem] overflow-hidden border-l border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col"
      >
        <div className="flex min-h-[4.5rem] items-center border-b border-sidebar-border/60 px-5 py-4">
          <Brand expanded />
        </div>
        <nav className="sidebar-scroll flex-1 overflow-y-auto p-3 pb-6">
          <NavigationLinks authorization={authorization} expanded sharedLabel={sharedLabel} />
        </nav>
      </aside>

      <div className="w-full lg:pr-[14rem]">
        <header
          data-app-shell-header
          className="sticky top-0 z-20 border-b border-border bg-card pt-[env(safe-area-inset-top,0px)]"
        >
          <div className="mx-auto flex min-h-[var(--app-header-height)] w-full max-w-[110rem] items-center justify-between gap-2 px-3 py-1 sm:px-4">
            <div className="z-10 flex shrink-0 items-center" data-header-brand-side data-header-wordmark-side>
              <HeaderBrandLockup onOpenNav={handleOpenNav} />
            </div>

            <div className="z-10 flex shrink-0 items-center gap-0.5" data-header-utility-side data-header-right-controls>
              <HeaderControl
                label={sharedLabel('toggleTheme')}
                title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                data-header-theme-toggle
              >
                {theme === 'dark' ? (
                  <Sun className="size-[18px]" aria-hidden="true" />
                ) : (
                  <Moon className="size-[18px]" aria-hidden="true" />
                )}
              </HeaderControl>

              <HeaderUserMenu
                email={user?.email}
                canOpenSettings={canOpenSettings}
                supportFrom={supportFrom}
                onLogout={handleLogout}
              />
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="min-w-0 overflow-x-hidden outline-none">
          {syncStatus === 'offline' ? (
            <div
              data-global-offline-notice
              role="status"
              aria-live="polite"
              className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-[hsl(var(--color-warning-text)/0.22)] bg-[hsl(var(--color-warning-bg)/0.09)] px-3.5 py-2.5 text-warning sm:mx-4"
            >
              <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 sm:flex sm:items-baseline sm:gap-2">
                <p className="text-[13px] font-bold">لا يوجد اتصال بالشبكة</p>
                <p className="mt-0.5 text-[12px] leading-4 text-warning/80 sm:mt-0">قد يفشل الحفظ والتحديث حتى يعود الاتصال.</p>
              </div>
            </div>
          ) : null}
          {writeAccessNotice ? (
            <div
              data-write-access-notice
              role="status"
              className="mx-3 mb-2 mt-3 flex items-center gap-2 rounded-xl border border-[hsl(var(--color-warning-text)/0.18)] bg-[hsl(var(--color-warning-bg)/0.07)] px-3.5 py-2.5 text-warning sm:mx-4"
            >
              <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 sm:flex sm:items-baseline sm:gap-2">
                <p className="text-[13px] font-bold">{writeAccessNotice.title}</p>
                <p className="mt-0.5 text-[12px] leading-4 text-warning/75 sm:mt-0">{writeAccessNotice.description}</p>
              </div>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      <MobileFloatingControl
        menuRef={dockMenuTriggerRef}
        onMenu={handleOpenNav}
        drawerOpen={mobileNavOpen}
      />
      <AiAssistantGlobalAction showTrigger={false} />
      <CommandPaletteDialog />
    </div>
  );
}
