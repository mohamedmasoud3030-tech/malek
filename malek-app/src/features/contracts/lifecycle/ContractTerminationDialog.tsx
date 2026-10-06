import { useState } from 'react';
import { EntityForm } from '@/components/ui/entity-form';
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

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={onOpenChange}
      title="إنهاء العقد"
      description={'سيتم إنهاء العقد الإيجاري قبل موعده المخطط وتغيير حالته إلى "منتهٍ"، مع إيقاف الفواتير المستقبلية والحفاظ الكامل على السجلات والقيود المحاسبية السابقة.'}
      className="max-w-xl"
    >
      <EntityForm.Root
        onSubmit={(event) => {
          event.preventDefault();
          void submitTermination();
        }}
        aria-busy={terminateMutation.isPending}
      >
        <EntityForm.Field label="سبب الإنهاء (إلزامي)">
          <Textarea
            value={terminateReason}
            onChange={(event) => setTerminateReason(event.target.value)}
            placeholder="اذكر سبب إنهاء العقد..."
            required
          />
        </EntityForm.Field>
        <EntityForm.Actions
          onCancel={() => onOpenChange(false)}
          isSubmitting={terminateMutation.isPending}
          submitDisabled={terminateMutation.isPending || terminateReason.trim() === ''}
          submitVariant="destructive"
          submitLabel="تأكيد الإنهاء"
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}