import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Fingerprint, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AsyncContentState } from '@/components/async-content-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { EntityForm } from '@/components/ui/entity-form';
import { useAuth } from '@/hooks/use-auth';
import { canAccess } from '@/features/auth/permissions';
import { invalidateFinancialReadModels } from '@/lib/financial-cache';
import { formatMoney, formatShortId } from '@/features/financials/components/financials-formatters';
import {
  applyOwnerReceivableOffset,
  approvedOwnerSettlementsQueryKey,
  createOwnerOffsetRequestId,
  loadApprovedOwnerSettlements,
  loadOwnerReceivableOffsets,
  loadOwnerReceivables,
  ownerReceivableOffsetsQueryKey,
  ownerReceivableStatusLabels,
  ownerReceivablesQueryKey,
  translateOwnerOffsetError,
} from '../services/owner-receivable-offset-service';

type OwnerReceivableOffsetPanelProps = {
  ownerId: string;
};

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
        status={
          receivablesQuery.isLoading
            ? 'loading'
            : receivablesQuery.isError
              ? 'error'
              : receivables.length === 0
                ? 'empty'
                : 'ready'
        }
        error={receivablesQuery.error}
        emptyTitle="لا توجد مديونيات"
        emptyDescription="سجّل مديونية على المالك أولاً لتتمكن من إجراء مقاصة مقابل مستحقاته المعتمدة."
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
                  <p className="font-medium" data-receivable-original>
                    {formatMoney(selected.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">إجمالي المقاصات</p>
                  <p className="font-medium" data-receivable-offset>
                    {formatMoney(selected.offsetAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المتبقي بعد المقاصة</p>
                  <p className="font-medium" data-receivable-outstanding>
                    {formatMoney(selected.outstanding)}
                  </p>
                </div>
              </div>

              <AsyncContentState
                status={
                  offsetsQuery.isLoading
                    ? 'loading'
                    : offsetsQuery.isError
                      ? 'error'
                      : (offsetsQuery.data ?? []).length === 0
                        ? 'empty'
                        : 'ready'
                }
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

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden />
            كل مقاصة تُرحَّل كقيد متوازن، ولا تُعدّل المبلغ الأصلي للمديونية، وتُرفض إذا تجاوزت
            المتبقي أو صافي المستحق.
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
