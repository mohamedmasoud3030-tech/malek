import type { ReactNode } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';

type PageStateCardProps = Readonly<{
  title: string;
  description?: string;
  action?: ReactNode;
}>;

type WriteErrorCardProps = Readonly<{
  message: string;
}>;

export function PageStateCard({ title, description, action }: PageStateCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action}
      </CardHeader>
    </Card>
  );
}

/**
 * Write-error surface — a variant of the shared ErrorState component.
 *
 * Presents a compact error card with the fixed title "لم يتم حفظ التغيير"
 * and the caller-supplied message. Delegates to ErrorState variant="write"
 * for a single canonical implementation.
 */
export function WriteErrorCard({ message }: WriteErrorCardProps) {
  return (
    <ErrorState variant="write" title="لم يتم حفظ التغيير" description={message} />
  );
}
