import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="border-destructive/40 bg-destructive/5" role="alert" aria-live="assertive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}
