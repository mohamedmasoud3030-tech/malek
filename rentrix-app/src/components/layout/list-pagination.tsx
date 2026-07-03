import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ListPaginationProps {
  readonly page: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
  /** 'split' places the label on the start and controls on the end (default). 'center' centers everything together. */
  readonly variant?: 'split' | 'center';
  /** 'الصفحة {page} من {totalPages}' (default) or '{page} / {totalPages}' */
  readonly labelStyle?: 'words' | 'slash';
  readonly className?: string;
}

export function ListPagination({
  page,
  totalPages,
  onPageChange,
  variant = 'split',
  labelStyle = 'words',
  className,
}: Readonly<ListPaginationProps>) {
  if (totalPages <= 1) return null;

  const label =
    labelStyle === 'slash' ? (
      <span className="text-sm font-bold text-muted-foreground">
        {page} / {totalPages}
      </span>
    ) : (
      <span>
        الصفحة {page} من {totalPages}
      </span>
    );

  const prevButton = (
    <Button
      variant="secondary"
      className={cn(variant === 'center' && 'rounded-xl')}
      disabled={page <= 1}
      onClick={() => onPageChange(Math.max(1, page - 1))}
    >
      السابق
    </Button>
  );
  const nextButton = (
    <Button
      variant="secondary"
      className={cn(variant === 'center' && 'rounded-xl')}
      disabled={page >= totalPages}
      onClick={() => onPageChange(Math.min(totalPages, page + 1))}
    >
      التالي
    </Button>
  );

  if (variant === 'center') {
    return (
      <div className={cn('flex items-center justify-center gap-2', className)}>
        {prevButton}
        {label}
        {nextButton}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-between text-sm text-muted-foreground', className)}>
      {label}
      <div className="flex gap-2">
        {prevButton}
        {nextButton}
      </div>
    </div>
  );
}
