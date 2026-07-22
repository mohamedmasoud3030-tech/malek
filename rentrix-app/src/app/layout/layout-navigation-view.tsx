import { Link } from '@tanstack/react-router';
import { Lock } from 'lucide-react';
import { canShowNavigationItem, canAccessRoute, type AuthorizationContext } from '@/features/auth/permissions';
import { cn } from '@/lib/utils';
import { mobileNavItems, navGroups } from '@/app/navigation/app-nav-items';

export type SharedLabel = (key: string) => string;

export function NavigationLinks({
  authorization,
  expanded,
  sharedLabel,
  onNavigate,
}: Readonly<{ authorization: AuthorizationContext | null; expanded: boolean; sharedLabel: SharedLabel; onNavigate?: () => void }>) {
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
            {visibleItems.map(([to, labelKey, description, Icon]) => (
              <Link
                key={`${to}:${labelKey}`}
                to={to}
                onClick={onNavigate}
                aria-label={sharedLabel(labelKey)}
                title={expanded ? description : sharedLabel(labelKey)}
                activeOptions={{ exact: to === '/dashboard' }}
                className={cn(
                  'group relative flex min-h-11 items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sidebar-foreground transition-all',
                  'hover:bg-white/[0.075] hover:text-white',
                  '[&.active]:border-white/10 [&.active]:bg-white/[0.13] [&.active]:text-white [&.active]:shadow-[inset_-3px_0_0_0_hsl(var(--primary)),0_10px_28px_-18px_rgba(0,0,0,0.75)]',
                )}
              >
                <Icon className="size-5 shrink-0 transition-transform group-hover:scale-110" aria-hidden="true" />
                {expanded ? (
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{sharedLabel(labelKey)}</span>
                  </span>
                ) : null}
              </Link>
            ))}
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

export function MobileBottomNav({ authorization, sharedLabel }: Readonly<{ authorization: AuthorizationContext | null; sharedLabel: SharedLabel }>) {
  const visibleItems = mobileNavItems.filter(([, , , permission]) => canShowNavigationItem(authorization, permission));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/96 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-1px_0_0_hsl(var(--border)/0.6),0_-16px_40px_-20px_rgba(0,0,0,0.18)] backdrop-blur-xl lg:hidden"
      aria-label="التنقل الرئيسي"
      data-mobile-bottom-nav
    >
      <div
        className="grid h-[3.75rem] min-w-0 items-stretch px-0.5"
        style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}
      >
        {visibleItems.map(([to, labelKey, Icon]) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === '/dashboard' }}
            aria-label={sharedLabel(labelKey)}
            className={cn(
              'group relative flex min-h-0 min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2 text-muted-foreground',
              'transition-colors duration-150 focus-visible:outline-none motion-reduce:transition-none',
              '[&.active]:text-primary',
            )}
          >
            {/* active pill background */}
            <span
              aria-hidden="true"
              className="absolute inset-x-1.5 inset-y-1 rounded-2xl bg-primary/0 transition-all duration-200 motion-reduce:transition-none group-[.active]:bg-primary/[0.09]"
            />
            {/* active top hairline */}
            <span
              aria-hidden="true"
              className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary opacity-0 transition-all duration-200 motion-reduce:transition-none group-[.active]:opacity-100"
            />
            <Icon className="relative z-10 size-[1.2rem] shrink-0 transition-transform duration-150 group-active:scale-90" aria-hidden="true" />
            <span className="relative z-10 max-w-full truncate text-[9.5px] font-bold leading-none tracking-tight">{sharedLabel(labelKey)}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
