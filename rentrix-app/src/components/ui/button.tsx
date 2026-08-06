import { Slot } from '@radix-ui/react-slot';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'default' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
  default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-muted text-foreground',
  danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 min-w-11 rounded-lg px-3 py-1.5 text-xs',
  md: 'min-h-11 min-w-11 rounded-lg px-4 py-2 text-sm',
  lg: 'min-h-11 min-w-11 rounded-xl px-5 py-2.5 text-base',
  icon: 'size-11 rounded-lg p-0',
};

/** Shared operational button with a consistent 44px minimum hit area. */
export function Button({ asChild = false, className, variant = 'primary', size = 'md', type = 'button', ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      data-ui-button
      className={cn(
        'pressable inline-flex cursor-pointer items-center justify-center font-bold shadow-sm outline-none transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-150 focus-visible:ring-4 focus-visible:ring-primary/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        sizes[size],
        variants[variant],
        className,
      )}
      type={asChild ? undefined : type}
      {...props}
    />
  );
}
