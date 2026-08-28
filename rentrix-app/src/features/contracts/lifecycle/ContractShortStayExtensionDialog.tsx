import { useEffect, useState } from 'react';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { formatDefaultCompanyMoney } from '@/lib/companyFormatters';
import { MONEY_STEP } from '@/lib/money';
import type { ContractDetail } from '../services/contractService';
import { useExtendShortStayContract } from '../useContracts';

type Props = Readonly<{
  contract: ContractDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>;

export function ContractShortStayExtensionDialog({ contract, open, onOpenChange }: Props) {
  const mutation = useExtendShortStayContract(contract.id);
  const [newEndDate, setNewEndDate] = useState('');
  const [extensionAmount, setExtensionAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNewEndDate('');
    setExtensionAmount('');
    setFormError(null);
  }, [open]);

  const submit = async () => {
    setFormError(null);
    const amount = Number(extensionAmount);
    if (!newEndDate || newEndDate <= contract.end_date) {
      setFormError('اختر تاريخ نهاية بعد تاريخ الخروج الحالي.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('أدخل مبلغ التمديد المتفق عليه.');
      return;
    }
    try {
      await mutation.mutateAsync({ newEndDate, extensionAmount: amount });
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'تعذر تمديد الإقامة.');
    }
  };

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={(nextOpen) => { if (!mutation.isPending) onOpenChange(nextOpen); }}
      title="تمديد الإقامة القصيرة"
      description="مدّد تاريخ الخروج قبل نهايته وحدد مبلغ الفترة الإضافية المتفق عليه."
      className="max-w-lg"
      visualVariant="operational"
    >
      <EntityForm.Root
        aria-busy={mutation.isPending}
        onSubmit={(event) => {
          event.preventDefault();
          if (!mutation.isPending) void submit();
        }}
      >
        <EntityForm.Section title="التمديد">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
            <p className="font-bold">الخروج الحالي: {contract.end_date}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              إجمالي الإقامة الحالي: {formatDefaultCompanyMoney(contract.rent_amount)}
            </p>
          </div>

          <EntityForm.Field label="تاريخ الخروج الجديد">
            <Input
              type="date"
              min={contract.end_date}
              value={newEndDate}
              onChange={(event) => setNewEndDate(event.target.value)}
              required
            />
          </EntityForm.Field>

          <EntityForm.Field label="مبلغ التمديد المتفق عليه">
            <Input
              type="number"
              min="0.001"
              step={MONEY_STEP}
              inputMode="decimal"
              value={extensionAmount}
              onChange={(event) => setExtensionAmount(event.target.value)}
              required
            />
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              هذا المبلغ يُضاف كاستحقاق مستقل للفترة الجديدة؛ لا يتم تعديل فاتورة الإقامة الأصلية.
            </p>
          </EntityForm.Field>
        </EntityForm.Section>

        <EntityForm.ErrorSummary message={formError} />
        <EntityForm.Actions
          onCancel={() => onOpenChange(false)}
          isSubmitting={mutation.isPending}
          submitDisabled={mutation.isPending || !newEndDate || !extensionAmount}
          submitLabel={mutation.isPending ? 'جار التمديد...' : 'تأكيد التمديد'}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}
