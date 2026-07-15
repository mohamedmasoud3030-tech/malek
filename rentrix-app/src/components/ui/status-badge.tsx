import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Semantic tones — canonical for new code. */
type SemanticTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary' | 'secondary';

/** Legacy color tones — supported for backward compatibility. */
type LegacyTone = 'blue' | 'green' | 'red' | 'gray' | 'gold';

/** All accepted tone values. */
type StatusTone = SemanticTone | LegacyTone;

/** Maps legacy color tones to semantic equivalents. */
const legacyToSemantic: Record<LegacyTone, SemanticTone> = {
  blue: 'info',
  green: 'success',
  red: 'danger',
  gray: 'neutral',
  gold: 'warning',
};

const tones: Record<SemanticTone, string> = {
  success: 'bg-success/10 text-success ring-success/20',
  warning: 'bg-warning/10 text-warning ring-warning/20',
  danger: 'bg-danger/10 text-danger ring-danger/20',
  info: 'bg-info/10 text-info ring-info/20',
  neutral: 'bg-neutral/10 text-neutral ring-neutral/20',
  primary: 'bg-primary/10 text-primary ring-primary/20',
  secondary: 'bg-neutral/10 text-neutral ring-neutral/20',
};

const dotTones: Record<SemanticTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  neutral: 'bg-neutral',
  primary: 'bg-primary',
  secondary: 'bg-neutral',
};

const resolveTone = (tone: StatusTone): SemanticTone =>
  tone in legacyToSemantic ? legacyToSemantic[tone as LegacyTone] : (tone as SemanticTone);

/**
 * StatusBadge — the single status indicator for the entire application.
 *
 * Financial mapping:
 *   Paid/Posted/Settled/Inflow → success (or legacy 'green')
 *   Partial/Outstanding → warning (or legacy 'gold')
 *   Overdue/Blocked/Outflow → danger (or legacy 'red')
 *   Draft → info (or legacy 'blue')
 *   Void → neutral (or legacy 'gray')
 */
export function StatusBadge({
  tone,
  children,
  className,
  dot = false,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  const semantic = resolveTone(tone);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
        tones[semantic],
        className,
      )}
    >
      {dot ? <span className={cn('size-1.5 rounded-full', dotTones[semantic])} /> : null}
      {children}
    </span>
  );
}
