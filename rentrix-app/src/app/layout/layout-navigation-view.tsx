import { Link, useLocation } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { canShowNavigationItem, canAccessRoute, type AuthorizationContext } from '@/features/auth/permissions';
import { getNavRoot } from '@/app/navigation/route-nav-map';
import { cn } from '@/lib/utils';
import { mobileNavItems, navGroups } from '@/app/navigation/app-nav-items';

export type SharedLabel = (key: string) => string;

/**
 * Full desktop/sidebar and mobile-drawer IA. Active state is deliberately
 * derived from the canonical route map rather than a local tab value or
 * TanStack's fuzzy parent matching, so redirected/deep-linked workspaces keep
 * one truthful primary-navigation root.
 */
export function NavigationLinks({
  authorization,
  expanded,
  sharedLabel,
  onNavigate,
}: Readonly<{ authorization: AuthorizationContext | null; expanded: boolean; sharedLabel: SharedLabel; onNavigate?: () => void }>) {
  const location = useLocation();
  const activeRoot = getNavRoot(location.pathname);
  // Locked entries are no longer rendered one-by-one (a wall of 🔒 icons made
  // restricted roles feel the app is broken). Instead they are hidden and the
  // user gets a single upgrade hint at the bottom of the navigation.
  let hiddenLockedCount = 0;

  const groups = navGroups.map(([sectionTitle, items, adminOnly]) => {
    // UX-019: hide the entire admin group when the user has no admin-style permission
    // across any of its entries.
    if (adminOnly) {
      const hasAnyAdminPermission = items.some(([, , , , permission]) => canShowNavigationItem(authorization, permission));
      if (!hasAnyAdminPermission) return null;
    }
    const visibleItems = items.filter(([, , , , permission]) => {
      const isLocked = Boolean(permission) && !canAccessRoute(authorization, permission);
      if (isLocked) {
        hiddenLockedCount += 1;
        return false;
      }
      return canShowNavigationItem(authorization, permission);
    });
    if (visibleItems.length === 0) return null;

    return { sectionTitle, visibleItems };
  });

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        if (!group) return null;
        const { sectionTitle, visibleItems } = group;

        return (
          <section key={sectionTitle} className="space-y-1">
            {expanded ? (
              <div className="px-3 pb-1">
                <p className="text-[10px] font-semibold tracking-[0.08em] text-sidebar-foreground/50">
                  {sectionTitle}
                </p>
              </div>
            ) : (
              <div aria-hidden="true" className="mx-3 mb-1 h-px bg-white/10" />
            )}
            {visibleItems.map(([to, labelKey, description, Icon]) => {
              const isActive = activeRoot === to;
              return (
                <Link
                  key={`${to}:${labelKey}`}
                  to={to}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={sharedLabel(labelKey)}
                  title={expanded ? description : sharedLabel(labelKey)}
                  activeOptions={{ exact: true }}
                  data-nav-item
                  data-active={isActive ? 'true' : undefined}
                  className={cn(
                    'group relative flex min-h-11 items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sidebar-foreground outline-none transition-[background-color,border-color,color,box-shadow] duration-150',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-4 focus-visible:ring-sidebar-accent/35 motion-reduce:transition-none',
                    isActive && 'border-sidebar-accent/20 bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_0_hsl(var(--sidebar-accent-foreground)),0_12px_28px_-20px_rgb(0_0_0_/_0.9)]',
                  )}
                >
                  <Icon className={cn('size-5 shrink-0 transition-transform duration-150 motion-reduce:transition-none', !isActive && 'group-hover:scale-110')} aria-hidden="true" />
                  {expanded ? (
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{sharedLabel(labelKey)}</span>
                    </span>
                  ) : null}
                  {isActive ? <span className="size-1.5 shrink-0 rounded-full bg-sidebar-accent-foreground" aria-hidden="true" /> : null}
                </Link>
              );
            })}
          </section>
        );
      })}

      {expanded && hiddenLockedCount > 0 ? (
        <section
          aria-label={sharedLabel('navUpgradeTitle')}
          className="rounded-2xl border border-[hsl(var(--color-warning-text)/0.22)] bg-[hsl(var(--color-warning-bg)/0.07)] px-3 py-3"
        >
          <div className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[hsl(var(--color-warning-bg)/0.16)] text-warning">
              <Lock className="size-3.5" aria-hidden="true" />
            </span>
            <p className="text-[12px] font-bold text-warning">{sharedLabel('navUpgradeTitle')}</p>
            <span className="ms-auto rounded-full bg-[hsl(var(--color-warning-bg)/0.16)] px-2 py-0.5 text-[10px] font-bold text-warning/90">
              {hiddenLockedCount}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-sidebar-foreground/65">
            {sharedLabel('navUpgradeHint')}
          </p>
        </section>
      ) : null}
    </div>
  );
}

/** Compact, role-aware mobile destinations. The drawer retains the complete IA. */
export function MobileBottomNav({ authorization, sharedLabel }: Readonly<{ authorization: AuthorizationContext | null; sharedLabel: SharedLabel }>) {
  const location = useLocation();
  const activeRoot = getNavRoot(location.pathname);
  const visibleItems = mobileNavItems.filter(([, , , permission]) => canShowNavigationItem(authorization, permission));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-1px_0_0_rgb(148_163_184_/_0.24),0_-16px_40px_-24px_rgb(15_23_42_/_0.28)] backdrop-blur-xl lg:hidden"
      aria-label="التنقل الرئيسي"
      data-mobile-bottom-nav
    >
      <div className="flex h-[3.875rem] min-w-0 items-stretch overflow-x-auto px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleItems.map(([to, labelKey, Icon]) => {
          const isActive = activeRoot === to;
          return (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={sharedLabel(labelKey)}
              data-nav-item
              data-active={isActive ? 'true' : undefined}
              className={cn(
                'group relative flex min-h-11 min-w-11 flex-1 basis-0 flex-col items-center justify-center gap-0.5 px-1 py-2 text-muted-foreground outline-none transition-colors duration-150 focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/35 motion-reduce:transition-none',
                isActive && 'text-primary',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-x-1.5 inset-y-1 rounded-2xl transition-colors duration-150 motion-reduce:transition-none',
                  isActive ? 'bg-primary/12' : 'bg-transparent',
                )}
              />
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-x-4 top-0 h-0.5 rounded-full transition-opacity duration-150 motion-reduce:transition-none',
                  isActive ? 'bg-primary opacity-100' : 'bg-transparent opacity-0',
                )}
              />
              <Icon className="relative z-10 size-[1.2rem] shrink-0 transition-transform duration-150 group-active:scale-90 motion-reduce:transition-none" aria-hidden="true" />
              <span className="relative z-10 max-w-full truncate text-[9.5px] font-bold leading-none tracking-tight">{sharedLabel(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
