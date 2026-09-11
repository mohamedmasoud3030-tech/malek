import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, Fingerprint, ShieldCheck } from 'lucide-react';
import { AsyncContentState, resolveAsyncContentStatus } from '@/components/async-content-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { EntityForm } from '@/components/ui/entity-form';
import { useAuth } from '@/hooks/use-auth';
import { canAccess } from '@/features/auth/permissions';
import { invalidateFinancialReadModels } from '@/lib/financial-cache';
import { formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import {
  loadOwnerReceivables,
  ownerReceivableStatusLabels,
  ownerReceivablesQueryKey,
} from '../services/owner-receivable-offset-service';
import {
  RECOVERY_CASH_ACCOUNTS,
  type RecoveryCashAccount,
  createOwnerRecoveryRequestId,
  loadOwnerReceivableRecoveries,
  ownerReceivableRecoveriesQueryKey,
  recoverOwnerReceivable,
  recoveryCashAccountLabels,
  translateOwnerRecoveryError,
} from '../services/owner-receivable-recovery-service';

type OwnerReceivableRecoveryPanelProps = Readonly<{
  ownerId: string;
}>;

/**
 * The single canonical surface for recording a CASH recovery against an owner
 * receivable. UI counterpart of the deployed, already-granted RPC
 * `recover_owner_receivable_atomic`, which previously had no surface at all.
 *
 * Like the offset panel, it shows the EFFECT ON THE ORIGINAL SOURCE: the
 * original amount stays visible and unchanged beside the amount recovered, the
 * remaining outstanding, and the posted GL batch id. A recovery never rewrites
 * the original receivable.
 */
export function OwnerReceivableRecoveryPanel({ ownerId }: OwnerReceivableRecoveryPanelProps) {
  const { authorization } = useAuth();
  const canRecover = canAccess(authorization, 'financial.owner_settlements.approve');
  const queryClient = useQueryClient();

  const [selectedReceivableId, setSelectedReceivableId] = useState('');
  const [amount, setAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [cashAccountNo, setCashAccountNo] = useState<RecoveryCashAccount>('1120');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const receivablesQuery = useQuery({
    queryKey: [...ownerReceivablesQueryKey, ownerId],
    queryFn: () => loadOwnerReceivables(ownerId),
    enabled: Boolean(ownerId),
  });

  const receivables = useMemo(() => receivablesQuery.data ?? [], [receivablesQuery.data]);
  const selected = useMemo(
    () => receivables.find((row) => row.id === selectedReceivableId) ?? null,
    [receivables, selectedReceivableId],
  );

  const recoveriesQuery = useQuery({
    queryKey: [...ownerReceivableRecoveriesQueryKey, selectedReceivableId],
    queryFn: () => loadOwnerReceivableRecoveries(selectedReceivableId),
    enabled: Boolean(selectedReceivableId),
  });

  const recoverMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('لم تُحدَّد مديونية.');
      return recoverOwnerReceivable({
        dueFromOwnerId: selected.id,
        amount: Number(amount),
        effectiveDate,
        cashAccountNo,
        requestId: createOwnerRecoveryRequestId(),
      });
    },
    onSuccess: async (result) => {
      setErrorMessage(null);
      setStatusMessage(
        result.idempotent
          ? `الطلب منفَّذ مسبقاً بنفس المعطيات؛ لم يُرحَّل قيد جديد. المتبقي: ${formatMoney(result.outstanding)}.`
          : `تم تسجيل التحصيل وتُرحّل القيد ${formatShortId(result.journalBatchId)}. المتبقي على المديونية الأصلية: ${formatMoney(result.outstanding)}.`,
      );
      setAmount('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ownerReceivablesQueryKey }),
        queryClient.invalidateQueries({ queryKey: ownerReceivableRecoveriesQueryKey }),
      ]);
      await invalidateFinancialReadModels(queryClient);
    },
    onError: (error) => {
      setStatusMessage(null);
      setErrorMessage(translateOwnerRecoveryError(error));
    },
  });

  return (
    <section className="space-y-4 rounded-xl border p-4" aria-labelledby="owner-recovery-heading">
      <header className="space-y-1">
        <h2 id="owner-recovery-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Banknote className="size-5" aria-hidden />
          تحصيل نقدي لمديونيات الملاك
        </h2>
        <p className="text-sm text-muted-foreground">
          يُسجَّل التحصيل نقداً أو بنكياً دون أي تعديل على المبلغ الأصلي؛ يظهر الأثر كحركة تحصيل
          ورصيد متبقٍّ وقيد محاسبي مرحَّل.
        </p>
      </header>

      <AsyncContentState
        status={resolveAsyncContentStatus({ isLoading: receivablesQuery.isLoading, isError: receivablesQuery.isError, isEmpty: receivables.length === 0 })}
        error={receivablesQuery.error}
        emptyTitle="لا توجد مديونيات"
        emptyDescription="سجّل مديونية على المالك أولاً لتتمكن من تسجيل تحصيل نقدي عليها."
      >
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">المديونية</span>
            <Select
              value={selectedReceivableId}
              onChange={(event) => {
                setSelectedReceivableId(event.target.value);
                setStatusMessage(null);
                setErrorMessage(null);
              }}
            >
              <option value="">— اختر مديونية —</option>
              {receivables.map((row) => (
                <option key={row.id} value={row.id}>
                  {`${formatShortId(row.id)} · أصل ${formatMoney(row.amount)} · متبقٍّ ${formatMoney(row.outstanding)}`}
                </option>
              ))}
            </Select>
          </label>

          {selected ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">الحالة</p>
                  <StatusBadge tone={selected.status === 'OPEN' ? 'warning' : 'success'}>
                    {ownerReceivableStatusLabels[selected.status]}
                  </StatusBadge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المبلغ الأصلي (لا يتغيّر)</p>
                  <p className="font-medium" data-recovery-original>
                    {formatMoney(selected.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي المحصَّل</p>
                  <p className="font-medium" data-recovery-recovered>
                    {formatMoney(selected.recoveredAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المتبقي بعد التحصيل</p>
                  <p className="font-medium" data-recovery-outstanding>
                    {formatMoney(selected.outstanding)}
                  </p>
                </div>
              </div>

              <AsyncContentState
                status={resolveAsyncContentStatus({ isLoading: recoveriesQuery.isLoading, isError: recoveriesQuery.isError, isEmpty: (recoveriesQuery.data ?? []).length === 0 })}
                error={recoveriesQuery.error}
                emptyTitle="لا توجد حركات تحصيل"
                emptyDescription="سيظهر هنا سجل حركات التحصيل مع القيود المحاسبية المرحَّلة بعد تسجيل أول تحصيل."
              >
                <ul className="space-y-2">
                  {(recoveriesQuery.data ?? []).map((movement) => (
                    <li key={movement.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <p className="flex items-center gap-2 font-medium">
                        <Fingerprint className="size-4" aria-hidden />
                        {formatMoney(movement.amount)} بتاريخ {movement.effectiveDate}
                      </p>
                      <p className="text-muted-foreground">
                        الحساب: {recoveryCashAccountLabels[
                          movement.cashAccountNo as RecoveryCashAccount
                        ] ?? movement.cashAccountNo}
                      </p>
                      <p className="break-all text-xs text-muted-foreground">
                        القيد: {movement.journalBatchId ? formatShortId(movement.journalBatchId) : '—'}
                        {movement.reversalJournalBatchId
                          ? ` · قيد العكس: ${formatShortId(movement.reversalJournalBatchId)}`
                          : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </AsyncContentState>
            </div>
          ) : null}
        </div>
      </AsyncContentState>

      {!canRecover ? (
        <p className="text-sm text-muted-foreground" role="alert">
          تسجيل التحصيل غير متاح لصلاحيتك الحالية، ويتطلب صلاحية مدير أو محاسب.
        </p>
      ) : null}

      {canRecover && selected ? (
        <EntityForm.Root
          className="space-y-3 rounded-lg border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setStatusMessage(null);
            setErrorMessage(null);
            recoverMutation.mutate();
          }}
        >
          <EntityForm.Section
            title="تسجيل تحصيل نقدي"
            description="يتحقق الخادم من الحدود والحساب النقدي مرة أخرى قبل الترحيل."
          >
            <label className="block space-y-1">
              <span className="text-sm font-medium">حساب النقدية</span>
              <Select
                value={cashAccountNo}
                onChange={(event) => setCashAccountNo(event.target.value as RecoveryCashAccount)}
                required
              >
                {RECOVERY_CASH_ACCOUNTS.map((account) => (
                  <option key={account} value={account}>
                    {recoveryCashAccountLabels[account]}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">المبلغ</span>
              <Input
                type="number"
                step="0.001"
                min="0"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">تاريخ الأثر</span>
              <Input
                type="date"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
                required
              />
            </label>
          </EntityForm.Section>

          <Button type="submit" disabled={recoverMutation.isPending}>
            تسجيل التحصيل
          </Button>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden />
            كل تحصيل يُرحَّل كقيد متوازن، ولا يُعدّل المبلغ الأصلي للمديونية، ويُرفض إذا تجاوز
            المتبقي.
          </p>
        </EntityForm.Root>
      ) : null}

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
    </section>
  );
}
