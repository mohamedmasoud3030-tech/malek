import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileWarning, Fingerprint, ScrollText, ShieldCheck, Undo2 } from 'lucide-react';
import { AsyncContentState, resolveAsyncContentStatus } from '@/components/async-content-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { EntityForm } from '@/components/ui/entity-form';
import { useAuth } from '@/hooks/use-auth';
import { canAccess } from '@/features/auth/permissions';
import { invalidateFinancialReadModels } from '@/lib/financial-cache';
import { formatMoney, formatShortId } from './financials-formatters';
import {
  applyS09Correction,
  createS09CorrectionDraft,
  createS09RequestId,
  loadApprovedS08Reviews,
  loadS09Corrections,
  reverseS09Correction,
  s09ApprovedReviewsQueryKey,
  s09CorrectionsQueryKey,
  s09StatusLabels,
  s09StatusTone,
  translateS09Error,
  validateS09Correction,
} from '../services/s09-correction-service';

/**
 * The single canonical surface for post-close accounting corrections (S09).
 * UI counterpart of the deployed, already-granted RPC chain
 * `s09_create_correction_draft` → `s09_validate_correction` →
 * `s09_apply_correction` → `s09_reverse_correction`, which previously had no
 * surface at all.
 *
 * The governing principle made visible here: a correction NEVER rewrites the
 * original posting. The original journal batch is recorded for lineage and
 * preserved; the correction posts its own separate balanced batch, and the
 * panel shows both. Reversal is a fourth step on the same principle: it posts
 * an equal-and-opposite batch and marks the correction batch REVERSED, so all
 * three batches stay visible. Nothing in this component edits or hides posted
 * history.
 */
