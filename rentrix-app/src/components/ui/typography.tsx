import { Slot } from '@radix-ui/react-slot';
import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Typography — unified text API for MALEK.
 *
 * One component, one `variant` prop, backed by the centralized design tokens.
 * Arabic/RTL is handled globally (Cairo, direction: rtl); no font or identity
 * change is introduced here. Color stays on `className`/tokens so callers can
 * use text-foreground / text-muted-foreground / financial tokens.
 *
 * Use `asChild` to compose onto links, headings, or labels without extra DOM.
 */
export type TypographyVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'title'
  | 'subtitle'
  | 'body-lg'
  | 'body'
  | 'body-sm'
  | 'caption'
  | 'label'
  | 'overline'
  | 'button'
  | 'mono';

type TypographyProps = HTMLAttributes<HTMLElement> & {
  variant?: TypographyVariant;
  asChild?: boolean;
  children: ReactNode;
};

const variantClasses: Record<TypographyVariant, string> = {
  display: 'text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl',
  h1: 'text-3xl font-bold leading-tight tracking-tight',
  h2: 'text-2xl font-bold leading-tight tracking-tight',
  h3: 'text-xl font-bold leading-snug tracking-tight',
  h4: 'text-lg font-bold leading-snug',
  h5: 'text-base font-bold leading-snug',
  h6: 'text-sm font-bold leading-snug',
  title: 'text-base font-semibold leading-6',
  subtitle: 'text-sm font-medium leading-6 text-muted-foreground',
  'body-lg': 'text-base leading-7',
  body: 'text-sm leading-6',
  'body-sm': 'text-[0.8125rem] leading-5',
  caption: 'text-xs leading-5 text-muted-foreground',
  label: 'text-xs font-bold uppercase tracking-wide',
  overline: 'text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground',
  button: 'text-sm font-bold leading-none',
  mono: 'font-mono text-sm leading-6 tabular-nums',
};

const variantElement: Record<TypographyVariant, ElementType> = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  title: 'h3',
  subtitle: 'p',
  'body-lg': 'p',
  body: 'p',
  'body-sm': 'p',
  caption: 'span',
  label: 'label',
  overline: 'span',
  button: 'span',
  mono: 'code',
};

export function Typography({
  variant = 'body',
  asChild = false,
  className,
  children,
  ...props
}: TypographyProps) {
  const Component: ElementType = asChild ? Slot : variantElement[variant];
  return (
    <Component
      data-typography={variant}
      className={cn(variantClasses[variant], className)}
      {...props}
    >
      {children}
    </Component>
  );
}
