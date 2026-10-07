import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, Bell, Clock3, Info, ListChecks, RefreshCcw, ShieldCheck, X } from 'lucide-react';
import type { AuthorizationContext } from '@/features/auth/permissions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getAppLanguageState, translateSharedLabel, type SharedLabel } from '@/lib/i18n';
import { useDashboardPriorities } from '@/features/dashboard/use-dashboard-priorities';
import {
  listAppNotifications,
  markAppNotificationRead,
  type AppNotification,
} from './app-notifications-service';

/**
 * The bell carries the live priority action queue (the old «يحتاج انتباهك»
 * Today-panel) followed by the recorded event feed. Permission *requests*
 * remain excluded because their decision happens inside the workflow, while
 * completed permission decisions stay valid events.
 */
export function isBellEventNotification(notification: Pick<AppNotification, 'type'>): boolean {
  return notification.type !== 'permission_request';
}

const PRIORITY_VISIBLE_LIMIT = 6;

const severityIcon = {
  danger: AlertOctagon,
  warning: Clock3,
  info: Info,
} as const;

const severityClass = {
  danger: 'bg-danger-bg text-danger-text',
  warning: 'bg-warning-bg text-warning-text',
  info: 'bg-info-bg text-info-text',
} as const;

export function NotificationsMenu({
  authorization,
  sharedLabel: sharedLabelProp,
  chrome = 'dock',
}: Readonly<{
  authorization: AuthorizationContext | null;
  sharedLabel?: SharedLabel;
  /** `header` matches desktop shell controls; `dock` keeps the mobile floating control. */
  chrome?: 'dock' | 'header';
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const queryClient = useQueryClient();
  const location = useLocation();

  const sharedLabel = sharedLabelProp ?? ((key: string) => translateSharedLabel(key, getAppLanguageState().language));

  const notificationsQuery = useQuery({
    queryKey: ['app-notifications', authorization?.userId],
    queryFn: listAppNotifications,
    enabled: Boolean(authorization?.userId),
    retry: false,
    staleTime: 30_000,
  });

  const { signal: priorities, isLoading: prioritiesLoading } = useDashboardPriorities(
    Boolean(authorization?.userId) && isOpen,
  );

  const markReadMutation = useMutation({
    mutationFn: markAppNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app-notifications'] }),
    onError: () => queryClient.invalidateQueries({ queryKey: ['app-notifications'] }),
  });

  const visibleItems = (notificationsQuery.data ?? []).filter(isBellEventNotification);
  const unreadEvents = visibleItems.filter((item) => !item.isRead).length;
  const priorityCount = priorities.totalCount;
  const priorityDangerCount = priorities.items.filter((item) => item.severity === 'danger').length;
  // The badge counts actions that need a decision first; unread events add to it.
  const totalCount = priorityCount + unreadEvents;
  const isInitialLoading = notificationsQuery.isLoading && notificationsQuery.data === undefined;
  const hasBlockingError = notificationsQuery.isError && notificationsQuery.data === undefined;

  const visiblePriorities = priorities.items.slice(0, PRIORITY_VISIBLE_LIMIT);

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

    const totalLinks = visiblePriorities.length + visibleItems.length;
    if (totalLinks === 0 || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + delta + totalLinks) % totalLinks;
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
  }, [isOpen, visibleItems.length, visiblePriorities.length]);

  const linkRefAt = (index: number) => (node: HTMLAnchorElement | null) => {
    itemRefs.current[index] = node;
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={totalCount > 0 ? `${sharedLabel('notifications')} (${totalCount})` : sharedLabel('notifications')}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        data-header-notifications-trigger={chrome === 'header' ? 'true' : undefined}
        className={cn(
          'relative shrink-0 rounded-lg',
          totalCount > 0 ? 'text-danger hover:bg-danger/10 hover:text-danger' : undefined,
        )}
      >
        <Bell className={cn('size-[22px]', totalCount > 0 && 'text-danger')} aria-hidden="true" />
        {totalCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -end-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 py-0.5 text-xs font-bold leading-none text-white ring-2 ring-background"
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        ) : null}
      </Button>

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
            aria-busy={isInitialLoading || prioritiesLoading || undefined}
            onKeyDown={handlePanelKeyDown}
            className={cn(
              'z-50 rounded-2xl border border-border bg-card p-3 text-start text-card-foreground shadow-elevated outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
              'md:absolute md:end-0 md:top-12 md:w-96 md:max-w-[calc(100vw-1rem)]',
              'max-md:fixed max-md:inset-x-3 max-md:bottom-[var(--mobile-dock-clearance,5.25rem)] max-md:top-auto max-md:mx-auto max-md:w-auto max-md:max-w-md max-md:max-h-[min(70dvh,28rem)] max-md:overflow-y-auto max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]',
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 mb-2">
              <div>
                <p className="text-xs font-bold text-foreground">{sharedLabel('notifications')}</p>
                <p className="mt-1 text-[11px] font-semibold leading-4 text-muted-foreground">
                  قرارات اليوم في الأعلى، ثم الأحداث المسجلة.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="shrink-0 rounded-lg text-muted-foreground md:hidden"
                aria-label="إغلاق التنبيهات"
              >
                <X className="size-4" />
              </Button>
            </div>

            <ul className="space-y-1" aria-label="إجراءات تحتاج قراراً" data-notification-priorities>
              {prioritiesLoading ? (
                <li
                  role="status"
                  aria-live="polite"
                  className="flex min-h-11 items-center gap-2 rounded-xl bg-muted/50 px-3 text-xs font-medium text-muted-foreground"
                >
                  <span className="size-2.5 rounded-full bg-primary/45" aria-hidden="true" />
                  جارٍ تجميع أولويات اليوم…
                </li>
              ) : null}
              {!prioritiesLoading && priorityCount > 0 ? (
                <>
                  <li className="flex items-center gap-1.5 px-1 pt-1 text-[11px] font-black text-foreground">
                    <ListChecks className="size-3.5 text-primary" aria-hidden="true" />
                    تحتاج قراراً أو متابعة
                    <span
                      className={cn(
                        'ms-auto inline-flex min-h-5 items-center rounded-full px-1.5 text-[10px] font-black tabular-nums',
                        priorityDangerCount > 0
                          ? 'bg-danger-bg text-danger-text'
                          : 'bg-warning-bg text-warning-text',
                      )}
                    >
                      {priorityCount}
                    </span>
                  </li>
                  {visiblePriorities.map((item, index) => {
                    const Icon = severityIcon[item.severity];
                    const label = `${item.title} — ${item.meta}`;
                    const row = (
                      <>
                        <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg', severityClass[item.severity])}>
                          <Icon className="size-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-foreground">{item.title}</span>
                          <span className="mt-0.5 block line-clamp-2 text-[11px] font-medium leading-4 text-muted-foreground">{item.meta}</span>
                        </span>
                      </>
                    );
                    return (
                      <li key={item.key}>
                        {item.contractId ? (
                          <Link
                            ref={linkRefAt(index)}
                            to="/contracts/$contractId"
                            params={{ contractId: item.contractId }}
                            state={{ backgroundLocation: location } as never}
                            onClick={() => setIsOpen(false)}
                            aria-label={label}
                            data-notification-priority-link
                            className="flex min-h-11 items-start gap-2.5 rounded-xl bg-primary/[0.045] px-2.5 py-2 text-[12px] font-semibold text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none"
                          >
                            {row}
                          </Link>
                        ) : (
                          <Link
                            ref={linkRefAt(index)}
                            to={item.to}
                            search={item.search}
                            onClick={() => setIsOpen(false)}
                            aria-label={label}
                            data-notification-priority-link
                            className="flex min-h-11 items-start gap-2.5 rounded-xl bg-primary/[0.045] px-2.5 py-2 text-[12px] font-semibold text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none"
                          >
                            {row}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </>
              ) : null}
            </ul>

            {priorityCount > visiblePriorities.length ? (
              <p className="px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground">
                +{priorityCount - visiblePriorities.length} أولويات أخرى في مساحات العمل المرتبطة
              </p>
            ) : null}

            {!prioritiesLoading && priorities.isComplete === false ? (
              <p className="px-2.5 py-1.5 text-[11px] font-bold leading-5 text-warning-text" data-notification-priorities-partial>
                تعذر اكتمال قائمة الأولويات — بعض المصادر غير متاحة. الأولويات الظاهرة صحيحة لكن الإجمالي غير مؤكد.
              </p>
            ) : null}

            {priorityCount > 0 || visibleItems.length > 0 ? (
              <p className="mb-1 mt-2 border-t border-border/60 px-1 pt-2 text-[11px] font-black text-foreground">
                الأحداث المسجلة
              </p>
            ) : null}

            {isInitialLoading ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-1 flex min-h-11 items-center gap-2 rounded-xl bg-muted/50 px-3 text-xs font-medium text-muted-foreground"
              >
                <span className="size-2.5 rounded-full bg-primary/45" aria-hidden="true" />
                جارٍ تحميل التنبيهات…
              </div>
            ) : null}
            {!isInitialLoading && hasBlockingError ? (
              <div role="alert" className="mt-1 rounded-xl border border-danger/20 bg-danger/5 p-3">
                <p className="text-xs font-bold text-danger">تعذر تحميل التنبيهات</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  تحقق من الاتصال ثم أعد المحاولة. لا نعرض حالة فارغة عند فشل البيانات.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => void notificationsQuery.refetch()}
                >
                  <RefreshCcw className="me-1.5 size-4" aria-hidden="true" />
                  إعادة المحاولة
                </Button>
              </div>
            ) : null}
            {!isInitialLoading && !hasBlockingError && visibleItems.length === 0 ? (
              <div className="py-3 text-center">
                <p className="text-xs font-semibold text-muted-foreground">لا توجد أحداث جديدة حالياً</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">ستظهر هنا الدفعات المسجلة وتحديثات العقود والصيانة والقرارات المكتملة.</p>
              </div>
            ) : null}
            {!isInitialLoading && !hasBlockingError && visibleItems.length > 0 ? (
              <ul className="mt-1 space-y-1" aria-label={sharedLabel('notifications')}>
                {visibleItems.map((item, index) => {
                  const Icon = item.type === 'permission_decision' ? ShieldCheck : Bell;
                  return (
                    <li key={item.id}>
                      <Link
                        ref={linkRefAt(visiblePriorities.length + index)}
                        to={item.link}
                        onClick={() => {
                          if (!item.isRead) markReadMutation.mutate(item.id);
                          setIsOpen(false);
                        }}
                        className={cn(
                          'flex min-h-11 items-start gap-2.5 rounded-xl px-2.5 py-2 text-[12px] font-semibold text-foreground/90 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 motion-reduce:transition-none',
                          !item.isRead && 'bg-primary/[0.045]',
                        )}
                      >
                        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="size-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-foreground">{item.title}</span>
                          {item.message ? (
                            <span className="mt-0.5 block line-clamp-2 text-[11px] font-medium leading-4 text-muted-foreground">{item.message}</span>
                          ) : null}
                        </span>
                        {!item.isRead ? <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="غير مقروء" /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
