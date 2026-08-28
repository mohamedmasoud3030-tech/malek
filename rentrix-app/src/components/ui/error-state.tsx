import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { getEnvDiagnostics, parseSupabaseDiagnostics } from '@/lib/runtime-diagnostics';
import { Button } from './button';
import { StateSurface } from './state-surfaces';

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
      <StateSurface
        kind="error"
        tone="danger"
        icon={<AlertTriangle className="size-5" aria-hidden="true" />}
        title={title}
        description={description}
        role="alert"
        compact
        className="border-destructive/40 bg-destructive/5"
      />
    );
  }

  const controls = onRetry || action ? (
    <div className="flex flex-wrap justify-center gap-2">
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCcw className="me-1.5 size-4" aria-hidden="true" />
          إعادة المحاولة
        </Button>
      ) : null}
      {action}
    </div>
  ) : undefined;

  return (
    <StateSurface
      kind="error"
      tone="danger"
      icon={<AlertTriangle className="size-5" aria-hidden="true" />}
      title={title}
      description={description}
      role="alert"
      compact={compact}
      detail={
        detail ? (
          <p className="rounded-lg bg-danger/5 px-3 py-2 text-xs font-medium text-danger/90">
            {detail}
          </p>
        ) : undefined
      }
      action={controls}
    />
  );
}
