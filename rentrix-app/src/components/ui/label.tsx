import type { LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, htmlFor, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  // htmlFor is passed through explicitly (not via the spread) so the label's
  // control association is visible to accessibility analysis.
  return <label htmlFor={htmlFor} className={cn('text-sm font-bold text-foreground', className)} {...props} />;
}