export function S09CorrectionPanel() {
  const { authorization } = useAuth();
  // Server-side roles: draft/validate require ADMIN or MANAGER, while apply is
  // deliberately narrower (ACCOUNTANT or ADMIN). These are mapped onto the
  // EXISTING permission catalog — no new permission key is invented here, and
  // the server re-checks the real role regardless of what the UI shows.
  const canDraft = canAccess(authorization, 'financial.reports.export');
  const canApply = canAccess(authorization, 'financial.owner_settlements.approve');
  const queryClient = useQueryClient();

  const [reviewId, setReviewId] = useState('');
  const [sourceType, setSourceType] = useState('expense');
  const [sourceId, setSourceId] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [debitAccountNo, setDebitAccountNo] = useState('');
  const [creditAccountNo, setCreditAccountNo] = useState('');
  const [originalBatchId, setOriginalBatchId] = useState('');
  const [reverseTargetId, setReverseTargetId] = useState<string | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const correctionsQuery = useQuery({
    queryKey: s09CorrectionsQueryKey,
    queryFn: () => loadS09Corrections(),
  });

  const reviewsQuery = useQuery({
    queryKey: s09ApprovedReviewsQueryKey,
    queryFn: loadApprovedS08Reviews,
    enabled: canDraft,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: s09CorrectionsQueryKey });
    await invalidateFinancialReadModels(queryClient);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createS09CorrectionDraft({
        reviewId,
        sourceType,
        sourceId,
        reason,
        amount: Number(amount),
        debitAccountNo,
        creditAccountNo,
        requestId: createS09RequestId(),
        originalJournalBatchId: originalBatchId || null,
      }),
    onSuccess: async (result) => {
      setErrorMessage(null);
      setStatusMessage(
        result.idempotent
          ? `المسودة موجودة مسبقاً بنفس معرّف الطلب (${formatShortId(result.id)}); لم يُنشأ سجل جديد.`
          : `أُنشئت مسودة التصحيح ${formatShortId(result.id)} بحالة «مسودة». تتطلب تحققاً ثم تطبيقاً.`,
      );
      setReason('');
      setAmount('');
      await refresh();
    },
    onError: (error) => {
      setStatusMessage(null);
      setErrorMessage(translateS09Error(error));
    },
  });

  const validateMutation = useMutation({
    mutationFn: (id: string) => validateS09Correction(id),
    onSuccess: async () => {
      setErrorMessage(null);
      setStatusMessage('تم التحقق من التصحيح. لم يُرحَّل أي قيد بعد.');
      await refresh();
    },
    onError: (error) => {
      setStatusMessage(null);
      setErrorMessage(translateS09Error(error));
    },
  });

  const applyMutation = useMutation({
    mutationFn: (id: string) => applyS09Correction(id),
    onSuccess: async (result) => {
      setErrorMessage(null);
      setStatusMessage(
        `طُبِّق التصحيح وتُرحّل القيد ${formatShortId(result.batchId)}. القيد الأصلي بقي كما هو دون تعديل.`,
      );
      await refresh();
    },
    onError: (error) => {
      setStatusMessage(null);
      setErrorMessage(translateS09Error(error));
    },
  });

  // Reversal is compensating, never destructive: the deployed RPC marks the
  // correction batch REVERSED and posts an equal-and-opposite batch. The
  // original source posting was never touched by the correction and is not
  // touched by the reversal.
  const reverseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      reverseS09Correction(id, reason),
    onSuccess: async (result) => {
      setErrorMessage(null);
      setStatusMessage(
        result.idempotent
          ? `العكس منفَّذ مسبقاً لنفس قيد التصحيح؛ لم يُرحَّل قيد عكس جديد (${formatShortId(result.reversalBatchId)}).`
          : `عُكس التصحيح ورُحِّل قيد العكس ${formatShortId(result.reversalBatchId)}. قيد التصحيح بقي محفوظاً كمعكوس، والقيد الأصلي للمصدر لم يُمس.`,
      );
      setReverseTargetId(null);
      setReverseReason('');
      await refresh();
    },
    onError: (error) => {
      setStatusMessage(null);
      setErrorMessage(translateS09Error(error));
    },
  });

  const corrections = correctionsQuery.data ?? [];

  return (
    <section className="space-y-4 rounded-xl border p-4" aria-labelledby="s09-heading">
      <header className="space-y-1">
        <h2 id="s09-heading" className="flex items-center gap-2 text-lg font-semibold">
          <ScrollText className="size-5" aria-hidden />
          تصحيحات محاسبية بعد الإقفال (S09)
        </h2>
        <p className="text-sm text-muted-foreground">
          التصحيح لا يُعدّل القيد الأصلي أبداً؛ يُرحَّل قيد تصحيح منفصل ومتوازن، ويبقى القيدان
          ظاهرين معاً. كل تصحيح مرتبط بمراجعة S08 معتمدة، ويمر بمسودة ثم تحقق ثم تطبيق. التصحيح
          المُطبَّق يمكن عكسه بقيد تعويضي منفصل ومساوٍ في المقدار ومعاكس في الاتجاه؛ لا يُحذف أي
          سجل وتبقى القيود الثلاثة ظاهرة.
        </p>
      </header>

      <AsyncContentState
        status={resolveAsyncContentStatus({ isLoading: correctionsQuery.isLoading, isError: correctionsQuery.isError, isEmpty: corrections.length === 0 })}
        error={correctionsQuery.error}
        emptyTitle="لا توجد تصحيحات"
        emptyDescription="سيظهر هنا سجل التصحيحات مع القيد الأصلي وقيد التصحيح بعد إنشاء أول مسودة."
      >
        <ul className="space-y-2">
          {corrections.map((correction) => (
            <li key={correction.id} className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={s09StatusTone[correction.status]}>
                  {s09StatusLabels[correction.status]}
                </StatusBadge>
                <span className="font-medium">{formatMoney(correction.amount)}</span>
                <span className="text-muted-foreground">
                  {correction.sourceType} · {formatShortId(correction.sourceId)}
                </span>
              </div>
              <p className="text-muted-foreground">السبب: {correction.reason}</p>
              <p className="flex items-center gap-2 break-all text-xs text-muted-foreground">
                <Fingerprint className="size-3.5" aria-hidden />
                مراجعة S08: {formatShortId(correction.reviewId)}
                {correction.correctionBatchId
                  ? ` · قيد التصحيح: ${formatShortId(correction.correctionBatchId)}`
                  : ' · لم يُرحَّل قيد بعد'}
                {correction.reversalBatchId
                  ? ` · قيد العكس: ${formatShortId(correction.reversalBatchId)}`
                  : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {correction.status === 'DRAFT' ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canDraft || validateMutation.isPending}
                    onClick={() => validateMutation.mutate(correction.id)}
                  >
                    تحقق من التصحيح
                  </Button>
                ) : null}
                {correction.status === 'VALIDATED' ? (
                  <Button
                    type="button"
                    disabled={!canApply || applyMutation.isPending}
                    onClick={() => applyMutation.mutate(correction.id)}
                  >
                    تطبيق وترحيل القيد
                  </Button>
                ) : null}
                {correction.status === 'APPLIED' && reverseTargetId !== correction.id ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canApply || reverseMutation.isPending || applyMutation.isPending}
                    onClick={() => {
                      setStatusMessage(null);
                      setErrorMessage(null);
                      setReverseReason('');
                      setReverseTargetId(correction.id);
                    }}
                  >
                    <Undo2 className="size-4" aria-hidden />
                    عكس التصحيح
                  </Button>
                ) : null}
              </div>
              {correction.status === 'APPLIED' && reverseTargetId === correction.id ? (
                <EntityForm.Root
                  className="space-y-2 rounded-lg border bg-background p-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setStatusMessage(null);
                    setErrorMessage(null);
                    reverseMutation.mutate({ id: correction.id, reason: reverseReason });
                  }}
                >
                  <label className="block space-y-1">
                    <span className="text-sm font-medium">
                      سبب العكس (يُسجَّل في الدليل ولا يمكن تركه فارغاً)
                    </span>
                    <Textarea
                      value={reverseReason}
                      onChange={(event) => setReverseReason(event.target.value)}
                      required
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="submit"
                      variant="danger"
                      disabled={reverseMutation.isPending || reverseReason.trim() === ''}
                    >
                      تأكيد العكس وترحيل قيد تعويضي
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={reverseMutation.isPending}
                      onClick={() => {
                        setReverseTargetId(null);
                        setReverseReason('');
                      }}
                    >
                      إلغاء
                    </Button>
                  </div>
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Undo2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    العكس لا يحذف قيد التصحيح ولا يمس القيد الأصلي للمصدر؛ يُرحَّل قيد معاكس منفصل
                    ومساوٍ في المقدار، وتبقى القيود الثلاثة ظاهرة معاً.
                  </p>
                </EntityForm.Root>
              ) : null}
              {correction.status === 'VALIDATED' && !canApply ? (
                <p className="text-xs text-muted-foreground" role="alert">
                  التطبيق يتطلب صلاحية محاسب أو مدير نظام؛ صلاحية المدير التشغيلي لا تكفي، والخادم
                  يرفض الطلب.
                </p>
              ) : null}
              {correction.status === 'APPLIED' && !canApply ? (
                <p className="text-xs text-muted-foreground" role="alert">
                  العكس يتطلب صلاحية محاسب أو مدير نظام؛ صلاحية المدير التشغيلي لا تكفي، والخادم
                  يرفض الطلب.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </AsyncContentState>

      {!canDraft ? (
        <p className="text-sm text-muted-foreground" role="alert">
          إنشاء مسودات التصحيح غير متاح لصلاحيتك الحالية، ويتطلب صلاحية مدير نظام أو مدير.
        </p>
      ) : null}

      {canDraft ? (
        <EntityForm.Root
          className="space-y-3 rounded-lg border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setStatusMessage(null);
            setErrorMessage(null);
            createMutation.mutate();
          }}
        >
          <EntityForm.Section
            title="إنشاء مسودة تصحيح"
            description="يتحقق الخادم من اعتماد مراجعة S08 وحالة الفترة والتوازن المحاسبي قبل أي ترحيل."
          >
            <label className="block space-y-1">
              <span className="text-sm font-medium">مراجعة S08 المعتمدة</span>
              <Select value={reviewId} onChange={(event) => setReviewId(event.target.value)} required>
                <option value="">— اختر مراجعة معتمدة —</option>
                {(reviewsQuery.data ?? []).map((review) => (
                  <option key={review.id} value={review.id}>
                    {formatShortId(review.id)}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">نوع المصدر</span>
              <Input
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
                required
              />
              <span className="block text-xs text-muted-foreground">
                الأنواع التي يتحقق الخادم من وجود مصدرها داخل شركتك: expense · invoice · payment ·
                deposit. أي نوع آخر يبقى مرتبطاً بمراجعة S08 المعتمدة فقط دون تحقق من وجود المصدر.
              </span>
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">معرّف المصدر</span>
              <Input value={sourceId} onChange={(event) => setSourceId(event.target.value)} required />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">القيد الأصلي (اختياري، للتتبّع فقط)</span>
              <Input
                value={originalBatchId}
                onChange={(event) => setOriginalBatchId(event.target.value)}
                placeholder="يُسجَّل للربط ولا يُعدَّل إطلاقاً"
              />
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
              <span className="text-sm font-medium">الحساب المدين</span>
              <Input
                value={debitAccountNo}
                onChange={(event) => setDebitAccountNo(event.target.value)}
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">الحساب الدائن</span>
              <Input
                value={creditAccountNo}
                onChange={(event) => setCreditAccountNo(event.target.value)}
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">سبب التصحيح</span>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} required />
            </label>
          </EntityForm.Section>

          <Button type="submit" disabled={createMutation.isPending}>
            إنشاء المسودة
          </Button>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden />
            المسودة وحدها لا تُرحّل شيئاً؛ الترحيل يتم عند التطبيق فقط، وبقيد منفصل عن القيد الأصلي.
          </p>
        </EntityForm.Root>
      ) : null}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <FileWarning className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        الفترة المقفلة نهائياً لا تقبل التصحيح، ولا يجوز إعادة فتحها لإخفاء فرق؛ يجب معالجة الفرق
        في فترة مفتوحة وفق القواعد المحاسبية المعتمدة.
      </p>

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
