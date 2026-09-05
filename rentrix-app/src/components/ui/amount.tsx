import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AmountTextProps = Readonly<{
  children: ReactNode;
  className?: string;
}>;

/**
 * Canonical numeric island for money/quantity values inside the RTL interface.
 *
 * Amounts must always read left-to-right with tabular numerals so columns of
 * figures line up and never mirror inside Arabic text. Several features had
 * grown their own copy of this span (`FinanceAmount` in financials,
 * `UnitRentCell` in units); this is that span once.
 *
 * It formats nothing — pass an already formatted value from the company
 * formatters (`formatMoney`, `formatCompanyDateTime`, …). It owns direction,
 * numerals and weight only, so a figure looks the same in a table cell, a KPI
 * card and a detail row.
 */
export function AmountText({ children, className }: AmountTextProps) {
  return (
    <span
      data-amount-text
      dir="ltr"
      className={cn('inline-block font-bold tabular-nums', className)}
    >
      {children}
    </span>
  );
}
