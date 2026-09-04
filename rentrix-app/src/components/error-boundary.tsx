import { CatchBoundary, ErrorComponent, type ErrorComponentProps } from '@tanstack/react-router';
import type { PropsWithChildren } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { translateSharedLabel } from '@/lib/i18n';

export function RouteErrorFallback({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-2xl border-destructive/30" role="alert" aria-live="assertive">
        <CardHeader>
          <CardTitle>{translateSharedLabel('pageLoadErrorTitle')}</CardTitle>
          <CardDescription>{translateSharedLabel('pageLoadErrorDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-destructive/10 p-4 text-left font-mono text-xs text-destructive" dir="ltr">
            <ErrorComponent error={error} />
          </div>
          <Button onClick={reset}>{translateSharedLabel('retry')}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function AppCatchBoundary({ children }: PropsWithChildren) {
  return <CatchBoundary getResetKey={() => 'rentrix-root'} errorComponent={RouteErrorFallback}>{children}</CatchBoundary>;
}
