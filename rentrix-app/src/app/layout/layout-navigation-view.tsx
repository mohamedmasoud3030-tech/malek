import { Link, useLocation } from '@tanstack/react-router';
import { Lock, ChevronDown, Menu, Search } from 'lucide-react';
import { useCommandPaletteStore } from '@/features/command-palette/command-palette-store';
import { canShowNavigationItem, canAccessRoute, type AuthorizationContext } from '@/features/auth/permissions';
import { getNavRoot } from '@/app/navigation/route-nav-map';
import { navigationLabels } from '@/app/navigation/terminology-registry';
import { cn } from '@/lib/utils';
import { navGroups, workspaceChildNavItems, type NavItem } from '@/app/navigation/app-nav-items';

export type SharedLabel = (key: string) => string;

function navLabel(labelKey: string, sharedLabel: SharedLabel) {
  return navigationLabels[labelKey] ?? sharedLabel(labelKey);
}

export function NavigationLinks({
  authorization,
  expanded,
  sharedLabel,
  onNavigate,
}: Readonly<{ authorization: AuthorizationContext | null; expanded: boolean; sharedLabel: SharedLabel; onNavigate?: () => void }>) {
  const location = useLocation();
  const activeRoot = getNavRoot(location.pathname);
  let hiddenLockedCount = 0;

  const isItemLocked = (permission?: Parameters<typeof canAccessRoute>[1]) => Boolean(permission) && !canAccessRoute(authorization, permission);

  const renderItem = ([to, labelKey, description, Icon]: NavItem, isChild = false) => {
    const isActive = isChild
      ? activeRoot === to || location.pathname.startsWith(`${to}/`)
      : activeRoot === to;
    const label = navLabel(labelKey, sharedLabel);
    return (
      <Link
        key={`${to}:${labelKey}`}
        to={to}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        aria-label={label}
        title={expanded ? description : label}
        activeOptions={{ exact: true }}
        data-nav-item
        data-nav-child={isChild ? 'true' : undefined}
        data-active={isActive ? 'true' : undefined}
        className={cn(
          'group relative flex min-h-10 items-center gap-2.5 rounded-xl border border-transparent px-3 py-1.5 text-sidebar-foreground outline-none transition-[background-color,border-color,color,box-shadow] duration-150',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-4 focus-visible:ring-sidebar-accent/35 motion-reduce:transition-none',
          isChild && 'ms-3 min-h-9 border-s-2 border-s-sidebar-border/70 ps-3',
          isActive && 'border-sidebar-accent/20 bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_hsl(var(--sidebar-accent-foreground)),0_12px_28px_-20px_rgb(0_0_0_/_0.9)]',
        )}
      >
        <Icon className={cn(isChild ? 'size-4' : 'size-5', 'shrink-0')} aria-hidden="true" />
        {expanded ? <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{label}</span> : null}
        {isActive ? <span className="size-1.5 shrink-0 rounded-full bg-sidebar-accent-foreground" aria-hidden="true" /> : null}
      </Link>
    );
  };

  return (
    <div className="space-y-3">
      {navGroups.map(([sectionTitle, items, adminOnly]) => {
        if (adminOnly) {
          const hasAnyAdminPermission = items.some(([, , , , permission]) => canShowNavigationItem(authorization, permission));
          if (!hasAnyAdminPermission) return null;
        }
        const visibleItems = items.filter(([, , , , permission]) => {
          if (isItemLocked(permission)) hiddenLockedCount += 1;
          return canShowNavigationItem(authorization, permission);
        });
        if (visibleItems.length === 0) return null;
        return (
          <section key={sectionTitle} className="space-y-0.5">
            {expanded ? <div className="px-3 pb-1 pt-1"><p className="text-[10px] font-semibold tracking-[0.08em] text-sidebar-foreground/50">{sectionTitle}</p></div> : <div aria-hidden="true" className="mx-3 mb-1 h-px bg-white/10" />}
            {visibleItems.map((item) => {
              const [to] = item;
              const children = workspaceChildNavItems[to] ?? [];
              const visibleChildren = children.filter(([, , , , permission]) => {
                if (isItemLocked(permission)) hiddenLockedCount += 1;
                return canShowNavigationItem(authorization, permission);
              });
              return (
                <div key={to} className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">{renderItem(item)}</div>
                    {expanded && visibleChildren.length > 0 ? <ChevronDown className="me-2 size-3.5 shrink-0 text-sidebar-foreground/45" aria-hidden="true" /> : null}
                  </div>
                  {expanded && visibleChildren.length > 0 ? <div className="space-y-0.5">{visibleChildren.map((child) => renderItem(child, true))}</div> : null}
                </div>
              );
            })}
          </section>
        );
      })}

      {expanded && hiddenLockedCount > 0 ? (
        <section aria-label={sharedLabel('navUpgradeTitle')} className="rounded-2xl border border-[hsl(var(--color-warning-text)/0.22)] bg-[hsl(var(--color-warning-bg)/0.07)] px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[hsl(var(--color-warning-bg)/0.16)] text-warning"><Lock className="size-3.5" aria-hidden="true" /></span>
            <p className="text-[12px] font-bold text-warning">أقسام حسب الصلاحية</p>
            <span className="ms-auto rounded-full bg-[hsl(var(--color-warning-bg)/0.16)] px-2 py-0.5 text-[10px] font-bold text-warning/90">{hiddenLockedCount}</span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-sidebar-foreground/65">بعض الأقسام مخفية لأن دورك الحالي لا يملك صلاحية الوصول إليها.</p>
        </section>
      ) : null}
    </div>
  );
}

export function MobileFloatingControl({ onMenu }: Readonly<{ onMenu: () => void }>) {
  const { open } = useCommandPaletteStore();

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:hidden"
      data-mobile-floating-control
      aria-label="أدوات الوصول السريع"
    >
      <div className="flex items-center gap-1 rounded-2xl border border-border/80 bg-background/95 p-1 shadow-[0_14px_40px_-16px_rgb(15_23_42_/_0.45)] backdrop-blur-xl">
        <button type="button" onClick={onMenu} aria-label="فتح القائمة" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-3 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/25">
          <Menu className="size-5" aria-hidden="true" />
          <span className="sr-only">القائمة</span>
        </button>
        <button type="button" onClick={open} aria-label="فتح البحث" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-3 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/25">
          <Search className="size-5" aria-hidden="true" />
          <span className="sr-only">بحث</span>
        </button>
      </div>
    </div>
  );
}
