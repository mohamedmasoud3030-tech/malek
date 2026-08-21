import { Link, useLocation } from '@tanstack/react-router';
import { useEffect, useId, useState, type Ref } from 'react';
import { ChevronDown, CircleHelp, Lock, Menu, Search } from 'lucide-react';
import { useCommandPaletteStore } from '@/features/command-palette/command-palette-store';
import { canShowNavigationItem, canAccessRoute, type AuthorizationContext, type AppPermission } from '@/features/auth/permissions';
import { PermissionRequestDialog } from '@/components/layout/permission-request-dialog';
import { getNavRoot } from '@/app/navigation/route-nav-map';
import { navigationLabels } from '@/app/navigation/terminology-registry';
import { cn } from '@/lib/utils';
import { navGroups, workspaceChildNavItems, type NavItem } from '@/app/navigation/app-nav-items';
import { useAuth } from '@/hooks/use-auth';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { sanitizeSupportRoute } from '@/features/help-support/help-context';
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
          "[[data-mobile-nav-sheet]_&]:text-foreground [[data-mobile-nav-sheet]_&]:hover:bg-muted [[data-mobile-nav-sheet]_&]:hover:text-foreground [[data-mobile-nav-sheet]_&]:focus-visible:ring-primary/20",
          isChild && 'ms-3 min-h-11 border-s-2 border-s-sidebar-border/70 ps-3 [[data-mobile-nav-sheet]_&]:border-s-border/70',
          isLocked && 'cursor-not-allowed opacity-70',
          isActive && 'border-sidebar-accent/20 bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_hsl(var(--sidebar-accent-foreground)),0_12px_28px_-20px_rgb(0_0_0_/_0.9)] rtl:shadow-[inset_-3px_0_0_0_hsl(var(--sidebar-accent-foreground)),0_12px_28px_-20px_rgb(0_0_0_/_0.9)] [[data-mobile-nav-sheet]_&]:border-border/70 [[data-mobile-nav-sheet]_&]:bg-muted [[data-mobile-nav-sheet]_&]:text-foreground [[data-mobile-nav-sheet]_&]:shadow-[inset_3px_0_0_0_hsl(var(--foreground)/0.85)] rtl:[[data-mobile-nav-sheet]_&]:shadow-[inset_-3px_0_0_0_hsl(var(--foreground)/0.85)]',
        )}
      >
        <Icon className={cn(isChild ? 'size-4' : 'size-5', 'shrink-0')} aria-hidden="true" />
        {expanded ? <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{label}</span> : null}
        {isLocked ? <Lock className="ms-auto size-3.5 text-warning" aria-hidden="true" /> : null}
        {isActive ? <span className="size-1.5 shrink-0 rounded-full bg-sidebar-accent-foreground [[data-mobile-nav-sheet]_&]:bg-foreground" aria-hidden="true" /> : null}
      </Link>
    );
  };

  return (
    <div className="space-y-3 [[data-mobile-nav-sheet]_&]:rounded-2xl [[data-mobile-nav-sheet]_&]:border [[data-mobile-nav-sheet]_&]:border-border/70 [[data-mobile-nav-sheet]_&]:bg-background [[data-mobile-nav-sheet]_&]:p-2 [[data-mobile-nav-sheet]_&]:shadow-[0_10px_32px_-22px_hsl(var(--foreground)/0.35)]">
      {navGroups.map(([sectionTitle, items, adminOnly]) => {
        if (adminOnly && !items.some(([, , , , permission]) => canShowNavigationItem(authorization, permission))) return null;
        if (items.length === 0) return null;
        return (
          <section key={sectionTitle} className="space-y-0.5">
            {expanded
              ? <div className="px-3 pb-1 pt-1"><p className="text-[10px] font-bold text-sidebar-foreground/50 [[data-mobile-nav-sheet]_&]:text-muted-foreground/75">{sectionTitle}</p></div>
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
                        className="me-1 grid size-11 shrink-0 place-items-center rounded-xl text-sidebar-foreground/65 outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-4 focus-visible:ring-sidebar-accent/35 [[data-mobile-nav-sheet]_&]:text-muted-foreground [[data-mobile-nav-sheet]_&]:hover:bg-muted [[data-mobile-nav-sheet]_&]:hover:text-foreground [[data-mobile-nav-sheet]_&]:focus-visible:ring-primary/20"
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

/**
 * MALEK mobile command dock. The supplied reference informs the compact,
 * thumb-reachable control-center idea, but the hierarchy is intentionally ours:
 * search is the primary wide action while support, notifications and navigation
 * stay compact utility controls.
 */
export function MobileFloatingControl({ onMenu, menuRef }: Readonly<{ onMenu: () => void; menuRef?: Ref<HTMLButtonElement> }>) {
  const { open, isOpen } = useCommandPaletteStore();
  const { authorization } = useAuth();
  const location = useLocation();
  const appLanguage = getAppLanguageState();
  const sharedLabel = (key: string) => translateSharedLabel(key, appLanguage.language);
  const supportFrom = sanitizeSupportRoute(location.pathname);
  const isHelpActive = location.pathname === '/help' || location.pathname.startsWith('/help/');
  const utilityActionClass = 'grid size-11 shrink-0 place-items-center rounded-full border border-transparent text-muted-foreground outline-none transition-[background-color,color,border-color,box-shadow,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97] focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none motion-reduce:transform-none';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:hidden"
      data-mobile-floating-control
      data-mobile-control-center
      aria-label="مركز التحكم"
    >
      <div className="pointer-events-auto flex w-full max-w-[22rem] items-center gap-1.5 rounded-[1.7rem] border border-border/80 bg-background/92 p-1.5 shadow-[0_20px_60px_-24px_hsl(var(--foreground)/0.5),0_2px_10px_hsl(var(--foreground)/0.08)] ring-1 ring-background/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/82">
        <button
          type="button"
          onClick={open}
          aria-label="فتح البحث والأوامر"
          aria-pressed={isOpen}
          data-mobile-dock-search
          className={cn(
            'flex min-h-11 min-w-0 flex-1 items-center justify-start gap-2 rounded-[1.2rem] border border-border/80 bg-muted/55 px-3.5 text-start text-foreground outline-none transition-[background-color,color,border-color,box-shadow,transform] duration-150 hover:bg-muted active:scale-[0.99] focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none motion-reduce:transform-none',
            isOpen && 'border-foreground bg-foreground text-background shadow-sm hover:bg-foreground',
          )}
        >
          <Search className="size-[1.05rem] shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-xs font-black">بحث وأوامر</span>
          <span className={cn('size-1.5 shrink-0 rounded-full bg-primary', isOpen && 'bg-background')} aria-hidden="true" />
        </button>

        <Link
          to="/help"
          search={{ from: supportFrom }}
          aria-label="المساعدة والدعم"
          aria-current={isHelpActive ? 'page' : undefined}
          className={cn(
            utilityActionClass,
            isHelpActive && 'border-foreground bg-foreground text-background shadow-sm hover:bg-foreground hover:text-background',
          )}
        >
          <CircleHelp className="size-[1.1rem]" aria-hidden="true" />
        </Link>

        <div
          className="relative [&>div>button]:rounded-full [&>div>button]:border-transparent [&>div>button]:text-muted-foreground [&>div>button]:shadow-none [&>div>button]:hover:bg-muted [&>div>button]:hover:text-foreground [&>div>button[aria-expanded='true']]:bg-foreground [&>div>button[aria-expanded='true']]:text-background [&>div>[role='dialog']]:!bottom-14 [&>div>[role='dialog']]:!top-auto"
          data-mobile-dock-notifications
        >
          <NotificationsMenu authorization={authorization} sharedLabel={sharedLabel} />
        </div>

        <button
          ref={menuRef}
          type="button"
          onClick={onMenu}
          aria-label="فتح القائمة"
          aria-haspopup="dialog"
          className={cn(utilityActionClass, 'border-foreground bg-foreground text-background shadow-sm hover:bg-foreground hover:text-background')}
        >
          <Menu className="size-[1.1rem]" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
