import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarClock, CreditCard, RefreshCcw, ShieldCheck, Wrench, X, type LucideIcon } from 'lucide-react';
import type { AppPermission, AuthorizationContext } from '@/features/auth/permissions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getAppLanguageState, translateSharedLabel, type SharedLabel } from '@/lib/i18n';
import { listAppNotifications, markAppNotificationRead } from './app-notifications-service';

/**
 * Compatibility helper for consumers that still need to turn authoritative
 * Dashboard counts into action links. These links belong to «اليوم» and are
 * deliberately NOT rendered inside the notification bell anymore.
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

export function buildNotificationItems(snapshot: NotificationSnapshotInput): NotificationFeedItem[] {
  const overdueCount = snapshot?.arrears?.overdueCount ?? 0;
  const expiringCount = snapshot?.contracts?.expiring30 ?? 0;
  const urgentMaintenanceCount = snapshot?.maintenance?.urgentOpen ?? 0;

  return [
    { to: '/arrears', labelKey: 'notifOverdueInvoices', count: overdueCount, Icon: CreditCard, permission: 'arrears.view' as const },
    { to: '/contracts', labelKey: 'notifExpiringContracts', count: expiringCount, Icon: CalendarClock },
    { to: '/maintenance', labelKey: 'notifUrgentMaintenance', count: urgentMaintenanceCount, Icon: Wrench, permission: 'maintenance.view' as const },
  ].filter((item) => item.count > 0);
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
  const queryClient = useQueryClient();

  const sharedLabel = sharedLabelProp ?? ((key: string) => translateSharedLabel(key, getAppLanguageState().language));

  const persistedQuery = useQuery({
    queryKey: ['app-notifications', authorization?.userId],
    queryFn: listAppNotifications,
    enabled: Boolean(authorization?.userId),
    retry: false,
    staleTime: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markAppNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app-notifications'] }),
    onError: () => queryClient.invalidateQueries({ queryKey: ['app-notifications'] }),
  });

  const isInitialLoading = persistedQuery.isLoading && persistedQuery.data === undefined;
  const hasBlockingError = persistedQuery.isError && persistedQuery.data === undefined;

  // The bell is an event feed only. Requests/tasks that require a decision are
  // surfaced by the canonical «اليوم» workspace instead of being duplicated here.
  const visibleItems = (persistedQuery.data ?? [])
    .filter((item) => item.type !== 'permission_request')
    .map((item) => ({
      id: item.id,
      to: item.link,
      title: item.title,
      message: item.message,
      Icon: item.type === 'permission_decision' ? ShieldCheck : Bell,
      isRead: item.isRead,
    }));

  const totalCount = visibleItems.filter((item) => !item.isRead).length;

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

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndRestoreFocus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, visibleItems.length]);

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
          <div
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-xs md:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            id={menuId}
            role="dialog"
            data-mobile-notifications-panel
            tabIndex={-1}
            aria-label={sharedLabel('notifications')}
            aria-busy={isInitialLoading || undefined}
            onKeyDown={handlePanelKeyDown}
            className={cn(
              'z-50 rounded-2xl border border-border bg-card p-3 text-start text-card-foreground shadow-elevated outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
              'md:absolute md:end-0 md:top-12 md:w-80 md:max-w-[calc(100vw-1rem)]',
              'max-md:fixed max-md:inset-x-3 max-md:bottom-[var(--mobile-dock-clearance,5.25rem)] max-md:top-auto max-md:mx-auto max-md:w-auto max-md:max-w-md max-md:max-h-[min(70dvh,28rem)] max-md:overflow-y-auto max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]',
            )}
          >
            <div className="mb-2 flex items-center justify-between border-b border-border/60 pb-2">
              <div>
                <p className="text-xs font-bold text-foreground">{sharedLabel('notifications')}</p>
                <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">أحداث حصلت في المكتب</p>
              </div>
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
              <div role="status" aria-live="polite" className="mt-2 flex min-h-11 items-center gap-2 rounded-xl bg-muted/50 px-3 text-xs font-medium text-muted-foreground">
                <span className="size-2.5 rounded-full bg-primary/45" aria-hidden="true" />
                جارٍ تحميل التنبيهات…
              </div>
            ) : hasBlockingError ? (
              <div role="alert" className="mt-2 rounded-xl border border-danger/20 bg-danger/5 p-3">
                <p className="text-xs font-bold text-danger">تعذر تحميل التنبيهات</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">تحقق من الاتصال ثم أعد المحاولة.</p>
                <Button type="button" size="sm" variant="secondary" className="mt-3 w-full" onClick={() => void persistedQuery.refetch()}>
                  <RefreshCcw className="me-1.5 size-4" aria-hidden="true" />
                  إعادة المحاولة
                </Button>
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="py-3 text-center">
                <p className="text-xs font-semibold text-muted-foreground">{sharedLabel('notificationsNone')}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">الأشياء التي تحتاج منك إجراء تظهر في «اليوم».</p>
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
                        if (!item.isRead) markReadMutation.mutate(item.id);
                        setIsOpen(false);
                      }}
                      className="flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12px] font-semibold text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none"
                    >
                      <item.Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold leading-tight text-foreground">{item.title}</span>
                        {item.message ? <span className="mt-0.5 block text-xs font-medium leading-4 text-muted-foreground">{item.message}</span> : null}
                      </span>
                      {!item.isRead ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="غير مقروء" /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
