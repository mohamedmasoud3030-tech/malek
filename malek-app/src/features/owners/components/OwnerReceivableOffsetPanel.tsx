import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Fingerprint, ShieldAlert } from 'lucide-react';
import { AsyncContentState, resolveAsyncContentStatus } from '@/components/async-content-state';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EntityForm } from '@/components/ui/entity-form';
import { useAuth } from '@/hooks/use-auth';
import { canAccess } from '@/features/auth/permissions';
import { invalidateFinancialReadModels } from '@/lib/financial-cache';
import { formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import {
  OwnerMovementAmountFields,
  OwnerMovementAssurance,
  OwnerMovementFeedback,
  OwnerReceivableFacts,
  OwnerReceivableSelector,
} from './owner-receivable-panel-parts';
import {
  applyOwnerReceivableOffset,
  approvedOwnerSettlementsQueryKey,
  createOwnerOffsetRequestId,
  loadApprovedOwnerSettlements,
  loadOwnerReceivableOffsets,
  loadOwnerReceivables,
  ownerReceivableOffsetsQueryKey,
  ownerReceivablesQueryKey,
  translateOwnerOffsetError,
} from '../services/owner-receivable-offset-service';

type OwnerReceivableOffsetPanelProps = Readonly<{
  ownerId: string;
}>;

/**
 * The single canonical surface for applying a lawful offset between an owner
 * receivable (`due_from_owners`) and an APPROVED owner payable. It is the UI
 * counterpart of the already-deployed, already-granted RPC
 * `offset_owner_receivable_atomic`.
 *
 * Design constraints this panel deliberately honours:
 *  - It shows the EFFECT ON THE ORIGINAL SOURCE: the original amount is always
 *    displayed unchanged next to the movements and the remaining outstanding,
 *    because an offset never rewrites the original receivable.
 *  - It never infers the right to offset. `lawful_offset_right` is read from
 *    the stored row; when it is false the form is closed and the reason is
 *    stated instead of being silently hidden.
 *  - It performs no client-side money arithmetic. Every figure rendered here is
 *    a server-maintained column or a server response field.
 */
export function OwnerReceivableOffsetPanel({ ownerId }: OwnerReceivableOffsetPanelProps) {
  const { authorization } = useAuth();
  const canOffset = canAccess(authorization, 'financial.owner_settlements.approve');
  const queryClient = useQueryClient();

  const [selectedReceivableId, setSelectedReceivableId] = useState('');
  const [settlementId, setSettlementId] = useState('');
  const [amount, setAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [evidence, setEvidence] = useState('');
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

  const offsetsQuery = useQuery({
    queryKey: [...ownerReceivableOffsetsQueryKey, selectedReceivableId],
    queryFn: () => loadOwnerReceivableOffsets(selectedReceivableId),
    enabled: Boolean(selectedReceivableId),
  });

  const settlementsQuery = useQuery({
    queryKey: [...approvedOwnerSettlementsQueryKey, ownerId],
    queryFn: () => loadApprovedOwnerSettlements(ownerId),
    enabled: Boolean(ownerId) && canOffset,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('لم تُحدَّد مديونية.');
      return applyOwnerReceivableOffset({
        dueFromOwnerId: selected.id,
        ownerSettlementId: settlementId,
        amount: Number(amount),
        effectiveDate,
        lawfulOffsetEvidence: evidence,
        requestId: createOwnerOffsetRequestId(),
      });
    },
    onSuccess: async (result) => {
      setErrorMessage(null);
      setStatusMessage(
        result.idempotent
          ? `الطلب منفَّذ مسبقاً بنفس المعطيات؛ لم يُرحَّل قيد جديد. المتبقي على المديونية: ${formatMoney(result.outstanding)}.`
          : `تمت المقاصة وتُرحّل القيد ${formatShortId(result.journalBatchId)}. المتبقي على المديونية الأصلية: ${formatMoney(result.outstanding)}.`,
      );
      setAmount('');
      setEvidence('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ownerReceivablesQueryKey }),
        queryClient.invalidateQueries({ queryKey: ownerReceivableOffsetsQueryKey }),
        queryClient.invalidateQueries({ queryKey: approvedOwnerSettlementsQueryKey }),
      ]);
      await invalidateFinancialReadModels(queryClient);
    },
    onError: (error) => {
      setStatusMessage(null);
      setErrorMessage(translateOwnerOffsetError(error));
    },
  });

  return (
    <section className="space-y-4 rounded-xl border p-4" aria-labelledby="owner-offset-heading">
      <header className="space-y-1">
        <h2 id="owner-offset-heading" className="flex items-center gap-2 text-lg font-semibold">
          <ArrowLeftRight className="size-5" aria-hidden />
          مقاصة مديونيات الملاك
        </h2>
        <p className="text-sm text-muted-foreground">
          تُخصم المديونية من مستحقات المالك المعتمدة دون أي تعديل على المبلغ الأصلي؛ يظهر الأثر
          كحركة مقاصة ورصيد متبقٍّ وقيد محاسبي مرحَّل.
        </p>
      </header>

      <AsyncContentState
        status={resolveAsyncContentStatus({ isLoading: receivablesQuery.isLoading, isError: receivablesQuery.isError, isEmpty: receivables.length === 0 })}
        error={receivablesQuery.error}
        emptyTitle="لا توجد مديونيات"
        emptyDescription="سجّل مديونية على المالك أولاً لتتمكن من إجراء مقاصة مقابل مستحقاته المعتمدة."
      >
        <div className="space-y-3">
          <OwnerReceivableSelector
            receivables={receivables}
            value={selectedReceivableId}
            onChange={(next) => {
              setSelectedReceivableId(next);
              setStatusMessage(null);
              setErrorMessage(null);
            }}
          />

          {selected ? (
            <div className="space-y-3">
              <OwnerReceivableFacts
                selected={selected}
                dataPrefix="receivable"
                movementLabel="إجمالي المقاصات"
                movementAmount={selected.offsetAmount}
                movementDataKey="offset"
                outstandingLabel="المتبقي بعد المقاصة"
              />

              <AsyncContentState
                status={resolveAsyncContentStatus({ isLoading: offsetsQuery.isLoading, isError: offsetsQuery.isError, isEmpty: (offsetsQuery.data ?? []).length === 0 })}
                error={offsetsQuery.error}
                emptyTitle="لا توجد حركات مقاصة"
                emptyDescription="سيظهر هنا سجل حركات المقاصة مع القيود المحاسبية المرحَّلة بعد تنفيذ أول مقاصة."
              >
                <ul className="space-y-2">
                  {(offsetsQuery.data ?? []).map((movement) => (
                    <li key={movement.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <p className="flex items-center gap-2 font-medium">
                        <Fingerprint className="size-4" aria-hidden />
                        {formatMoney(movement.amount)} بتاريخ {movement.effectiveDate}
                      </p>
                      <p className="text-muted-foreground">السند: {movement.lawfulOffsetEvidence}</p>
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

      {selected && !selected.lawfulOffsetRight ? (
        <div className="space-y-1 rounded-lg border border-dashed p-3" role="status">
          <p className="flex items-center gap-2 font-medium">
            <ShieldAlert className="size-4 text-warning" aria-hidden />
            لا يوجد حق مقاصة مثبت على هذه المديونية.
          </p>
          <p className="text-sm text-muted-foreground">
            لا يُستنتج حق المقاصة من تصنيف الحساب ولا من اسم الحقل. يجب إثبات الحق على السجل نفسه
            قبل إتاحة الإجراء، والخادم يرفض الطلب بدونه.
          </p>
        </div>
      ) : null}

      {!canOffset ? (
        <p className="text-sm text-muted-foreground" role="alert">
          تنفيذ المقاصة غير متاح لصلاحيتك الحالية، ويتطلب صلاحية مدير أو محاسب.
        </p>
      ) : null}

      {canOffset && selected?.lawfulOffsetRight ? (
        <EntityForm.Root
          className="space-y-3 rounded-lg border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setStatusMessage(null);
            setErrorMessage(null);
            applyMutation.mutate();
          }}
        >
          <EntityForm.Section
            title="تنفيذ مقاصة"
            description="تُخصم المقاصة من تسوية معتمدة لنفس المالك، ويتحقق الخادم من الحق والحدود مرة أخرى."
          >
            <label className="block space-y-1">
              <span className="text-sm font-medium">التسوية المعتمدة</span>
              <Select
                value={settlementId}
                onChange={(event) => setSettlementId(event.target.value)}
                required
              >
                <option value="">— اختر تسوية معتمدة —</option>
                {(settlementsQuery.data ?? []).map((settlement) => (
                  <option key={settlement.id} value={settlement.id}>
                    {`${formatShortId(settlement.id)} · صافي ${formatMoney(settlement.netPayable)}`}
                  </option>
                ))}
              </Select>
            </label>

            <OwnerMovementAmountFields
              amount={amount}
              effectiveDate={effectiveDate}
              onAmountChange={setAmount}
              onEffectiveDateChange={setEffectiveDate}
            />

            <label className="block space-y-1">
              <span className="text-sm font-medium">سند المقاصة</span>
              <Textarea
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
                placeholder="المرجع التعاقدي أو القانوني الذي يجيز المقاصة"
                required
              />
            </label>
          </EntityForm.Section>

          <Button type="submit" disabled={applyMutation.isPending}>
            تنفيذ المقاصة
          </Button>

          <OwnerMovementAssurance>
            كل مقاصة تُرحَّل كقيد متوازن، ولا تُعدّل المبلغ الأصلي للمديونية، وتُرفض إذا تجاوزت
            المتبقي أو صافي المستحق.
          </OwnerMovementAssurance>
        </EntityForm.Root>
      ) : null}

      <OwnerMovementFeedback statusMessage={statusMessage} errorMessage={errorMessage} />
    </section>
  );
}
