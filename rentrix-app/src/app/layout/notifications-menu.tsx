import { useEffect, useId, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarClock, CreditCard, Wrench, type LucideIcon } from 'lucide-react';
import { getDashboardSnapshot } from '@/features/dashboard/dashboard-snapshot';
import { toDateInputValue } from '@/features/dashboard/dashboard-utils';
import { canShowNavigationItem, type AppPermission, type AuthorizationContext } from '@/features/auth/permissions';
import { cn } from '@/lib/utils';
import type { SharedLabel } from './layout-navigation-view';

/** Contracts expiring within this window are surfaced as notifications. */
const EXPIRING_CONTRACT_WINDOW_DAYS = 30;

/**
 * Narrow structural input so the builder stays pure and unit-testable without
 * constructing the full dashboard snapshot type.
 */
export type NotificationSnapshotInput = {
  arrears?: { overdueInvoices?: readonly unknown[] } | null;
  maintenance?: { urgentRequests?: readonly unknown[] } | null;
  activeContracts?: readonly { end_date?: string | null }[] | null;
} | null | undefined;

export type NotificationFeedItem = Readonly<{
  to: string;
  labelKey: string;
  count: number;
  Icon: LucideIcon;
  permission?: AppPermission;
}>;

function isExpiringWithin(endDate: string | null | undefined, today: Date): boolean {
  if (!endDate) return false;
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(end.getTime())) return false;
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const cutoff = new Date(start);
  cutoff.setDate(cutoff.getDate() + EXPIRING_CONTRACT_WINDOW_DAYS);
  cutoff.setHours(23, 59, 59, 999);
  return end.getTime() >= start.getTime() && end.getTime() <= cutoff.getTime();
}

/**
 * Builds the notification feed from the shared dashboard snapshot.
 * Pure: no hooks, no providers — easy to assert in unit tests.
 */
export function buildNotificationItems(snapshot: NotificationSnapshotInput, today: Date): NotificationFeedItem[] {
  const overdueCount = snapshot?.arrears?.overdueInvoices?.length ?? 0;
  const expiringCount = (snapshot?.activeContracts ?? []).filter((contract) =>
    isExpiringWithin(contract.end_date, today),
  ).length;
  const urgentMaintenanceCount = snapshot?.maintenance?.urgentRequests?.length ?? 0;

  const items: NotificationFeedItem[] = [
    { to: '/arrears', labelKey: 'notifOverdueInvoices', count: overdueCount, Icon: CreditCard, permission: 'arrears.view' },
    { to: '/contracts', labelKey: 'notifExpiringContracts', count: expiringCount, Icon: CalendarClock },
    { to: '/maintenance', labelKey: 'notifUrgentMaintenance', count: urgentMaintenanceCount, Icon: Wrench, permission: 'maintenance.view' },
  ];
  return items.filter((item) => item.count > 0);
}

function useDashboardSnapshotForNotifications(today: Date) {
  return useQuery({
    // Same key as the dashboard page — navigation between pages reuses cache.
    queryKey: ['dashboard-snapshot', today.getMonth() + 1, today.getFullYear(), toDateInputValue(today)],
    queryFn: () => getDashboardSnapshot(today),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function NotificationsMenu({
  authorization,
  sharedLabel,
}: Readonly<{ authorization: AuthorizationContext | null; sharedLabel: SharedLabel }>) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [today] = useState(() => new Date());
  const snapshotQuery = useDashboardSnapshotForNotifications(today);

  const visibleItems = buildNotificationItems(snapshotQuery.data, today).filter((item) =>
    canShowNavigationItem(authorization, item.permission),
  );
  const totalCount = visibleItems.reduce((sum, item) => sum + item.count, 0);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={totalCount > 0 ? `${sharedLabel('notifications')} (${totalCount})` : sharedLabel('notifications')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className="pressable relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/25 sm:size-10 sm:rounded-lg"
      >
        <Bell className="size-[1rem]" aria-hidden="true" />
        {totalCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -end-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 py-0.5 text-[9px] font-bold leading-none text-destructive-foreground"
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        ) : null}
      </button>
      {isOpen ? (
        <div
          ref={menuRef}
          id={menuId}
          role="dialog"
          aria-label={sharedLabel('notifications')}
          className="absolute end-0 top-11 z-50 w-64 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-card p-3 text-start text-card-foreground shadow-elevated sm:w-72 sm:top-12"
        >
          <p className="text-xs font-semibold">{sharedLabel('notifications')}</p>
          {visibleItems.length === 0 ? (
            <>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">{sharedLabel('notificationsNone')}</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{sharedLabel('notificationsHint')}</p>
            </>
          ) : (
            <ul className="mt-2 space-y-1" aria-label={sharedLabel('notifications')}>
              {visibleItems.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-[12px] font-semibold text-foreground/90 transition hover:bg-muted',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
                    )}
                  >
                    <item.Icon className="size-4 shrink-0 text-warning" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{sharedLabel(item.labelKey)}</span>
                    <span className="grid min-w-6 place-items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                      {item.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
