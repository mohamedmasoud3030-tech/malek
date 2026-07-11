import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type IconButtonSize = 'sm' | 'md' | 'lg';

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: ReactNode;
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
};

const sizeMap: Record<IconButtonSize, 'sm' | 'md' | 'lg' | 'icon'> = {
  sm: 'sm',
  md: 'icon',
  lg: 'lg',
};

/**
 * Touch-friendly icon-only button with a required accessible label.
 * Prefer this over raw icon Buttons so every icon action stays announced.
 */
export function IconButton({
  icon,
  label,
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <Button
      type={type}
      variant={variant}
      size={sizeMap[size]}
      aria-label={label}
      title={label}
      className={cn('shrink-0', className)}
      {...props}
    >
      {icon}
    </Button>
  );
}
