import { LockKeyhole, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { listPermissionRequests, requestPermission } from '@/features/auth/permission-request-service';
import type { AppPermission } from '@/features/auth/permissions';

export function PermissionRequestDialog({ open, onOpenChange, permission, resourceRoute, label, onSubmitted }: Readonly<{ open: boolean; onOpenChange: (open: boolean) => void; permission: AppPermission; resourceRoute: string; label: string; onSubmitted?: () => void }>) {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingRequest, setExistingRequest] = useState<Awaited<ReturnType<typeof listPermissionRequests>>[number] | undefined>();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void listPermissionRequests().then((requests) => { if (!cancelled) setExistingRequest(requests.find((request) => request.permission === permission)); }, () => undefined);
    return () => { cancelled = true; };
  }, [open, permission]);
  const submit = async () => {
    setPending(true); setError(null);
    try { await requestPermission(permission, resourceRoute, reason); onSubmitted?.(); onOpenChange(false); setReason(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر إرسال طلب الصلاحية'); }
    finally { setPending(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="max-w-lg"><DialogHeader><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-warning/15 text-warning"><LockKeyhole className="size-5" aria-hidden="true" /></span><div><DialogTitle>ليس لديك صلاحية</DialogTitle><DialogDescription className="mt-1">الوصول إلى «{label}» يحتاج إلى صلاحية إضافية من المدير.</DialogDescription></div></div></DialogHeader><div className="space-y-2"><label htmlFor="permission-request-reason" className="text-sm font-bold">سبب الطلب (اختياري)</label><Textarea id="permission-request-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="اكتب سبب احتياجك لهذه الصلاحية" rows={4} disabled={pending} />{existingRequest ? <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs font-bold">حالة الطلب: {existingRequest.status === 'PENDING' ? 'قيد المراجعة' : existingRequest.status === 'APPROVED' ? 'تمت الموافقة' : 'مرفوض'}{existingRequest.decision_reason ? ` — ${existingRequest.decision_reason}` : ''}</p> : null}{error ? <p role="alert" className="text-sm font-bold text-destructive">{error}</p> : null}</div><div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>إلغاء</Button><Button onClick={() => void submit()} disabled={pending}><Send className="me-2 size-4" aria-hidden="true" />{pending ? 'جارٍ الإرسال...' : 'اطلب صلاحية من المدير'}</Button></div></DialogContent></Dialog>;
}
