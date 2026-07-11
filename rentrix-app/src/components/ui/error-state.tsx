import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

type ErrorStateProps = {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  action?: ReactNode;
  compact?: boolean;
};

function resolveErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return null;
}

/**
 * Shared recoverable error surface for list/detail pages.
 */
export function ErrorState({
  title = 'تعذر تحميل البيانات',
  description = 'تحقق من الاتصال والصلاحيات ثم أعد المحاولة.',
  error,
  onRetry,
  action,
  compact = false,
}: ErrorStateProps) {
  const detail = resolveErrorMessage(error);

  return (
    <Card role="alert" className={compact ? 'border-destructive/20' : 'border-destructive/25'}>
      <CardHeader className={compact ? 'p-4 pb-2' : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-5 text-destructive" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={compact ? 'space-y-3 p-4 pt-0' : 'space-y-3'}>
        {detail ? (
          <p className="rounded-xl bg-destructive/5 px-3 py-2 text-xs font-bold text-destructive/90">{detail}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              <RotateCcw className="me-2 size-4" />
              إعادة المحاولة
            </Button>
          ) : null}
          {action}
        </div>
      </CardContent>
    </Card>
  );
}
