import type { ReactNode } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import { getEnvDiagnostics, parseSupabaseDiagnostics } from '@/lib/runtime-diagnostics';

type DataErrorScreenProps = {
  title: string;
  fallbackMessage?: string;
  error?: unknown;
  action?: ReactNode;
};

const SAFE_DATA_ERROR_FALLBACK = 'تعذر تحميل البيانات. تحقق من الاتصال ثم أعد المحاولة.';

export function DataErrorScreen({ title, fallbackMessage, error, action }: DataErrorScreenProps) {
  const diagnostics = [...getEnvDiagnostics(), ...parseSupabaseDiagnostics(error)];
  // Never surface a raw provider/SQL/network Error.message in a product-facing
  // table. Known runtime diagnostics are already translated and safe; otherwise
  // callers may supply a deliberate UX fallback, with a generic Arabic message
  // as the final guard.
  const message = diagnostics[0]?.messageAr
    ?? (error instanceof Error ? SAFE_DATA_ERROR_FALLBACK : fallbackMessage)
    ?? SAFE_DATA_ERROR_FALLBACK;

  return (
    <ErrorState
      title={title}
      description={message}
      action={action}
      ariaLive="assertive"
      className="border-destructive/40 bg-destructive/5"
    />
  );
}
