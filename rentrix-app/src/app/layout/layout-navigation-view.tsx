import { Link, useLocation } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState, type Ref } from 'react';
import { Bot, ChevronDown, FileText, HandCoins, Lock, Menu, Plus, ReceiptText, Wrench } from 'lucide-react';
import { OPEN_AI_ASSISTANT_EVENT } from '@/features/ai-assistant/ai-assistant-global-action';
import { canShowNavigationItem, canAccessRoute, type AuthorizationContext, type AppPermission } from '@/features/auth/permissions';
import { PermissionRequestDialog } from '@/components/layout/permission-request-dialog';
import { getNavRoot } from '@/app/navigation/route-nav-map';
import { navigationLabels } from '@/app/navigation/terminology-registry';
import { cn } from '@/lib/utils';
import { navGroups, workspaceChildNavItems, type NavItem } from '@/app/navigation/app-nav-items';
import { useAuth } from '@/hooks/use-auth';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { NotificationsMenu } from './notifications-menu';

export type SharedLabel = (key: string) => string;

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
  const activeRoot = getNavRoot(location.pathname);
  const navigationId = useId();
  const [lockedRequest, setLockedRequest] = useState<{ permission: AppPermission; route: string; label: string } | null>(null);
  const [expandedRoots, setExpandedRoots] = useState<ReadonlySet<string>>(() => new Set([activeRoot]));

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
          'group relative flex min-h-11 items-center gap-2.5 rounded-xl border border-transparent px-3 py-1.5 text-sidebar-foreground outline-none transition-[background-color,border-color,color,box-shadow] duration-150',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-4 focus-visible:ring-sidebar-accent/35 motion-reduce:transition-none',
          "[[data-mobile-nav-sheet]_&]:rounded-lg [[data-mobile-nav-sheet]_&]:text-foreground [[data-mobile-nav-sheet]_&]:hover:bg-muted/70 [[data-mobile-nav-sheet]_&]:hover:text-foreground [[data-mobile-nav-sheet]_&]:focus-visible:ring-primary/20",
          isChild && 'ms-3 min-h-11 border-s-2 border-s-sidebar-border/70 ps-3 [[data-mobile-nav-sheet]_&]:border-s-border/70',
          isLocked && 'cursor-not-allowed opacity-70',
          isActive && 'border-sidebar-accent/20 bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_hsl(var(--sidebar-accent-foreground)),0_12px_28px_-20px_rgb(0_0_0_/_0.9)] rtl:shadow-[inset_-3px_0_0_0_hsl(var(--sidebar-accent-foreground)),0_12px_28px_-20px_rgb(0_0_0_/_0.9)] [[data-mobile-nav-sheet]_&]:border-primary/15 [[data-mobile-nav-sheet]_&]:bg-primary/[0.07] [[data-mobile-nav-sheet]_&]:text-foreground [[data-mobile-nav-sheet]_&]:shadow-[inset_3px_0_0_0_hsl(var(--primary)/0.9)] rtl:[[data-mobile-nav-sheet]_&]:shadow-[inset_-3px_0_0_0_hsl(var(--primary)/0.9)]',
        )}
      >
        <span
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-lg transition-colors',
            '[[data-mobile-nav-sheet]_&]:bg-muted/55',
            isActive && '[[data-mobile-nav-sheet]_&]:bg-primary/10 [[data-mobile-nav-sheet]_&]:text-primary',
          )}
        >
          <Icon className={cn(isChild ? 'size-4' : 'size-[1.05rem]', 'shrink-0')} aria-hidden="true" />
        </span>
        {expanded ? <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{label}</span> : null}
        {isLocked ? <Lock className="ms-auto size-3.5 text-warning" aria-hidden="true" /> : null}
        {isActive ? <span className="size-1.5 shrink-0 rounded-full bg-sidebar-accent-foreground [[data-mobile-nav-sheet]_&]:bg-primary" aria-hidden="true" /> : null}
      </Link>
    );
  };

  return (
    <div className="space-y-3 [[data-mobile-nav-sheet]_&]:space-y-2.5">
      {navGroups.map(([sectionTitle, items, adminOnly]) => {
        if (adminOnly && !items.some(([, , , , permission]) => canShowNavigationItem(authorization, permission))) return null;
        if (items.length === 0) return null;
        return (
          <section
            key={sectionTitle}
            className="space-y-0.5 [[data-mobile-nav-sheet]_&]:rounded-2xl [[data-mobile-nav-sheet]_&]:border [[data-mobile-nav-sheet]_&]:border-border/75 [[data-mobile-nav-sheet]_&]:bg-background [[data-mobile-nav-sheet]_&]:p-1.5 [[data-mobile-nav-sheet]_&]:shadow-[0_10px_28px_-24px_hsl(var(--foreground)/0.45)]"
          >
            {expanded
              ? <div className="px-3 pb-1 pt-1.5"><p className="text-[10px] font-bold text-sidebar-foreground/50 [[data-mobile-nav-sheet]_&]:text-muted-foreground/75">{sectionTitle}</p></div>
              : <div aria-hidden="true" className="mx-3 mb-1 h-px bg-white/10" />}
            {items.map((item) => {
              const [to] = item;
              const children = workspaceChildNavItems[to] ?? [];
              const isOpen = expandedRoots.has(to);
              const childrenId = `${navigationId}-${to.replace(/[^a-z]/gi, '') || 'root'}`;
              return (
                <div key={to} className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">{renderItem(item)}</div>
                    {expanded && children.length > 0 ? (
                      <button
                        type="button"
                        className="me-1 grid size-11 shrink-0 place-items-center rounded-xl text-sidebar-foreground/65 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-4 focus-visible:ring-sidebar-accent/35 [[data-mobile-nav-sheet]_&]:rounded-lg [[data-mobile-nav-sheet]_&]:text-muted-foreground [[data-mobile-nav-sheet]_&]:hover:bg-muted [[data-mobile-nav-sheet]_&]:hover:text-foreground [[data-mobile-nav-sheet]_&]:focus-visible:ring-primary/20"
                        aria-label={`${isOpen ? 'طي' : 'توسيع'} ${navLabel(item[1], sharedLabel)}`}
                        aria-expanded={isOpen}
                        aria-controls={childrenId}
                        onClick={() => setExpandedRoots((current) => {
                          const next = new Set(current);
                          if (next.has(to)) next.delete(to); else next.add(to);
                          return next;
                        })}
                      >
                        <ChevronDown className={cn('size-4 transition-transform motion-reduce:transition-none', !isOpen && '-rotate-90')} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {expanded && children.length > 0 ? (
                    <div id={childrenId} hidden={!isOpen} className="space-y-0.5">
                      {children.map((child) => renderItem(child, true))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        );
      })}

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
  { id: 'contract', label: 'عقد جديد', to: '/contracts/new', icon: FileText, permission: 'contracts.write' },
  { id: 'collect', label: 'تحصيل مبلغ', to: '/financials', search: { section: 'collections', view: 'invoices', quickAdd: 'collect' }, icon: HandCoins, permission: 'financial.payments.create' },
  { id: 'maintenance', label: 'طلب صيانة', to: '/maintenance', search: { section: 'maintenance', quickAdd: 'maintenance' }, icon: Wrench, permission: 'maintenance.view' },
  { id: 'utility-bill', label: 'فاتورة مرافق', to: '/maintenance', search: { section: 'utilities', quickAdd: 'utility-bill' }, icon: ReceiptText, permission: 'maintenance.view' },
];

/**
 * Compact MALEK mobile dock inspired by data-console density: navigation is
 * the primary wide action, while quick-create, AI and notifications stay small.
 */
export function MobileFloatingControl({ onMenu, menuRef }: Readonly<{ onMenu: () => void; menuRef?: Ref<HTMLButtonElement> }>) {
  const { authorization } = useAuth();
  const appLanguage = getAppLanguageState();
  const sharedLabel = (key: string) => translateSharedLabel(key, appLanguage.language);
  const [quickOpen, setQuickOpen] = useState(false);
  const quickRootRef = useRef<HTMLDivElement>(null);
  const visibleQuickActions = mobileQuickActions.filter((item) => canShowNavigationItem(authorization, item.permission));
  const utilityActionClass = 'grid size-10 shrink-0 place-items-center rounded-xl border border-transparent text-muted-foreground outline-none transition-[background-color,color,border-color,box-shadow,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none motion-reduce:transform-none';

  useEffect(() => {
    if (!quickOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (quickRootRef.current?.contains(event.target as Node)) return;
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

  const openAiAssistant = () => {
    setQuickOpen(false);
    window.dispatchEvent(new Event(OPEN_AI_ASSISTANT_EVENT));
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] md:hidden"
      data-mobile-floating-control
      data-mobile-control-center
      aria-label="مركز التحكم"
    >
      <div
        ref={quickRootRef}
        className="pointer-events-auto relative flex w-full max-w-[20rem] items-center gap-1 rounded-[1.35rem] border border-border/80 bg-background/94 p-1 shadow-[0_16px_44px_-24px_hsl(var(--foreground)/0.5),0_1px_6px_hsl(var(--foreground)/0.08)] ring-1 ring-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/86"
      >
        {quickOpen ? (
          <div
            role="menu"
            aria-label="الإضافة السريعة"
            data-mobile-quick-add-menu
            className="absolute inset-x-0 bottom-[calc(100%+0.45rem)] grid grid-cols-2 gap-1 rounded-xl border border-border/85 bg-background/98 p-1.5 shadow-elevated backdrop-blur-xl"
          >
            {visibleQuickActions.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  search={item.search as Record<string, string> | undefined}
                  role="menuitem"
                  onClick={() => setQuickOpen(false)}
                  className="flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-xs font-bold text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-4 focus-visible:ring-primary/20"
                >
                  <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null}

        <button
          ref={menuRef}
          type="button"
          onClick={() => {
            setQuickOpen(false);
            onMenu();
          }}
          aria-label="فتح القائمة"
          aria-haspopup="dialog"
          data-mobile-dock-menu
          className="flex min-h-10 min-w-0 flex-1 items-center justify-start gap-2 rounded-xl border border-foreground bg-foreground px-3 text-start text-background outline-none transition-[background-color,box-shadow,transform] duration-150 hover:bg-foreground/92 active:scale-[0.99] focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none motion-reduce:transform-none"
        >
          <Menu className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-xs font-black">القائمة</span>
        </button>

        <button
          type="button"
          onClick={() => setQuickOpen((value) => !value)}
          aria-label="فتح الإضافة السريعة"
          aria-haspopup="menu"
          aria-expanded={quickOpen}
          title="إضافة سريعة"
          data-mobile-dock-quick-add
          className={cn(utilityActionClass, quickOpen && 'border-primary/20 bg-primary/10 text-primary')}
        >
          <Plus className="size-[1.05rem]" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={openAiAssistant}
          aria-label="فتح المساعد الذكي"
          title="المساعد الذكي"
          data-mobile-dock-ai
          className={cn(utilityActionClass, 'text-primary hover:bg-primary/10 hover:text-primary')}
        >
          <Bot className="size-4" aria-hidden="true" />
        </button>

        <div
          className="relative [&>div>button]:!size-10 [&>div>button]:!rounded-xl [&>div>button]:!border-transparent [&>div>button]:!text-muted-foreground [&>div>button]:!shadow-none [&>div>button]:hover:!bg-muted [&>div>button]:hover:!text-foreground [&>div>button[aria-expanded='true']]:!bg-foreground [&>div>button[aria-expanded='true']]:!text-background [&>div>[role='dialog']]:!bottom-12 [&>div>[role='dialog']]:!top-auto"
          data-mobile-dock-notifications
        >
          <NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />
        </div>
      </div>
    </div>
  );
}