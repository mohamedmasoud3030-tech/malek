/**
 * EnterpriseCard — Enterprise UX Foundation (Wave 4A)
 *
 * Standard content card for enterprise pages: header (title/description/
 * actions), body, optional footer. Wraps the shared Card primitives with
 * consistent padding presets and a loading skeleton. Pure presentation.
 */

import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface EnterpriseCardProps {
  title?: ReactNode;
  description?: ReactNode;
  headerActions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Body padding preset. */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Highlight the card as clickable/hoverable content. */
  interactive?: boolean;
  /** Muted canvas for secondary/nested regions. */
  muted?: boolean;
  /** Render a header + body skeleton instead of content. */
  isLoading?: boolean;
  className?: string;
  contentClassName?: string;
}

const paddingClasses: Record<NonNullable<EnterpriseCardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4 sm:p-6',
  lg: 'p-4 sm:p-6 lg:p-8',
};

export function EnterpriseCard({
  title,
  description,
  headerActions,
  children,
  footer,
  padding = 'md',
  interactive = false,
  muted = false,
  isLoading = false,
  className,
  contentClassName,
}: EnterpriseCardProps) {
  if (isLoading) {
    return (
      <Card data-enterprise-card data-loading="true" className={className} role="status" aria-label="جارٍ التحميل...">
        <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-3.5 w-64 max-w-full rounded-md" />
        </CardHeader>
        <CardContent className={cn(paddingClasses[padding], 'space-y-3')}>
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-2/3 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const hasHeader = title !== undefined || description !== undefined || headerActions !== undefined;

  return (
    <Card
      data-enterprise-card
      className={cn(
        interactive &&
          'cursor-pointer transition-shadow duration-200 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
        muted && 'bg-muted/60',
        className,
      )}
      tabIndex={interactive ? 0 : undefined}
    >
      {hasHeader ? (
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 p-4 pb-3 sm:p-6 sm:pb-3">
          <div className="min-w-0">
            {title !== undefined ? <CardTitle className="text-[0.9375rem] font-semibold leading-6">{title}</CardTitle> : null}
            {description !== undefined ? <CardDescription className="mt-0.5">{description}</CardDescription> : null}
          </div>
          {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn(paddingClasses[padding], hasHeader && 'pt-0 sm:pt-0', contentClassName)}>
        {children}
      </CardContent>
      {footer ? (
        <CardFooter className="border-t border-border/60 px-4 py-3 sm:px-6">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}
