import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarClock, CreditCard, RefreshCcw, ShieldAlert, ShieldCheck, Wrench, X, type LucideIcon } from 'lucide-react';
import { getDashboardSnapshot } from '@/features/dashboard/dashboard-snapshot';
import { toDateInputValue } from '@/features/dashboard/dashboard-utils';
import { canAccess, canShowNavigationItem, getPermissionLabel, type AppPermission, type AuthorizationContext } from '@/features/auth/permissions';
import { listPermissionRequestsForReview, type PermissionRequest } from '@/features/auth/permission-request-service';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { getAppLanguageState, translateSharedLabel, type SharedLabel } from '@/lib/i18n';
import { listAppNotifications, markAppNotificationRead } from './app-notifications-service';

/**
 * R1 — Dashboard Truth: notification counts come from the authoritative
 * server snapshot KPIs (arrears.overdueCount, contracts.expiring30,
 * maintenance.urgentOpen). The feed never counts row datasets in the browser.
 */
export type NotificationSnapshotInput = {
  arrears?: { overdueCount?: number } | null;
  contracts?: { expiring30?: number } | null;
  maintenance?: { urgentOpen?: number } | null;
} | null | undefined;

export type NotificationFeedItem = Readonly<{
  to: string;
  labelKey: string;
  count: number;
  Icon: LucideIcon;
  permission?: AppPermission;
}>;

/**
 * Builds the notification feed from the shared dashboard snapshot.
 * Pure: no hooks, no providers — easy to assert in unit tests.
 */
export function buildNotificationItems(snapshot: NotificationSnapshotInput): NotificationFeedItem[] {
  const overdueCount = snapshot?.arrears?.overdueCount ?? 0;
  const expiringCount = snapshot?.contracts?.expiring30 ?? 0;
  const urgentMaintenanceCount = snapshot?.maintenance?.urgentOpen ?? 0;

  const items: NotificationFeedItem[] = [
    { to: '/arrears', labelKey: 'notifOverdueInvoices', count: overdueCount, Icon: CreditCard, permission: 'arrears.view' },
    { to: '/contracts', labelKey: 'notifExpiringContracts', count: expiringCount, Icon: CalendarClock },
    { to: '/maintenance', labelKey: 'notifUrgentMaintenance', count: urgentMaintenanceCount, Icon: Wrench, permission: 'maintenance.view' },
  ];
  return items.filter((item) => item.count > 0);
}

