import { BadgeCheck, CheckCircle2, ClipboardSignature, PlayCircle, Send, ShieldCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { isContractStatus } from '@/lib/contractStatus';
import type { ContractDetail } from '../services/contractService';
import {
  useActivateContract,
  useApproveContract,
  useRejectContract,
  useSubmitContractForApproval,
} from '../useContracts';
import {
  canActivateContract,
  canApproveContract,
  canRejectContract,
  canSubmitContractForApproval,
  isContractApprovalPending,
  isContractApproved,
  isContractRejected,
  normalizeApprovalStatus,
} from './contractLifecycleRules';

export type ContractApprovalMode = 'submit' | 'approve' | 'reject' | 'activate';

const approvalStatusLabels: Record<'PENDING' | 'APPROVED' | 'REJECTED', string> = {
  PENDING: 'قيد الاعتماد',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
};

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const trimSignature = (value: string | null | undefined) => (value ?? '').trim();

/**
 * Canonical contract approval/activation workflow (S04-T03 / DOM-005 / D11).
 *
 * Draft contracts move through a maker→checker approval sub-state; activation
 * is the only path that freezes the authoritative owner-agreement snapshot onto
 * the contract (collection role, operating model, version). The browser never
 * flips a contract to 'active' by itself.
 */
export function ContractApprovalSection({ contract }: Readonly<{ contract: ContractDetail }>) {
  const [dialogMode, setDialogMode] = useState<ContractApprovalMode | null>(null);
  const isDraft = isContractStatus(contract.status, 'draft');
  const isActive = isContractStatus(contract.status, 'active');
  const approvalStatus = normalizeApprovalStatus(contract.approval_status);

  if (!isDraft && !isActive) return null;

  return (
    <>
      <Card className="overflow-hidden border-primary/20 bg-primary/5">
        <CardHeader className="bg-background/80">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            اعتماد العقد وتفعيله
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {isActive ? (
            <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-bg/60 px-3 py-2.5">
              <BadgeCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
              <div className="min-w-0 text-sm">
                <p className="font-bold">العقد نشط — تم تجميد لقطة الاتفاقية عند التفعيل.</p>
                <p className="text-xs text-muted-foreground">
                  دور التحصيل: {contract.collection_role_snapshot ?? 'غير مسجل'} · نموذج التشغيل:{' '}
                  {contract.operating_model_snapshot ?? 'غير مسجل'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">حالة الاعتماد</p>
                {approvalStatus ? (
                  <Badge variant={approvalStatus === 'APPROVED' ? 'success' : approvalStatus === 'REJECTED' ? 'danger' : 'warning'}>
                    {approvalStatusLabels[approvalStatus]}
                  </Badge>
                ) : (
                  <Badge variant="neutral">مسودة غير مُرسلة</Badge>
                )}
              </div>

              {(isContractApprovalPending(contract) || isContractApproved(contract) || isContractRejected(contract)) && (
                <div className="space-y-1.5 rounded-xl border border-border/60 bg-background px-3 py-2.5 text-xs">
                  {trimSignature(contract.maker_signature) && (
                    <p>
                      المُرسِل: <span className="font-bold">{contract.maker_signature}</span> — {formatTimestamp(contract.submitted_at)}
                    </p>
                  )}
                  {trimSignature(contract.checker_signature) && (
                    <p>
                      المُعتمِد/الرافض: <span className="font-bold">{contract.checker_signature}</span>
                      {isContractApproved(contract) ? ` — ${formatTimestamp(contract.approved_at)}` : ''}
                      {isContractRejected(contract) ? ` — ${formatTimestamp(contract.rejected_at)}` : ''}
                    </p>
                  )}
                  {isContractRejected(contract) && contract.rejection_reason && (
                    <p className="text-danger">سبب الرفض: {contract.rejection_reason}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {canSubmitContractForApproval(contract) && (
                  <Button variant="secondary" className="min-h-11" onClick={() => setDialogMode('submit')}>
                    <Send className="me-2 size-4" />
                    إرسال للاعتماد
                  </Button>
                )}
                {canApproveContract(contract) && (
                  <Button className="min-h-11" onClick={() => setDialogMode('approve')}>
                    <CheckCircle2 className="me-2 size-4" />
                    اعتماد
                  </Button>
                )}
                {canRejectContract(contract) && (
                  <Button variant="outline" className="min-h-11" onClick={() => setDialogMode('reject')}>
                    <XCircle className="me-2 size-4" />
                    رفض
                  </Button>
                )}
                {canActivateContract(contract) && (
                  <Button className="min-h-11" onClick={() => setDialogMode('activate')}>
                    <PlayCircle className="me-2 size-4" />
                    تفعيل العقد
                  </Button>
                )}
                {isDraft && !canSubmitContractForApproval(contract) && !canApproveContract(contract) && !canRejectContract(contract) && !canActivateContract(contract) && (
                  <p className="text-xs text-muted-foreground">لا توجد إجراءات اعتماد متاحة في الحالة الحالية.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ContractApprovalDialog
        contract={contract}
        mode={dialogMode}
        onClose={() => setDialogMode(null)}
      />
    </>
  );
}

function ContractApprovalDialog({
  contract,
  mode,
  onClose,
}: Readonly<{ contract: ContractDetail; mode: ContractApprovalMode | null; onClose: () => void }>) {
  const [signature, setSignature] = useState('');
  const [reason, setReason] = useState('');
  const submitMutation = useSubmitContractForApproval(contract.id);
  const approveMutation = useApproveContract(contract.id);
  const rejectMutation = useRejectContract(contract.id);
  const activateMutation = useActivateContract(contract.id);

  const isPending = submitMutation.isPending || approveMutation.isPending || rejectMutation.isPending || activateMutation.isPending;

  const reset = () => {
    setSignature('');
    setReason('');
  };

  const submit = async () => {
    try {
      if (mode === 'submit') await submitMutation.mutateAsync(signature);
      else if (mode === 'approve') await approveMutation.mutateAsync(signature);
      else if (mode === 'reject') await rejectMutation.mutateAsync({ checkerSignature: signature, reason });
      else if (mode === 'activate') await activateMutation.mutateAsync();
      onClose();
      reset();
    } catch {
      // Mutation onError already surfaces the toast; keep the dialog open for retry.
    }
  };

  const open = mode !== null;
  const title =
    mode === 'submit'
      ? 'إرسال العقد للاعتماد'
      : mode === 'approve'
        ? 'اعتماد العقد'
        : mode === 'reject'
          ? 'رفض العقد'
          : mode === 'activate'
            ? 'تفعيل العقد'
            : '';

  const description =
    mode === 'submit'
      ? 'سجّل توقيعك كمنشئ الطلب. لا يمكنك اعتماد الطلب الذي أرسلته بنفسك.'
      : mode === 'approve'
        ? 'سجّل توقيعك كمُعتمِد. يجب أن تكون شخصاً مختلفاً عن من أرسل الطلب.'
        : mode === 'reject'
          ? 'سجّل توقيعك واذكر سبب الرفض. يجب أن تكون شخصاً مختلفاً عن من أرسل الطلب.'
          : mode === 'activate'
            ? 'سيتم تفعيل العقد وتجميد لقطة اتفاقية المالك المعتمدة (دور التحصيل ونموذج التشغيل والنسخة).'
            : '';

  const submitDisabled =
    isPending ||
    (mode === 'submit' || mode === 'approve' || mode === 'reject') && signature.trim() === '' ||
    (mode === 'reject' && reason.trim() === '');

  return (
    <EntityForm.Overlay open={open} onOpenChange={(next) => { if (!next) { onClose(); reset(); } }} title={title} description={description} className="max-w-xl">
      <EntityForm.Root
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-busy={isPending}
      >
        {(mode === 'submit' || mode === 'approve' || mode === 'reject') && (
          <EntityForm.Field
            label={mode === 'submit' ? 'توقيع المنشئ (إلزامي)' : 'توقيع المُعتمِد (إلزامي)'}
            description={mode === 'approve' ? 'سيُرفض الاعتماد تلقائياً إذا كان المُعتمِد هو نفسه من أرسل الطلب.' : undefined}
          >
            <Input
              value={signature}
              onChange={(event) => setSignature(event.target.value)}
              placeholder="اكتب اسمك الكامل كتوقيع..."
              required
              autoComplete="off"
            />
          </EntityForm.Field>
        )}
        {mode === 'reject' && (
          <EntityForm.Field label="سبب الرفض (إلزامي)">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="اذكر سبب رفض العقد..."
              required
            />
          </EntityForm.Field>
        )}
        {mode === 'activate' && (
          <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-bg/40 px-3 py-2.5 text-sm">
            <ClipboardSignature className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <p>
              التفعيل إجراء نهائي لمرحلة الاعتماد: لا يمكن تعديل البنود التجارية الموقّعة بعد التفعيل؛ أي تغيير لاحق يكون
              عبر تجديد أو تعديل يخضع لنفس سلسلة الاعتماد.
            </p>
          </div>
        )}
        <EntityForm.Actions
          onCancel={() => { onClose(); reset(); }}
          isSubmitting={isPending}
          submitDisabled={submitDisabled}
          submitVariant={mode === 'reject' ? 'destructive' : mode === 'activate' ? 'primary' : 'default'}
          submitLabel={
            mode === 'submit' ? 'إرسال للاعتماد' : mode === 'approve' ? 'تأكيد الاعتماد' : mode === 'reject' ? 'تأكيد الرفض' : 'تفعيل العقد'
          }
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}
