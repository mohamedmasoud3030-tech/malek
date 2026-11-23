import { Activity } from 'lucide-react';

type ActivityItem = Readonly<{
  id: string;
  subject: string | null;
  body: string;
  created_at: string;
}>;

type Props = Readonly<{
  headingId: string;
  emptyMessage: string;
  entries: readonly ActivityItem[];
  formatDateTime: (value: string) => string;
  className?: string;
}>;

/** Shared presentation for the same communication timeline on person/tenant dossiers. */
export function DossierActivitySection({
  headingId,
  emptyMessage,
  entries,
  formatDateTime,
  className,
}: Props) {
  return (
    <section aria-labelledby={headingId} className={className}>
      <header className="border-b border-border/60 pb-2.5">
        <h3 id={headingId} className="flex items-center gap-2 text-base font-black">
          <Activity className="size-5 text-primary" />
          آخر النشاط
        </h3>
      </header>
      {entries.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {entries.map((item) => (
            <li key={item.id} className="py-3">
              <p className="font-bold">{item.subject || 'تواصل مسجل'}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
