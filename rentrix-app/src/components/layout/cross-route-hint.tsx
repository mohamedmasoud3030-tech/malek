import { Link } from '@tanstack/react-router';

type CrossRouteHintAction = {
  to: '/financials' | '/reports';
  label: string;
};

type CrossRouteHintProps = {
  message: string;
  action?: CrossRouteHintAction;
};

export function CrossRouteHint({ message, action }: CrossRouteHintProps) {
  return (
    <aside
      role="note"
      className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="min-w-0">{message}</p>
      {action ? (
        <Link
          to={action.to}
          className="inline-flex min-h-8 shrink-0 items-center self-start rounded-lg border border-primary/20 bg-background px-3 py-1.5 font-semibold text-primary transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:self-auto"
        >
          {action.label}
        </Link>
      ) : null}
    </aside>
  );
}
