import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarClock, CreditCard, RefreshCcw, ShieldAlert, ShieldCheck, Wrench, type LucideIcon } from 'lucide-react';
import { getDashboardSnapshot } from '@/features/dashboard/dashboard-snapshot';
import { toDateInputValue } from '@/features/dashboard/dashboard-utils';
import { canAccess, canShowNavigationItem, getPermissionLabel, type AppPermission, type AuthorizationContext } from '@/features/auth/permissions';
import { listPermissionRequestsForReview, type PermissionRequest } from '@/features/auth/permission-request-service';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { SharedLabel } from './layout-navigation-view';
import { listAppNotifications, markAppNotificationRead } from './app-notifications-service';

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
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [today] = useState(() => new Date());
  const queryClient = useQueryClient();
  const snapshotQuery = useDashboardSnapshotForNotifications(today);
  const persistedQuery = useQuery({
    queryKey: ['app-notifications', authorization?.userId],
    queryFn: listAppNotifications,
    enabled: Boolean(authorization?.userId),
    retry: false,
    staleTime: 30_000,
  });
  // Pending permission requests are real persisted records. Managers get a
  // distinct, actionable group instead of a generic bell notification so the
  // request never competes with operational alerts.
  const canReviewRequests = canAccess(authorization, 'permission_requests.review');
  const permissionRequestsQuery = useQuery({
    queryKey: ['permission-requests', 'review', 'notifications'],
    queryFn: () => listPermissionRequestsForReview(),
    enabled: Boolean(authorization?.userId) && canReviewRequests,
    retry: false,
    staleTime: 30_000,
  });
  const pendingPermissionRequests: readonly PermissionRequest[] = (permissionRequestsQuery.data ?? []).filter((request) => request.status === 'PENDING');
  const markReadMutation = useMutation({
    mutationFn: markAppNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app-notifications'] }),
  });
  const isInitialLoading = (snapshotQuery.isLoading && snapshotQuery.data === undefined)
    || (persistedQuery.isLoading && persistedQuery.data === undefined);
  const hasBlockingError = (snapshotQuery.isError && snapshotQuery.data === undefined)
    || (persistedQuery.isError && persistedQuery.data === undefined);

  const operationalItems = buildNotificationItems(snapshotQuery.data, today)
    .filter((item) => canShowNavigationItem(authorization, item.permission))
    .map((item) => ({ ...item, id: `operational:${item.to}`, title: sharedLabel(item.labelKey), message: '', isRead: false }));
  const persistedItems = (persistedQuery.data ?? [])
    // Pending permission requests are rendered in their own actionable group;
    // historical decisions stay in the general feed.
    .filter((item) => item.type !== 'permission_request')
    .map((item) => ({
      id: item.id,
      to: item.link,
      labelKey: '',
      title: item.title,
      message: item.message,
      count: 1,
      Icon: item.type === 'permission_decision' ? ShieldCheck : Bell,
      isRead: item.isRead,
    }));
  const visibleItems = [...persistedItems, ...operationalItems];
  const totalCount = operationalItems.reduce((sum, item) => sum + item.count, 0)
    + persistedItems.filter((item) => !item.isRead).length
    + pendingPermissionRequests.length;

  const closeAndRestoreFocus = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }

    if (visibleItems.length === 0 || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + delta + visibleItems.length) % visibleItems.length;
    event.preventDefault();
    itemRefs.current[nextIndex]?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;
    (itemRefs.current[0] ?? panelRef.current)?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeAndRestoreFocus();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasBlockingError, isInitialLoading, isOpen, visibleItems.length]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={totalCount > 0 ? `${sharedLabel('notifications')} (${totalCount})` : sharedLabel('notifications')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className="pressable relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/80 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/25 motion-reduce:transition-none"
      >
        <Bell className="size-[1rem]" aria-hidden="true" />
        {totalCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -end-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 py-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-background"
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        ) : null}
      </button>
      {isOpen ? (
        <div
          ref={panelRef}
          id={menuId}
          role="dialog"
          tabIndex={-1}
          aria-label={sharedLabel('notifications')}
          aria-busy={isInitialLoading || undefined}
          onKeyDown={handlePanelKeyDown}
          className="absolute end-0 top-12 z-50 w-72 max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-card p-3 text-start text-card-foreground shadow-elevated outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
        >
          <p className="text-xs font-semibold">{sharedLabel('notifications')}</p>
          {isInitialLoading ? (
            <div role="status" aria-live="polite" className="mt-3 flex min-h-11 items-center gap-2 rounded-xl bg-muted/50 px-3 text-xs font-medium text-muted-foreground">
              <span className="size-2.5 rounded-full bg-primary/45" aria-hidden="true" />
              جارٍ تحميل التنبيهات…
            </div>
          ) : hasBlockingError ? (
            <div role="alert" className="mt-3 rounded-xl border border-danger/20 bg-danger/5 p-3">
              <p className="text-xs font-bold text-danger">تعذر تحميل التنبيهات</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">تحقق من الاتصال ثم أعد المحاولة. لا نعرض حالة «لا توجد تنبيهات» عند فشل البيانات.</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => { void Promise.all([snapshotQuery.refetch(), persistedQuery.refetch()]); }}
              >
                <RefreshCcw className="me-1.5 size-4" aria-hidden="true" />
                إعادة المحاولة
              </Button>
            </div>
          ) : (
            <>
              {canReviewRequests && pendingPermissionRequests.length > 0 ? (
                <div data-permission-requests-need-action className="mt-2 rounded-xl border border-warning/40 bg-warning/[0.08] p-2">
                  <p className="flex items-center gap-1.5 px-1.5 pb-1.5 text-[11px] font-extrabold text-warning">
                    <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
                    طلبات تحتاج إجراء ({pendingPermissionRequests.length})
                  </p>
                  <ul className="space-y-1" aria-label="طلبات الصلاحية التي تحتاج مراجعة">
                    {pendingPermissionRequests.slice(0, 4).map((request) => (
                      <li key={request.id}>
                        <Link
                          to="/settings"
                          search={{ section: 'users-permissions', sub: 'permission-requests' } as never}
                          onClick={() => setIsOpen(false)}
                          className="flex min-h-11 items-center gap-2 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-bold text-foreground">
                              {request.requester_name?.trim() || request.requester_email || 'مستخدم مسجل'}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted-foreground">
                              {getPermissionLabel(request.permission)}
                            </span>
                            {request.reason ? (
                              <span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">{request.reason}</span>
                            ) : null}
                          </span>
                          <StatusBadge tone="warning" dot>قيد المراجعة</StatusBadge>
                          <span className="shrink-0 rounded-lg bg-warning/15 px-2 py-1 text-[10px] font-extrabold text-warning">مراجعة</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {pendingPermissionRequests.length > 4 ? (
                    <p className="px-1.5 pt-1 text-[10px] font-medium text-muted-foreground">
                      + {pendingPermissionRequests.length - 4} طلبات إضافية — افتح الشاشة للاستعراض الكامل.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {visibleItems.length === 0 ? (
                <>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">{sharedLabel('notificationsNone')}</p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{sharedLabel('notificationsHint')}</p>
                </>
              ) : (
                <ul className="mt-2 space-y-1" aria-label={sharedLabel('notifications')}>
                  {visibleItems.map((item, index) => (
                    <li key={item.id}>
                      <Link
                        ref={(node) => { itemRefs.current[index] = node; }}
                        to={item.to}
                        onClick={() => {
                          if (!item.id.startsWith('operational:') && !item.isRead) markReadMutation.mutate(item.id);
                          setIsOpen(false);
                        }}
                        className={cn(
                          'flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[12px] font-semibold text-foreground/90 transition-colors hover:bg-muted',
                          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none',
                        )}
                      >
                        <item.Icon className="size-4 shrink-0 text-warning" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{item.title}</span>
                          {item.message ? <span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">{item.message}</span> : null}
                        </span>
                        {!item.isRead ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="غير مقروء" /> : null}
                        {item.count > 1 ? <span className="grid min-w-6 place-items-center rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">{item.count}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
