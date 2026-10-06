import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type DataRefreshAlertProps = Readonly<{
  onRetry?: () => void;
  isRefreshing?: boolean;
  title?: string;
  description?: string;
}>;

/**
 * Non-destructive background-refresh failure state.
 *
 * Use this when a query still has a previously successful payload. Replacing
 * that payload with a full-page error makes an intermittent network failure
 * look like data loss; rendering it without a warning presents stale data as
 * current. This surface keeps the data visible while labelling its freshness.
 */
export function DataRefreshAlert({
  onRetry,
  isRefreshing = false,
  title = 'تعذر تحديث البيانات',
  description = 'المعلومات المعروضة من آخر تحميل مكتمل، وليست تأكيداً للحالة الحالية. تحقق من الاتصال ثم أعد المحاولة.',
}: DataRefreshAlertProps) {
  return (
    <Alert
      variant="warning"
      title={title}
      description={description}
      action={onRetry ? (
        <Button variant="secondary" size="sm" loading={isRefreshing} onClick={onRetry}>
          إعادة المحاولة
        </Button>
      ) : undefined}
    />
  );
}
