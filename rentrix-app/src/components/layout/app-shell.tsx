import { Outlet, useMatches, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Bell, ChevronLeft, LogOut, Menu, Moon, Plus, ShieldCheck, Sun, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { AuthorizationContext } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';
import type { SyncStatus } from '@/types/domain';
import { MobileBottomNav, NavigationLinks, WorkspaceCard, type SharedLabel } from './layout-navigation-view';
import type { QuickLinkRoute } from './app-nav-items';

function statusLabel(status: SyncStatus) {
  if (status === 'syncing') return 'جارٍ التحديث';
  if (status === 'offline') return 'وضع دون اتصال';
  if (status === 'error') return 'تحتاج المزامنة إلى مراجعة';
  return 'جاهز للعمل';
}

function Brand({ expanded }: Readonly<{ expanded: boolean }>) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', !expanded && 'justify-center')}>
      <div className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-lg font-black text-slate-950 shadow-lg">
        R
        <span className="absolute -bottom-1 -left-1 size-3 rounded-full border-2 border-sidebar bg-success" />
      </div>
      {expanded ? (
        <div className="min-w-0">
          <p className="truncate text-xl font-black text-white">Rentrix</p>
          <p className="truncate text-xs font-bold text-sidebar-foreground/65">إدارة عقارية بوضوح وسرعة</p>
          <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-success">
            <ShieldCheck className="size-3" />
            مساحة عمل آمنة
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
    <Dialog open onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="animate-panel-in fixed bottom-0 left-auto right-0 top-0 z-[101] flex h-dvh w-[min(22rem,90vw)] max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 border-l border-sidebar-border bg-sidebar p-0 text-sidebar-foreground shadow-sidebar sm:max-h-none sm:w-[min(22rem,90vw)] sm:p-0 lg:hidden"
      >
        <DialogTitle className="sr-only">القائمة الرئيسية</DialogTitle>
        <div className="h-[3px] w-full bg-accent" />
        <div className="flex min-h-24 items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
          <Brand expanded />
          <Button autoFocus variant="ghost" className="size-10 shrink-0 px-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white" onClick={onClose} aria-label="إغلاق القائمة">
            <X className="size-5" />
          </Button>
        </div>
        <nav className="sidebar-scroll flex-1 overflow-y-auto p-3">
          {authorization === null && (
            <div className="mb-4 rounded-2xl border border-[hsl(var(--color-warning-text)/0.3)] bg-[hsl(var(--color-warning-bg)/0.12)] px-3 py-2.5">
              <p className="text-xs font-bold text-warning">الصلاحيات غير مكتملة</p>
              <p className="mt-1 text-[11px] font-bold text-warning/90">
                يرجى التواصل مع مسؤول النظام لاستكمال إعداد صلاحيات حسابك.
              </p>
            </div>
          )}
          <NavigationLinks authorization={authorization} expanded sharedLabel={sharedLabel} onNavigate={onClose} />
          <WorkspaceCard compact onQuickLink={onQuickLink} />
        </nav>
        <div className="border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button variant="ghost" className="min-h-11 w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white" onClick={onLogout}>
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
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const appLanguage = getAppLanguageState();
  const isSidebarExpanded = sidebarCollapsed === false;
  const sharedLabel = (key: string) => translateSharedLabel(key, appLanguage.language);
  const pageTitle =
    ([...matches]
      .reverse()
      .find((match) => (match.staticData as { title?: string } | undefined)?.title)
      ?.staticData as { title?: string } | undefined)?.title ?? 'Rentrix';

  useEffect(() => {
    document.title = `${pageTitle} | Rentrix`;
  }, [pageTitle]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuickActionsOpen((isOpen) => !isOpen);
      }
      if (event.key === 'Escape') setQuickActionsOpen(false);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navigateToQuickLink = async (to: QuickLinkRoute) => {
    setQuickActionsOpen(false);
    setMobileNavOpen(false);
    await router.navigate({ to });
  };

  const handleLogout = async () => {
    await logout();
    setMobileNavOpen(false);
    toast.success(sharedLabel('logoutSuccess'));
    await router.navigate({ to: '/login' });
  };

  const showNotifications = () => {
    toast.success('لا توجد إشعارات جديدة', { description: 'مساحة العمل جاهزة ومحدثة.' });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.055),transparent_28%),hsl(var(--background))] text-foreground" dir={appLanguage.direction}>
      <a href="#main-content" className="sr-only z-[100] rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:right-4 focus:top-4">
        تخطي إلى المحتوى الرئيسي
      </a>

      {mobileNavOpen ? (
        <MobileNavigationDrawer
          authorization={authorization}
          sharedLabel={sharedLabel}
          onClose={() => setMobileNavOpen(false)}
          onLogout={handleLogout}
          onQuickLink={navigateToQuickLink}
        />
      ) : null}

      <aside className={cn('fixed inset-y-0 right-0 z-30 hidden overflow-hidden border-l border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sidebar transition-all duration-300 lg:flex lg:flex-col', sidebarCollapsed ? 'w-20' : 'w-80')}>
        <div className="h-[3px] w-full bg-accent" />
        <div className="min-h-24 border-b border-white/10 px-5 py-5"><Brand expanded={isSidebarExpanded} /></div>
        <nav className="sidebar-scroll flex-1 overflow-y-auto p-4">
          <NavigationLinks authorization={authorization} expanded={isSidebarExpanded} sharedLabel={sharedLabel} />
          {isSidebarExpanded ? <WorkspaceCard onQuickLink={navigateToQuickLink} /> : null}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Button variant="ghost" className={cn('w-full gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-white', sidebarCollapsed ? 'justify-center px-0' : 'justify-start')} onClick={handleLogout}>
            <LogOut className="size-5" />
            {sidebarCollapsed ? null : <span>{sharedLabel('logout')}</span>}
          </Button>
        </div>
      </aside>

      <div className={cn('w-full transition-all duration-300 lg:pe-80', sidebarCollapsed && 'lg:pe-20')}>
        <header className="sticky top-0 z-20 border-b border-border bg-background/82 backdrop-blur-2xl">
          <div className="flex min-h-16 items-center gap-2 px-3 py-2 sm:min-h-20 sm:px-5">
            <Button variant="ghost" className="size-10 shrink-0 px-0 lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="فتح القائمة"><Menu className="size-5" /></Button>
            <Button variant="ghost" className="hidden size-10 shrink-0 px-0 lg:inline-flex" onClick={toggleSidebar} aria-label={sharedLabel('collapseMenu')}><Menu className="size-5" /></Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 truncate text-[11px] font-bold text-muted-foreground"><span>{sharedLabel('home')}</span><ChevronLeft className="size-3" /><span>{pageTitle}</span></div>
              <h1 className="truncate text-lg font-black tracking-tight sm:text-2xl">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="hidden rounded-2xl border border-border bg-card px-3 py-2 text-[11px] font-bold text-muted-foreground sm:inline-flex">{statusLabel(syncStatus)}{lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString(appLanguage.locale)}` : ''}</span>
              <div className="relative">
                <Button variant="secondary" className="size-10 px-0" onClick={() => setQuickActionsOpen((isOpen) => !isOpen)} aria-label="فتح الإجراءات السريعة"><Plus className="size-4" /></Button>
                {quickActionsOpen ? <div className="animate-panel-in absolute left-0 top-[calc(100%+0.65rem)] z-50 w-72 rounded-2xl border border-border bg-sidebar p-3 text-sidebar-foreground shadow-2xl"><WorkspaceCard compact onQuickLink={navigateToQuickLink} /></div> : null}
              </div>
              <Button variant="secondary" className="size-10 px-0" onClick={showNotifications} aria-label="الإشعارات"><Bell className="size-4" /></Button>
              <Button variant="secondary" className="size-10 px-0" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={sharedLabel('toggleTheme')}>{theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
              <span className="hidden size-9 place-items-center rounded-xl bg-primary text-xs font-black text-primary-foreground xl:grid" title={user?.email}>{user?.email?.charAt(0).toUpperCase() || 'R'}</span>
            </div>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="animate-route-in overflow-x-hidden p-3 pb-24 outline-none sm:p-4 sm:pb-28 lg:p-6 lg:pb-6"><Outlet /></main>
      </div>

      <MobileBottomNav authorization={authorization} sharedLabel={sharedLabel} />
    </div>
  );
}
