import { MessageCircle, Printer, RefreshCw, Share2, ShieldAlert } from 'lucide-react';
import { EntityPreviewDialog } from '@/components/ui/entity-preview-dialog';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { ContractDocumentsShell } from '../contractDocumentsShell';
import { ContractPaymentsTab } from '../contractPaymentsTab';
import {
  ContractFinancialTimelineSection,
  ContractLifecycleSection,
  ContractOverviewSection,
  ContractTimelineSection,
} from './ContractDetailSections';
import { ContractRenewalDialog } from '../lifecycle/ContractRenewalDialog';
import { ContractTerminationDialog } from '../lifecycle/ContractTerminationDialog';
import { canRenewContract, canTerminateContract } from '../lifecycle/contractLifecycleRules';
import { exportContractPdf, openContractWhatsApp, printContractView, shareContractLink } from '../actions/contractDetailActions';
import { useContract } from '../useContracts';
import { useState } from 'react';

export function ContractPreviewDialog({
  contractId,
  open,
  onOpenChange,
  onEdit,
}: Readonly<{
  contractId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (contractId: string) => void;
}>) {
  const contractQuery = useContract(contractId ?? '');
  const companySettings = useCompanySettingsContract();
  const documentSettings = useDocumentSettings();
  const [renewOpen, setRenewOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const contract = contractQuery.data;

  const actions = contract ? (
    <>
      <Button variant="secondary" className="min-h-11" disabled={!canRenewContract(contract)} onClick={() => setRenewOpen(true)}>
        <RefreshCw className="me-2 size-4" />تجديد
      </Button>
      {canTerminateContract(contract) ? (
        <Button variant="destructive" className="min-h-11" onClick={() => setTerminateOpen(true)}>
          <ShieldAlert className="me-2 size-4" />إنهاء
        </Button>
      ) : null}
      <Button variant="secondary" className="min-h-11" disabled={!documentSettings.isReady} onClick={() => printContractView(contract, documentSettings.companySettings)}>
        <Printer className="me-2 size-4" />طباعة
      </Button>
      <Button variant="secondary" className="min-h-11" disabled={!documentSettings.isReady} onClick={() => exportContractPdf(contract, documentSettings.companySettings)}>
        PDF
      </Button>
      <Button variant="secondary" className="min-h-11" onClick={() => openContractWhatsApp(contract)}>
        <MessageCircle className="me-2 size-4" />واتساب
      </Button>
      <Button variant="secondary" className="min-h-11" onClick={() => shareContractLink(contract)}>
        <Share2 className="me-2 size-4" />مشاركة
      </Button>
      {onEdit ? (
        <Button className="min-h-11" onClick={() => onEdit(contract.id)}>تعديل</Button>
      ) : null}
    </>
  ) : undefined;

  return (
    <>
      <EntityPreviewDialog
        open={open}
        onOpenChange={onOpenChange}
        title="معاينة العقد"
        description={contract ? `العقد رقم #${contract.id.slice(0, 8)} — التفاصيل كاملة بدون مغادرة سجل العقود.` : 'تحميل تفاصيل العقد...'}
        actions={actions}
      >
        {contractQuery.isLoading ? <LoadingState label="جارٍ تحميل تفاصيل العقد" /> : null}
        {contractQuery.isError ? (
          <ErrorState
            title="تعذر تحميل العقد"
            description={contractQuery.error instanceof Error ? contractQuery.error.message : 'حدث خطأ أثناء تحميل تفاصيل العقد.'}
            onRetry={() => { void contractQuery.refetch(); }}
          />
        ) : null}
        {contract ? (
          <div className="space-y-5">
            <ContractOverviewSection contract={contract} settings={companySettings} />
            <ContractLifecycleSection
              contract={contract}
              settings={companySettings}
              renewalAllowed={canRenewContract(contract)}
              onRenew={() => setRenewOpen(true)}
              canTerminate={canTerminateContract(contract)}
              onTerminate={() => setTerminateOpen(true)}
            />
            <ContractPaymentsTab contractId={contract.id} />
            <ContractFinancialTimelineSection contract={contract} settings={companySettings} />
            <ContractTimelineSection contract={contract} settings={companySettings} />
            <ContractDocumentsShell contractId={contract.id} />
          </div>
        ) : null}
      </EntityPreviewDialog>

      {contract ? (
        <>
          <ContractRenewalDialog
            contract={contract}
            open={renewOpen}
            onOpenChange={setRenewOpen}
            onRenewed={async () => {
              setRenewOpen(false);
              await contractQuery.refetch();
            }}
          />
          <ContractTerminationDialog
            contractId={contract.id}
            open={terminateOpen}
            onOpenChange={setTerminateOpen}
          />
        </>
      ) : null}
    </>
  );
}
