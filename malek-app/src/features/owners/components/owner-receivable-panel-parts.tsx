import type { ChangeEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import {
  ownerReceivableStatusLabels,
  type OwnerReceivable,
} from '../services/owner-receivable-offset-service';

/**
 * Shared presentational parts of the two owner-receivable surfaces: the offset
 * panel and the cash-recovery panel.
 *
 * Both panels act on the SAME row type (`OwnerReceivable`) and show the same
 * facts — status, the original amount no movement may rewrite, the total already
 * moved, and the server-maintained remainder. Only the wording of the movement
 * and the `data-*` hook differ, so the markup lives here once and each panel
 * supplies its own labels.
 *
 * These parts hold no state and no money arithmetic: every figure is a
 * server-maintained column and every setter belongs to the caller.
 */

type ReceivableSelectorProps = Readonly<{
  receivables: readonly OwnerReceivable[];
  value: string;
  onChange: (next: string) => void;
}>;

/**
 * The receivable picker. The `<label>` wraps the control, which is the implicit
 * association both panels already relied on — no `id` is added, because both
 * panels render on the same page and a fixed id would collide.
 */
export function OwnerReceivableSelector({ receivables, value, onChange }: ReceivableSelectorProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">المديونية</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">— اختر مديونية —</option>
        {receivables.map((row) => (
          <option key={row.id} value={row.id}>
            {`${formatShortId(row.id)} · أصل ${formatMoney(row.amount)} · متبقٍّ ${formatMoney(row.outstanding)}`}
          </option>
        ))}
      </Select>
    </label>
  );
}

type FactsProps = Readonly<{
  selected: OwnerReceivable;
  /** Prefix for the `data-*` hooks the panels' consumers read. */
  dataPrefix: 'receivable' | 'recovery';
  movementLabel: string;
  movementAmount: number;
  movementDataKey: 'offset' | 'recovered';
  outstandingLabel: string;
}>;

export function OwnerReceivableFacts({
  selected,
  dataPrefix,
  movementLabel,
  movementAmount,
  movementDataKey,
  outstandingLabel,
}: FactsProps) {
  // React renders a boolean `data-*` value as "true", which is what the original
  // bare `data-receivable-offset` attribute produced.
  const movementAttr: Record<string, string> = { [`data-${dataPrefix}-${movementDataKey}`]: 'true' };
  const outstandingAttr: Record<string, string> = { [`data-${dataPrefix}-outstanding`]: 'true' };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-xs text-muted-foreground">الحالة</p>
        <StatusBadge tone={selected.status === 'OPEN' ? 'warning' : 'success'}>
          {ownerReceivableStatusLabels[selected.status]}
        </StatusBadge>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">المبلغ الأصلي (لا يتغيّر)</p>
        <p className="font-medium" data-receivable-original="true">
          {formatMoney(selected.amount)}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{movementLabel}</p>
        <p className="font-medium" {...movementAttr}>
          {formatMoney(movementAmount)}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{outstandingLabel}</p>
        <p className="font-medium" {...outstandingAttr}>
          {formatMoney(selected.outstanding)}
        </p>
      </div>
    </div>
  );
}

type AmountFieldsProps = Readonly<{
  amount: string;
  effectiveDate: string;
  onAmountChange: (next: string) => void;
  onEffectiveDateChange: (next: string) => void;
}>;

function valueOf(event: ChangeEvent<HTMLInputElement>): string {
  return event.target.value;
}

export function OwnerMovementAmountFields({
  amount,
  effectiveDate,
  onAmountChange,
  onEffectiveDateChange,
}: AmountFieldsProps) {
  return (
    <>
      <label className="block space-y-1">
        <span className="text-sm font-medium">المبلغ</span>
        <Input
          type="number"
          step="0.001"
          min="0"
          inputMode="decimal"
          value={amount}
          onChange={(event) => onAmountChange(valueOf(event))}
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">تاريخ الأثر</span>
        <Input
          type="date"
          value={effectiveDate}
          onChange={(event) => onEffectiveDateChange(valueOf(event))}
          required
        />
      </label>
    </>
  );
}

export function OwnerMovementAssurance({ children }: Readonly<{ children: string }>) {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="size-3.5" aria-hidden />
      {children}
    </p>
  );
}

type FeedbackProps = Readonly<{
  statusMessage: string | null;
  errorMessage: string | null;
}>;

export function OwnerMovementFeedback({ statusMessage, errorMessage }: FeedbackProps) {
  return (
    <>
      {statusMessage ? (
        <p className="text-sm font-medium text-success" role="status">
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
}
