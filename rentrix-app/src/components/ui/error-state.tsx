import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { getEnvDiagnostics, parseSupabaseDiagnostics } from '@/lib/runtime-diagnostics';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

type ErrorStateProps = {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  action?: ReactNode;
  compact?: boolean;
  variant?: 'default' | 'write';
};

const SAFE_ERROR_DETAIL = 'تعذر إكمال الطلب الآن. أعد المحاولة، وإذا استمرت المشكلة تواصل مع مسؤول النظام.';

function resolveSafeErrorMessage(error: unknown): string | null {
  if (!error) return null;
  const diagnostics = [...getEnvDiagnostics(), ...parseSupabaseDiagnostics(error)];
  return diagnostics[0]?.messageAr ?? SAFE_ERROR_DETAIL;
}

/** Shared recoverable error surface for list/detail pages. */
export function ErrorState({
  title = 'تعذر تحميل البيانات',
  description = 'تحقق من الاتصال ثم أعد المحاولة.',
  error,
  onRetry,
  action,
  compact = false,
  variant = 'default',
}: ErrorStateProps) {
  const detail = resolveSafeErrorMessage(error);

  if (variant === 'write') {
    return (
      <Card data-error-state role="alert" className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-5 text-danger" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card data-error-state role="alert" className={compact ? 'border-danger/20' : 'border-danger/25'}>
      <CardHeader className={compact ? 'p-4 pb-2' : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-5 text-danger" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={compact ? 'space-y-3 p-4 pt-0' : 'space-y-3'}>
        {detail ? (
          <p className="rounded-lg bg-danger/5 px-3 py-2 text-xs font-medium text-danger/90">
            {detail}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              <RotateCcw className="me-1.5 size-4" />
              إعادة المحاولة
            </Button>
          ) : null}
          {action}
        </div>
      </CardContent>
    </Card>
  );
}
