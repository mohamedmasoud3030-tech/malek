import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAgreementCoverage } from '@/features/owners/useOwnerAgreements';
import { renewalSchema, type RenewalPayload } from '../contractSchema';
import type { ContractDetail, RenewalResult } from '../services/contractService';
import { useRenewContract } from '../useContracts';
import { getRenewalDefaults } from './contractLifecycleRules';

const fieldError = (message?: string) => message ? <span className="text-xs font-bold text-destructive">{message}</span> : null;

export function ContractRenewalDialog({ contract, open, onOpenChange, onRenewed }: Readonly<{ contract: ContractDetail; open: boolean; onOpenChange: (open: boolean) => void; onRenewed: (result: RenewalResult) => Promise<void> | void }>) {
  const renewMutation = useRenewContract(contract.id);
  const form = useForm<RenewalPayload>({ resolver: zodResolver(renewalSchema), values: open ? getRenewalDefaults(contract) : undefined, defaultValues: getRenewalDefaults(contract) });
  const renewalStart = form.watch('new_start');
  const renewalEnd = form.watch('new_end');
  const renewalAgreementQuery = useAgreementCoverage(contract.property_id, renewalStart, renewalEnd);
  const renewalAgreement = renewalAgreementQuery.data ?? null;
  const renewalCoverageError = open && renewalStart && renewalEnd && !renewalAgreementQuery.isLoading && !renewalAgreement
    ? 'لا توجد اتفاقية إدارة تغطي كامل فترة التجديد. أنشئ اتفاقية لاحقة من صفحة العقار قبل التجديد.'
    : null;

  const submitRenewal = async (values: RenewalPayload) => {
    if (!renewalAgreement) {
      form.setError('agreement_id', { type: 'validate', message: 'اختر اتفاقية تغطي كامل فترة التجديد.' });
      return;
    }
    const result = await renewMutation.mutateAsync({ ...values, agreement_id: renewalAgreement.id });
    onOpenChange(false);
    await onRenewed(result);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>تجديد العقد</DialogTitle><DialogDescription>سيتم إنشاء عقد جديد مرتبط بالعقد الحالي مع حفظ سلسلة التجديد. يجب وجود اتفاقية إدارة تغطي كامل فترة التجديد.</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={form.handleSubmit(submitRenewal)}>{renewalCoverageError ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm font-bold text-destructive">{renewalCoverageError}</p> : null}<label className="grid gap-2 text-sm font-bold">تاريخ البداية<Input type="date" {...form.register('new_start')} />{fieldError(form.formState.errors.new_start?.message)}</label><label className="grid gap-2 text-sm font-bold">تاريخ النهاية<Input type="date" {...form.register('new_end')} />{fieldError(form.formState.errors.new_end?.message)}</label><label className="grid gap-2 text-sm font-bold">اتفاقية المالك المغطية<Select value={renewalAgreement?.id ?? ''} disabled><option value="">{renewalAgreementQuery.isLoading ? 'جار التحقق من الاتفاقية...' : renewalAgreement ? `اتفاقية ${renewalAgreement.starts_on} — ${renewalAgreement.ends_on ?? 'مفتوحة'}` : 'لا توجد اتفاقية مغطية'}</option></Select>{fieldError(form.formState.errors.agreement_id?.message)}</label><label className="grid gap-2 text-sm font-bold">قيمة الإيجار<Input type="number" step="0.01" inputMode="decimal" min="0" {...form.register('new_amount')} />{fieldError(form.formState.errors.new_amount?.message)}</label><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button><Button type="submit" disabled={renewMutation.isPending || renewalAgreementQuery.isLoading || Boolean(renewalCoverageError)}>تجديد العقد</Button></div></form></DialogContent></Dialog>;
}
