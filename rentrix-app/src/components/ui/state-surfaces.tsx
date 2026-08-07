import { CloudOff, LockKeyhole } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent } from './card';

type StateSurfaceProps = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

/** Offline indicator surface. Presentational only — does not touch network state. */
export function OfflineState({ title, description, action, className }: StateSurfaceProps) {
  return (
    <Card data-offline-state role="status" aria-live="polite" className={className}>
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-xl bg-warning-bg text-warning">
          <CloudOff className="size-7" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 max-w-md text-[0.8125rem] leading-6 text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

/** No-permission surface. Presentational only — enforcement stays in route guards. */
export function NoPermissionState({ title, description, action, className }: StateSurfaceProps) {
  return (
    <Card data-no-permission-state role="status" className={className}>
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 text-center">
        <div className="grid size-14 place-items-center rounded-xl bg-danger-bg text-danger">
          <LockKeyhole className="size-7" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 max-w-md text-[0.8125rem] leading-6 text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
