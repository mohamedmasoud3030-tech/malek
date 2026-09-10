import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Landmark, ShieldAlert, ShieldCheck } from 'lucide-react';
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
  approveOwnerFundsCutover,
  createOwnerFundsCutoverDraft,
  createOwnerFundsCutoverRequestId,
  describeOwnerFundsCutoverSource,
  loadApprovedS08Reviews,
  loadOwnerFundsCutover,
  ownerFundsCutoverStatusLabels,
  ownerFundsCutoverStatusTone,
  translateOwnerFundsCutoverError,
  OWNER_FUNDS_GL_ACCOUNT,
} from '../services/owner-funds-cutover-service';

export const ownerFundsCutoverQueryKey = ['owner-funds-cutover'] as const;
export const approvedS08ReviewsQueryKey = ['approved-s08-reviews'] as const;

/**
 * The single canonical surface for governed historical adoption of owner funds
 * (the `owner_funds_event_cutovers` baseline). It is the UI counterpart of the
 * already-deployed, already-granted RPCs
 * `create_owner_funds_cutover_atomic` / `approve_owner_funds_cutover_atomic`.
 *
 * It never asks a user for an amount: the opening balance is derived server-side
 * from GL 2000 at the cutover date. It also never presents an unproven figure as
 * a complete one — a derived zero from zero GL lines is labelled as such, and a
 * missing/incomplete evidence row is shown as a gap with no figure at all.
 */
