import { useEffect, useState } from 'react';
import { CheckCircle2, LockKeyhole, RefreshCw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { listMyPermissionRequests, requestPermission, type PermissionRequest } from '@/features/auth/permission-request-service';
import type { AppPermission } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';

function describePermissionStatus(existingRequest: PermissionRequest | undefined): string | null {
  if (existingRequest?.status === 'PENDING') {
    return 'قيد المراجعة — لن يُرسل طلب مكرر لهذا المورد.';
  }
  if (existingRequest?.status === 'APPROVED' && existingRequest.grant_active) {
    return 'تمت الموافقة. حدّث صلاحيات الجلسة للمتابعة دون تسجيل خروج.';
  }
  if (existingRequest?.status === 'APPROVED') {
    return 'المنحة السابقة أُلغيت ولم تعد فعّالة. يمكنك طلب الصلاحية مرة أخرى مع الاحتفاظ بسجل القرار السابق.';
  }
  if (existingRequest?.status === 'REJECTED') {
    const reasonSuffix = existingRequest.decision_reason ? ` — ${existingRequest.decision_reason}` : '';
    return `مرفوض${reasonSuffix}. يمكنك إعادة الطلب مع توضيح جديد.`;
  }
  return null;
}

export function PermissionRequestDialog({
  open,
  onOpenChange,
  permission,
  resourceRoute,
  label,
  onSubmitted,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permission: AppPermission;
  resourceRoute: string;
  label: string;
  onSubmitted?: () => void;
}>) {
  const { refreshPermissions } = useAuth();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [error, setError] = useState('');
  const [existingRequest, setExistingRequest] = useState<PermissionRequest | undefined>();

  const loadExisting = async () => {
    setLoadingExisting(true);
    try {
      const requests = await listMyPermissionRequests();
      setExistingRequest(requests.find((request) =>
        request.permission === permission
        && (request.resource_route ?? '') === resourceRoute,
      ));
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingExisting(true);
    void listMyPermissionRequests().then((requests) => {
      if (!cancelled) {
        setExistingRequest(requests.find((request) =>
          request.permission === permission
          && (request.resource_route ?? '') === resourceRoute,
        ));
      }
    }, () => undefined).finally(() => { if (!cancelled) setLoadingExisting(false); });
    return () => { cancelled = true; };
  }, [open, permission, resourceRoute]);

  const submit = async () => {
    if (pending || existingRequest?.status === 'PENDING' || (existingRequest?.status === 'APPROVED' && existingRequest.grant_active)) return;
    setPending(true);
    setError('');
    try {
      const request = await requestPermission(permission, resourceRoute, reason);
      setExistingRequest(request);
      onSubmitted?.();
      setReason('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر إرسال طلب الصلاحية.');
    } finally {
      setPending(false);
    }
  };

  const refreshApprovedPermission = async () => {
    setPending(true);
    try {
      await Promise.all([refreshPermissions(), loadExisting()]);
      onOpenChange(false);
    } catch {
      setError('تعذر تحديث الصلاحيات الآن. أعد المحاولة.');
    } finally {
      setPending(false);
    }
  };

  const statusText = describePermissionStatus(existingRequest);

  const submitLabel = (() => {
    if (pending) return 'جارٍ الإرسال...';
    if (existingRequest?.status === 'REJECTED' || existingRequest?.status === 'APPROVED') return 'إعادة إرسال الطلب';
    return 'إرسال الطلب';
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg gap-3 p-3 sm:gap-4 sm:p-5">
        <DialogHeader className="pe-10">
          <div className="flex items-start gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning/12 text-warning">
              <LockKeyhole className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base">ليس لديك صلاحية</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs leading-5">الوصول إلى «{label}» يحتاج إلى صلاحية إضافية.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="permission-request-reason" className="text-xs font-bold">سبب الطلب</label>
          <Textarea
            id="permission-request-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="اشرح سبب احتياجك لهذه الصلاحية"
            rows={3}
            className="min-h-24"
            disabled={pending || existingRequest?.status === 'PENDING' || (existingRequest?.status === 'APPROVED' && existingRequest.grant_active)}
          />
          {loadingExisting ? <p role="status" className="text-xs leading-5 text-muted-foreground">جارٍ التحقق من الطلبات السابقة...</p> : null}
          {statusText ? (
            <p className="rounded-lg bg-muted/40 px-2.5 py-2 text-xs font-bold leading-5" role="status">
              {existingRequest?.status === 'APPROVED' && existingRequest.grant_active ? <CheckCircle2 className="me-1 inline size-3.5 text-success" aria-hidden="true" /> : null}
              {statusText}
            </p>
          ) : null}
          {error ? <p role="alert" className="text-xs font-bold text-destructive">{error}</p> : null}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:justify-end">
          {existingRequest?.status === 'APPROVED' && existingRequest.grant_active ? (
            <Button className="min-h-11" onClick={() => void refreshApprovedPermission()} disabled={pending}>
              <RefreshCw className="me-1.5 size-3.5" aria-hidden="true" />تحديث الصلاحيات
            </Button>
          ) : (
            <Button className="min-h-11" onClick={() => void submit()} disabled={pending || loadingExisting || existingRequest?.status === 'PENDING'}>
              <Send className="me-1.5 size-3.5" aria-hidden="true" />
              {submitLabel}
            </Button>
          )}
          <Button className="min-h-11" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>إغلاق</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
