import { Loader2 } from 'lucide-react';
import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

const sizeMap: Record<SpinnerSize, string> = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
};

export type SpinnerProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  size?: SpinnerSize;
  label?: string;
};

/** Accessible spinner. The label is announced to screen readers via sr-only. */
export function Spinner({ size = 'sm', label = 'جارٍ التحميل', className, ...props }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center justify-center">
      <Loader2
        aria-hidden="true"
        className={cn('animate-spin motion-reduce:animate-none text-primary', sizeMap[size], className)}
        {...props}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
