import { formatMoney } from '@/hooks/useCompanyFormatters';

/**
 * Canonical rent-amount cell shared by the portfolio units register and the
 * property-scoped units register: LTR, bold, tabular numerals, one money
 * formatter — so amounts read identically in both contexts.
 */
export function UnitRentCell({ amount }: Readonly<{ amount: number | null | undefined }>) {
  return (
    <span dir="ltr" className="block font-bold tabular-nums">
      {formatMoney(amount)}
    </span>
  );
}
