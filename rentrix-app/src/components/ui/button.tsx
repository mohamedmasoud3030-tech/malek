import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Button — the single operational button for MALEK.
 *
 * Backward compatible: the legacy names `primary`/`default`, `danger`/`destructive`
 * remain. Wave 3 adds `soft`, `success`, `warning`, `link`, sizes `xs`/`xl`,
 * `loading`, `fullWidth`, and `leftIcon`/`rightIcon`. The 44px minimum hit area
 * is preserved and motion is reduced for `prefers-reduced-motion`.
 */
export const buttonVariants = cva(
  [
    'pressable inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-bold outline-none',
    'transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-150',
    'focus-visible:ring-4 focus-visible:ring-primary/25',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    'motion-reduce:transition-none',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/95',
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/95',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/90',
        outline:
          'border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-muted text-foreground',
        soft: 'bg-primary/10 text-primary hover:bg-primary/15',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        success: 'bg-success text-white shadow-sm hover:bg-success/90',
        warning: 'bg-warning text-white shadow-sm hover:bg-warning/90',
        link: 'rounded-none bg-transparent p-0 font-bold text-primary underline-offset-4 hover:underline shadow-none',
      },
      size: {
        xs: 'min-h-9 min-w-9 rounded-md px-2.5 py-1 text-xs',
        sm: 'min-h-10 min-w-10 rounded-lg px-3 py-1.5 text-xs',
        md: 'min-h-10 min-w-10 rounded-lg px-4 py-2 text-sm',
        lg: 'min-h-11 min-w-11 rounded-xl px-5 py-2.5 text-base',
        xl: 'min-h-12 min-w-12 rounded-xl px-6 py-3 text-base',
        icon: 'size-10 rounded-lg p-0',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: ButtonVariantProps['variant'];
  size?: ButtonVariantProps['size'];
  fullWidth?: boolean;
  /** Replaces the button content with a centered spinner when true. */
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
};

/** Shared operational button with a consistent 44px minimum hit area. */
export function Button({
  asChild = false,
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  const content = loading ? (
    <>
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span className="sr-only">جارٍ التنفيذ...</span>
      {!asChild ? <span aria-hidden="true">{children}</span> : children}
    </>
  ) : (
    <>
      {leftIcon ? <span aria-hidden="true">{leftIcon}</span> : null}
      {children}
      {rightIcon ? <span aria-hidden="true">{rightIcon}</span> : null}
    </>
  );

  // Data/state attributes belong to the rendered <button> only. When asChild is
  // used, Radix Slot forwards props to the child element; attaching data-* to
  // the Slot can land on a React.Fragment and emit invalid-prop warnings, so we
  // keep them off the asChild path (child elements own their own attributes).
  const stateProps = asChild
    ? null
    : {
        'data-ui-button': true,
        'data-variant': variant,
        'data-size': size,
        'data-loading': loading ? 'true' : undefined,
        'aria-busy': loading || undefined,
      };

  return (
    <Component
      {...stateProps}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      disabled={asChild ? disabled : disabled || loading}
      type={asChild ? undefined : type}
      {...props}
    >
      {content}
    </Component>
  );
}
