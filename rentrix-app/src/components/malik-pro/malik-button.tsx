/*
 * ============================================
 * MALIK PRO - Button Component
 * Primary Action Button with Variants
 * ============================================
 */

import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type MalikButtonVariant = 
  | 'primary'      // Green - Main actions
  | 'secondary'     // Blue - Secondary actions
  | 'dark'         // Navy - Dark buttons
  | 'outline'      // Outline - Cancel/back
  | 'ghost'        // Ghost - Minimal
  | 'soft'         // Soft - Subtle emphasis
  | 'success'      // Success - Confirmations
  | 'danger';      // Danger - Destructive

export type MalikButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface MalikButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: MalikButtonVariant;
  size?: MalikButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantClasses: Record<MalikButtonVariant, string> = {
  primary: [
    'bg-[hsl(var(--malik-primary))] text-[hsl(var(--malik-primary-foreground))]',
    'hover:bg-[hsl(var(--malik-primary-dark))]',
    'active:scale-[0.98]',
  ].join(' '),
  secondary: [
    'bg-[hsl(var(--malik-secondary))] text-white',
    'hover:bg-[hsl(var(--malik-secondary-dark))]',
    'active:scale-[0.98]',
  ].join(' '),
  dark: [
    'bg-[hsl(var(--malik-dark))] text-white',
    'hover:bg-[hsl(var(--malik-dark-light))]',
    'active:scale-[0.98]',
  ].join(' '),
  outline: [
    'bg-transparent text-[hsl(var(--malik-foreground))]',
    'border border-[hsl(var(--malik-border))]',
    'hover:bg-[hsl(var(--malik-muted))] hover:border-[hsl(var(--malik-primary)/0.4)]',
  ].join(' '),
  ghost: [
    'bg-transparent text-[hsl(var(--malik-foreground))]',
    'hover:bg-[hsl(var(--malik-muted))]',
  ].join(' '),
  soft: [
    'bg-[hsl(var(--malik-primary)/0.1)] text-[hsl(var(--malik-primary))]',
    'hover:bg-[hsl(var(--malik-primary)/0.15)]',
  ].join(' '),
  success: [
    'bg-[hsl(var(--malik-success))] text-white',
    'hover:bg-[hsl(var(--malik-success))]/90',
  ].join(' '),
  danger: [
    'bg-[hsl(var(--malik-danger))] text-white',
    'hover:bg-[hsl(var(--malik-danger))]/90',
  ].join(' '),
};

const sizeClasses: Record<MalikButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-xs rounded-md',
  md: 'min-h-11 px-5 py-2.5 text-sm rounded-lg',
  lg: 'min-h-[52px] px-6 py-3 text-base rounded-lg',
  icon: 'size-11 rounded-lg p-0',
};

export function MalikButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: MalikButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      data-malik-btn
      data-malik-btn-primary={variant === 'primary'}
      className={cn(
        'inline-flex items-center justify-center gap-2',
        'font-bold outline-none transition-all duration-150',
        'focus-visible:ring-4 focus-visible:ring-[hsl(var(--malik-focus-ring))/0.2]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span className="sr-only">جارٍ التنفيذ...</span>
          <span aria-hidden="true">{children}</span>
        </>
      ) : (
        <>
          {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
          {children}
          {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}

// Export individual button variants for convenience
export const MalikButtonPrimary = (props: Omit<MalikButtonProps, 'variant'>) => (
  <MalikButton variant="primary" {...props} />
);

export const MalikButtonSecondary = (props: Omit<MalikButtonProps, 'variant'>) => (
  <MalikButton variant="secondary" {...props} />
);

export const MalikButtonDark = (props: Omit<MalikButtonProps, 'variant'>) => (
  <MalikButton variant="dark" {...props} />
);

export const MalikButtonOutline = (props: Omit<MalikButtonProps, 'variant'>) => (
  <MalikButton variant="outline" {...props} />
);

export const MalikButtonSuccess = (props: Omit<MalikButtonProps, 'variant'>) => (
  <MalikButton variant="success" {...props} />
);

export const MalikButtonDanger = (props: Omit<MalikButtonProps, 'variant'>) => (
  <MalikButton variant="danger" {...props} />
);