export function OwnerFundsCutoverPanel() {
  const { user, authorization } = useAuth();
  // Canonical spelling used across the app: the imported authority helper,
  // not a context-bound variant that test providers do not all expose.
  const canGovern = canAccess(authorization, 'financial.owner_settlements.approve');
  const queryClient = useQueryClient();

  const [cutoverDate, setCutoverDate] = useState('');
  const [s08ReviewId, setS08ReviewId] = useState('');
  const [reason, setReason] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(
    null,
  );

  const cutoverQuery = useQuery({ queryKey: ownerFundsCutoverQueryKey, queryFn: loadOwnerFundsCutover });
  const reviewsQuery = useQuery({
    queryKey: approvedS08ReviewsQueryKey,
    queryFn: loadApprovedS08Reviews,
    enabled: canGovern,
  });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ownerFundsCutoverQueryKey }),
      invalidateFinancialReadModels(queryClient),
    ]);

  const createMutation = useMutation({
    mutationFn: () =>
      createOwnerFundsCutoverDraft({
        cutoverDate,
        s08ReviewId,
        reason,
        requestId: createOwnerFundsCutoverRequestId('cutover-create'),
      }),
    onSuccess: async (result) => {
      setStatusMessage({
        tone: 'ok',
        text: result.idempotent
          ? 'المسودة موجودة مسبقاً بنفس الطلب (idempotent) — لم يُنشأ رصيد ثانٍ.'
          : 'أُنشئت مسودة القطع المحاسبي. الاعتماد يتطلب مستخدماً آخر.',
      });
      setReason('');
      await refresh();
    },
    onError: (error) => setStatusMessage({ tone: 'error', text: translateOwnerFundsCutoverError(error) }),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveOwnerFundsCutover(createOwnerFundsCutoverRequestId('cutover-approve')),
    onSuccess: async (result) => {
      setStatusMessage({
        tone: 'ok',
        text: result.idempotent
          ? 'القطع المحاسبي معتمد مسبقاً بنفس الطلب (idempotent).'
          : 'اعتُمد القطع المحاسبي. يُحتسب الرصيد الافتتاحي المشتق من تاريخ القطع فقط.',
      });
      await refresh();
    },
    onError: (error) => setStatusMessage({ tone: 'error', text: translateOwnerFundsCutoverError(error) }),
  });

  const approvedReviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);
  const evidence = cutoverQuery.data?.adopted ? cutoverQuery.data.evidence : null;
  const disclosure = useMemo(() => (evidence ? describeOwnerFundsCutoverSource(evidence) : null), [evidence]);
  const isMaker = Boolean(evidence?.createdBy && user?.id && evidence.createdBy === user.id);
  const canSubmitDraft =
    canGovern && cutoverDate.trim() !== '' && s08ReviewId.trim() !== '' && reason.trim().length >= 3;
  const baselineAlreadyStored = evidence !== null;


  return (
    <section
      className="space-y-4 rounded-xl border p-4"
      aria-label="التبني المحكوم للأرصدة التاريخية لأموال الملاك"
      data-owner-funds-cutover-panel
    >
      <header className="space-y-2">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <Landmark className="size-4" aria-hidden />
          تبني الأرصدة التاريخية لأموال الملاك (القطع المحاسبي)
        </h3>
        <p className="text-sm text-muted-foreground">
          لا يُحتسب أي رصيد لأموال الملاك قبل تاريخ القطع إلا بعد قطع محاسبي معتمد ومدعوم بمراجعة S08
          مجمّدة ومعتمدة. الرصيد الافتتاحي يُشتق في الخادم من حساب {OWNER_FUNDS_GL_ACCOUNT} ولا يُدخل
          يدوياً، ويشترط اعتماد طرف آخر غير منشئ المسودة.
        </p>
      </header>

      <AsyncContentState
        status={cutoverQuery.isLoading ? 'loading' : cutoverQuery.isError ? 'error' : 'ready'}
        error={cutoverQuery.error}
        errorTitle="تعذر قراءة دليل القطع المحاسبي"
        errorFallbackMessage="لم تُقرأ أدلة القطع، ولا يُعرض أي رصيد افتتاحي."
      >
        {evidence === null ? (
          canGovern ? (
                  <div className="space-y-2 rounded-lg border border-dashed p-3" role="status">
            <p className="flex items-center gap-2 font-medium">
              <ShieldAlert className="size-4 text-warning" aria-hidden />
              لا يوجد قطع محاسبي متبنّى لهذه الشركة.
            </p>
            <p className="text-sm text-muted-foreground">
              هذا غياب دليل ولا يعني رصيداً صفرياً: كل موضع مالك قبل تاريخ القطع يفشل مغلقاً برسالة
              تتطلب مراجعة S08 معتمدة.
            </p>
          </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-dashed p-3" role="status">
            <p className="flex items-center gap-2 font-medium">
              <ShieldAlert className="size-4 text-warning" aria-hidden />
              حالة القطع المحاسبي غير معروضة لصلاحيتك الحالية.
            </p>
            <p className="text-sm text-muted-foreground">
              لا تستنتج الواجهة وجود قطع أو غيابه من صلاحية عرض مقيّدة: قراءة القطع المحاسبي
              مقصورة على المدير أو المحاسب لنفس الشركة.
            </p>
          </div>
          )
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">الحالة</p>
                <StatusBadge tone={ownerFundsCutoverStatusTone(evidence.status)}>
                  {ownerFundsCutoverStatusLabels[evidence.status]}
                </StatusBadge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">تاريخ القطع المعتمد</p>
                <p className="font-medium">{evidence.cutoverDate}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  الرصيد الافتتاحي المشتق من حساب {OWNER_FUNDS_GL_ACCOUNT}
                </p>
                <p className="font-medium">{formatMoney(evidence.openingBalanceOmr)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">حركات حساب {OWNER_FUNDS_GL_ACCOUNT} عند تاريخ القطع</p>
                <p className="font-medium">{evidence.glLineCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">مراجعة S08 المرتبطة</p>
                <p className="font-medium">{formatShortId(evidence.s08ReviewId)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">السبب الموثق</p>
                <p className="font-medium">{evidence.reason ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">منشئ المسودة</p>
                <p className="font-medium">{formatShortId(evidence.createdBy ?? '')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">المعتمِد</p>
                <p className="font-medium">
                  {evidence.approvedBy ? formatShortId(evidence.approvedBy) : 'لم يُعتمد بعد'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">وقت الاعتماد</p>
                <p className="font-medium">{evidence.approvedAt ?? '—'}</p>
              </div>
            </div>

            {disclosure ? (
              <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Fingerprint className="size-4" aria-hidden />
                  دليل المصدر
                </p>
                <p>{disclosure.sourceLabel}</p>
                <p data-cutover-balance-caption>{disclosure.balanceCaption}</p>
                <p className="break-all text-xs text-muted-foreground">{disclosure.fingerprintNotice}</p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  {disclosure.makerCheckerNotice}
                </p>
              </div>
            ) : null}

            {evidence.status === 'DRAFT' ? (
              <div className="space-y-2">
                <Button
                  type="button"
                  disabled={!canGovern || isMaker || approveMutation.isPending}
                  onClick={() => approveMutation.mutate()}
                >
                  اعتماد القطع المحاسبي
                </Button>
                {isMaker ? (
                  <p className="text-sm text-muted-foreground" role="alert">
                    أنشأت هذه المسودة بنفسك؛ الاعتماد يتطلب معتمِداً آخر (فصل المعد عن المدقق) ويرفضه
                    الخادم.
                  </p>
                ) : null}
                {!canGovern ? (
                  <p className="text-sm text-muted-foreground" role="alert">
                    اعتماد تسويات الملاك غير متاح لصلاحيتك الحالية، والاعتماد يتطلب مديراً أو محاسباً.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </AsyncContentState>

      {canGovern ? (
        <EntityForm.Root
          className="space-y-3 rounded-lg border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            setStatusMessage(null);
            createMutation.mutate();
          }}
        >
          <EntityForm.Section
            title="إنشاء مسودة قطع محاسبي (معد)"
            description={`الرصيد لا يُدخل هنا: يشتق الخادم رصيد حساب ${OWNER_FUNDS_GL_ACCOUNT} وعدد حركاته وبصمته عند تاريخ القطع.`}
          >
            {baselineAlreadyStored ? (
              <p className="text-sm text-muted-foreground" role="status">
                يوجد قطع محاسبي محفوظ لهذه الشركة؛ إعادة الإرسال تُعيد نفس المسودة دون تغيير ولا
                تُستبدل. لا تُعد الواجهة أرصدة تاريخية معتمدة.
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <EntityForm.Field label="تاريخ القطع" required>
                <Input
                  type="date"
                  aria-label="تاريخ القطع المحاسبي"
                  value={cutoverDate}
                  onChange={(event) => setCutoverDate(event.target.value)}
                  required
                />
              </EntityForm.Field>
              <EntityForm.Field label="مراجعة S08 معتمدة" required>
                <Select
                  aria-label="مراجعة S08 المعتمدة"
                  value={s08ReviewId}
                  onChange={(event) => setS08ReviewId(event.target.value)}
                  required
                >
                  <option value="">اختر مراجعة معتمدة…</option>
                  {approvedReviews.map((review) => (
                    <option key={review.id} value={review.id}>
                      {review.datasetLineage || review.id} {review.reviewedAt ? `— ${review.reviewedAt}` : ''}
                    </option>
                  ))}
                </Select>
              </EntityForm.Field>
            </div>
            {reviewsQuery.isError ? (
              <p className="text-sm" role="alert">
                تعذر تحميل مراجعات S08 المعتمدة، ولا يمكن إنشاء مسودة بدون مراجعة معتمدة.
              </p>
            ) : null}
            {!reviewsQuery.isError && reviewsQuery.isSuccess && approvedReviews.length === 0 ? (
              <p className="text-sm" role="status">
                لا توجد مراجعة S08 معتمدة لهذه الشركة؛ لا يمكن تبني رصيد افتتاحي قبل اعتمادها.
              </p>
            ) : null}
            <EntityForm.Field label="سبب التبني (3 أحرف على الأقل)" required>
              <Textarea
                aria-label="سبب التبني"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                required
              />
            </EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel="إنشاء مسودة القطع"
            submitDisabled={!canSubmitDraft || createMutation.isPending}
          />
        </EntityForm.Root>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          إنشاء قطع محاسبي متاح للمدير أو المحاسب فقط، وهو مقيّد أيضاً في الخادم.
        </p>
      )}

      {statusMessage ? (
        <p
          role={statusMessage.tone === 'ok' ? 'status' : 'alert'}
          className={statusMessage.tone === 'ok' ? 'text-sm' : 'text-sm text-danger-text'}
        >
          {statusMessage.text}
        </p>
      ) : null}
    </section>
  );
}