function useDashboardSnapshotForNotifications(today: Date) {
  return useQuery({
    queryKey: ['dashboard-snapshot', today.getMonth() + 1, today.getFullYear(), toDateInputValue(today)],
    queryFn: () => getDashboardSnapshot(today),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function NotificationsMenu({
  authorization,
  sharedLabel: sharedLabelProp,
}: Readonly<{ authorization: AuthorizationContext | null; sharedLabel?: SharedLabel }>) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [today] = useState(() => new Date());
  const queryClient = useQueryClient();

  const sharedLabel = sharedLabelProp ?? ((key: string) => translateSharedLabel(key, getAppLanguageState().language));

  const snapshotQuery = useDashboardSnapshotForNotifications(today);
  const persistedQuery = useQuery({
    queryKey: ['app-notifications', authorization?.userId],
    queryFn: listAppNotifications,
    enabled: Boolean(authorization?.userId),
    retry: false,
    staleTime: 30_000,
  });

  const canReviewRequests = canAccess(authorization, 'permission_requests.review');
  const permissionRequestsQuery = useQuery({
    queryKey: ['permission-requests', 'review', 'notifications'],
    queryFn: () => listPermissionRequestsForReview(),
    enabled: Boolean(authorization?.userId) && canReviewRequests,
    retry: false,
    staleTime: 30_000,
  });

  const pendingPermissionRequests: readonly PermissionRequest[] = (permissionRequestsQuery.data ?? []).filter(
    (request) => request.status === 'PENDING',
  );

  const markReadMutation = useMutation({
    mutationFn: markAppNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app-notifications'] }),
    onError: () => queryClient.invalidateQueries({ queryKey: ['app-notifications'] }),
  });

  const isInitialLoading =
    (snapshotQuery.isLoading && snapshotQuery.data === undefined) ||
    (persistedQuery.isLoading && persistedQuery.data === undefined);
  const hasBlockingError =
    (snapshotQuery.isError && snapshotQuery.data === undefined) ||
    (persistedQuery.isError && persistedQuery.data === undefined);

  const operationalItems = buildNotificationItems(snapshotQuery.data)
    .filter((item) => canShowNavigationItem(authorization, item.permission))
    .map((item) => ({
      ...item,
      id: `operational:${item.to}`,
      title: sharedLabel(item.labelKey),
      message: '',
      isRead: false,
    }));

  const persistedItems = (persistedQuery.data ?? [])
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
  const totalCount =
    operationalItems.reduce((sum, item) => sum + item.count, 0) +
    persistedItems.filter((item) => !item.isRead).length +
    pendingPermissionRequests.length;

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
        className={cn(
          'pressable relative inline-flex size-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border outline-none transition-colors focus-visible:ring-4 focus-visible:ring-primary/25 motion-reduce:transition-none',
          totalCount > 0
            ? 'border-danger/30 bg-danger/5 text-danger hover:bg-danger/10 hover:text-danger'
            : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Bell className={cn('size-[18px]', totalCount > 0 && 'text-danger')} aria-hidden="true" />
        {totalCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -end-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 py-0.5 text-xs font-bold leading-none text-white ring-2 ring-background"
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          {/* Mobile backdrop for dismiss on outside tap */}
          <div
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-xs md:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            id={menuId}
            role="dialog"
            tabIndex={-1}
            aria-label={sharedLabel('notifications')}
            aria-busy={isInitialLoading || undefined}
            onKeyDown={handlePanelKeyDown}
            className={cn(
              'z-50 rounded-2xl border border-border bg-card p-3 text-start text-card-foreground shadow-elevated outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
              // Desktop popover positioning:
              'md:absolute md:end-0 md:top-12 md:w-80 md:max-w-[calc(100vw-1rem)]',
              // Mobile panel positioning: anchored above bottom dock with safe area:
              'max-md:fixed max-md:inset-x-3 max-md:bottom-[calc(var(--mobile-floating-control-height,4.5rem)+0.75rem+env(safe-area-inset-bottom,0px))] max-md:top-auto max-md:mx-auto max-md:w-auto max-md:max-w-md max-md:max-h-[min(70dvh,28rem)] max-md:overflow-y-auto max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]',
            )}
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
              <p className="text-xs font-bold text-foreground">{sharedLabel('notifications')}</p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
                aria-label="إغلاق التنبيهات"
              >
                <X className="size-3.5" />
              </button>
            </div>

            {isInitialLoading ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-2 flex min-h-11 items-center gap-2 rounded-xl bg-muted/50 px-3 text-xs font-medium text-muted-foreground"
              >
                <span className="size-2.5 rounded-full bg-primary/45" aria-hidden="true" />
                جارٍ تحميل التنبيهات…
              </div>
            ) : hasBlockingError ? (
              <div role="alert" className="mt-2 rounded-xl border border-danger/20 bg-danger/5 p-3">
                <p className="text-xs font-bold text-danger">تعذر تحميل التنبيهات</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  تحقق من الاتصال ثم أعد المحاولة. لا نعرض حالة «لا توجد تنبيهات» عند فشل البيانات.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => {
                    void Promise.all([snapshotQuery.refetch(), persistedQuery.refetch()]);
                  }}
                >
                  <RefreshCcw className="me-1.5 size-4" aria-hidden="true" />
                  إعادة المحاولة
                </Button>
              </div>
            ) : (
              <>
                {canReviewRequests && pendingPermissionRequests.length > 0 ? (
                  <div
                    data-permission-requests-need-action
                    className="mt-2 rounded-xl border border-warning/40 bg-warning/[0.08] p-2"
                  >
                    <p className="flex items-center gap-1.5 px-1.5 pb-1.5 text-xs font-extrabold text-warning">
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
                                طلب صلاحية جديد
                              </span>
                              <span className="mt-0.5 block truncate text-xs font-semibold text-muted-foreground">
                                {getPermissionLabel(request.permission)}
                              </span>
                            </span>
                            <StatusBadge tone="warning" dot>قيد المراجعة</StatusBadge>
                            <span className="shrink-0 rounded-lg bg-warning/15 px-2 py-1 text-xs font-extrabold text-warning">
                              مراجعة
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {pendingPermissionRequests.length > 4 ? (
                      <p className="px-1.5 pt-1 text-xs font-medium text-muted-foreground">
                        + {pendingPermissionRequests.length - 4} طلبات إضافية — افتح الشاشة للاستعراض الكامل.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {visibleItems.length === 0 ? (
                  <div className="py-2 text-center">
                    <p className="text-xs font-semibold text-muted-foreground">{sharedLabel('notificationsNone')}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{sharedLabel('notificationsHint')}</p>
                  </div>
                ) : (
                  <ul className="mt-1 space-y-1" aria-label={sharedLabel('notifications')}>
                    {visibleItems.map((item, index) => (
                      <li key={item.id}>
                        <Link
                          ref={(node) => {
                            itemRefs.current[index] = node;
                          }}
                          to={item.to}
                          onClick={() => {
                            if (!item.id.startsWith('operational:') && !item.isRead) markReadMutation.mutate(item.id);
                            setIsOpen(false);
                          }}
                          className={cn(
                            'flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12px] font-semibold text-foreground/90 transition-colors hover:bg-muted',
                            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none',
                          )}
                        >
                          <item.Icon className="size-4 shrink-0 text-warning" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold leading-tight text-foreground">{item.title}</span>
                            {item.message ? (
                              <span className="mt-0.5 block text-xs font-medium leading-4 text-muted-foreground">
                                {item.message}
                              </span>
                            ) : null}
                          </span>
                          {!item.isRead ? (
                            <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="غير مقروء" />
                          ) : null}
                          {item.count > 1 ? (
                            <span className="grid min-w-6 place-items-center rounded-full bg-danger/10 px-1.5 py-0.5 text-xs font-bold text-danger">
                              {item.count}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
