import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAgreementCoverage } from '@/features/owners/useOwnerAgreements';
import { renewalSchema, type RenewalPayload } from '../contractSchema';
import type { ContractDetail, RenewalResult } from '../services/contractService';
import { useRenewContract } from '../useContracts';
import { getRenewalDefaults } from './contractLifecycleRules';

export function ContractRenewalDialog({ contract, open, onOpenChange, onRenewed }: Readonly<{ contract: ContractDetail; open: boolean; onOpenChange: (open: boolean) => void; onRenewed: (result: RenewalResult) => Promise<void> | void }>) {
  const renewMutation = useRenewContract(contract.id);
  const form = useForm<RenewalPayload>({ resolver: zodResolver(renewalSchema), values: open ? getRenewalDefaults(contract) : undefined, defaultValues: getRenewalDefaults(contract) });
  const renewalStart = form.watch('new_start');
  const renewalEnd = form.watch('new_end');
  const renewalAgreementQuery = useAgreementCoverage(contract.property_id, renewalStart, renewalEnd);
  const renewalAgreement = renewalAgreementQuery.data ?? null;
  const renewalCoverageMissing = Boolean(open && renewalStart && renewalEnd && !renewalAgreementQuery.isLoading && !renewalAgreement);

  const submitRenewal = async (values: RenewalPayload) => {
    if (!renewalAgreement) {
      form.setError('agreement_id', { type: 'validate', message: 'اختر اتفاقية تغطي كامل فترة التجديد.' });
      return;
    }
    const result = await renewMutation.mutateAsync({ ...values, agreement_id: renewalAgreement.id });
    onOpenChange(false);
    await onRenewed(result);
  };

  let agreementOptionLabel = 'لا توجد اتفاقية مغطية';
  if (renewalAgreementQuery.isLoading) {
    agreementOptionLabel = 'جار التحقق من الاتفاقية...';
  } else if (renewalAgreement) {
    agreementOptionLabel = `اتفاقية ${renewalAgreement.starts_on} — ${renewalAgreement.ends_on ?? 'مفتوحة'}`;
  }

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={onOpenChange}
      title="تجديد العقد"
      description="سيتم إنشاء عقد جديد مرتبط بالعقد الحالي مع حفظ سلسلة التجديد. يجب وجود اتفاقية إدارة تغطي كامل فترة التجديد."
      className="max-w-xl"
    >
      <EntityForm.Root onSubmit={form.handleSubmit(submitRenewal)} aria-busy={renewMutation.isPending}>
        {renewalCoverageMissing && (
          <Card className="col-span-full border-destructive/30 bg-destructive/5" role="alert">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <AlertTriangle className="size-5 shrink-0" />
                لا توجد اتفاقية إدارة تغطي كامل فترة التجديد
              </CardTitle>
              <CardDescription className="text-destructive/80">
                أنشئ اتفاقية لاحقة من صفحة العقار قبل التجديد.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link
                  to="/properties/$propertyId"
                  params={{ propertyId: contract.property_id }}
                  search={{ tab: 'ownership' as const }}
                >
                  <FileCheck className="me-2 size-4" />
                  فتح اتفاقيات العقار
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
        <EntityForm.Field label="تاريخ البداية" error={form.formState.errors.new_start?.message}>
          <Input type="date" {...form.register('new_start')} />
        </EntityForm.Field>
        <EntityForm.Field label="تاريخ النهاية" error={form.formState.errors.new_end?.message}>
          <Input type="date" {...form.register('new_end')} />
        </EntityForm.Field>
        <EntityForm.Field label="اتفاقية المالك المغطية" error={form.formState.errors.agreement_id?.message}>
          <Select value={renewalAgreement?.id ?? ''} disabled>
            <option value="">{agreementOptionLabel}</option>
          </Select>
        </EntityForm.Field>
        <EntityForm.Field label="قيمة الإيجار" error={form.formState.errors.new_amount?.message}>
          <Input type="number" step="0.01" inputMode="decimal" min="0" {...form.register('new_amount')} />
        </EntityForm.Field>
        <EntityForm.Actions
          onCancel={() => onOpenChange(false)}
          isSubmitting={renewMutation.isPending}
          submitDisabled={renewMutation.isPending || renewalAgreementQuery.isLoading || renewalCoverageMissing}
          submitLabel="تجديد العقد"
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}