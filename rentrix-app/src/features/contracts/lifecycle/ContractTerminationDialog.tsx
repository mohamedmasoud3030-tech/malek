import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useTerminateContract } from '../useContracts';

export function ContractTerminationDialog({ contractId, open, onOpenChange }: Readonly<{ contractId: string; open: boolean; onOpenChange: (open: boolean) => void }>) {
  const terminateMutation = useTerminateContract(contractId);
  const [terminateReason, setTerminateReason] = useState('');
  const submitTermination = async () => {
    await terminateMutation.mutateAsync(terminateReason);
    onOpenChange(false);
    setTerminateReason('');
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>إنهاء العقد</DialogTitle><DialogDescription>سيتم تعيين حالة العقد إلى "منتهٍ" وإلغاء أي فواتير مستقبلية غير مدفوعة مرتبطة به. هذا الإجراء لا يمكن التراجع عنه من هنا.</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void submitTermination(); }}><label className="grid gap-2 text-sm font-bold">سبب الإنهاء (إلزامي)<Textarea value={terminateReason} onChange={(e) => setTerminateReason(e.target.value)} placeholder="اذكر سبب إنهاء العقد..." required /></label><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button><Button type="submit" variant="destructive" disabled={terminateMutation.isPending || terminateReason.trim() === ''}>تأكيد الإنهاء</Button></div></form></DialogContent></Dialog>;
}
