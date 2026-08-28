import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { BarChart3, CalendarPlus, Edit } from 'lucide-react';
import { useState } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { buildContractActions } from '@/components/ui/entity-action-presets';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { DocumentReadinessNotice } from '@/features/settings/components/document-readiness-notice';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { useAuth } from '@/hooks/use-auth';
import { normalizeContractStatus } from '@/lib/contractStatus';
import {
  exportContractPdf,
  printContractView,
  shareContractLink,
  shareContractViaWhatsApp,
} from '../actions/contractDetailActions';
import { ContractDetailWorkspace } from '../components/ContractDetailWorkspace';
import { contractStatusLabels, contractStatusTone } from '../contractSchema';
import { ContractRenewalDialog } from '../lifecycle/ContractRenewalDialog';
import { ContractShortStayExtensionDialog } from '../lifecycle/ContractShortStayExtensionDialog';
import { ContractTerminationDialog } from '../lifecycle/ContractTerminationDialog';
import { canExtendShortStayContract, canRenewContract, canTerminateContract } from '../lifecycle/contractLifecycleRules';
import { useContract } from '../useContracts';

const getContractDetailErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء تحميل العقد.';

export function ContractDetailPage() {
  const { contractId } = useParams({ strict: false }) as { contractId: string };
  const navigate = useNavigate();
  const contractQuery = useContract(contractId);
  const companySettings = useCompanySettingsContract();
  const documentSettings = useDocumentSettings();
  const { canAccess } = useAuth();
  const canViewReports = canAccess('financial.reports.view');
  const canEditContract = canAccess('contracts.edit');
  const canCancelContract = canAccess('contracts.cancel');
  const canGenerateInvoices = canAccess('financial.invoices.generate');
  const [renewOpen, setRenewOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);

  if (contractQuery.isLoading || contractQuery.isError || !contractQuery.data) {
    let status: 'loading' | 'error' | 'empty' = 'empty';
    if (contractQuery.isLoading) status = 'loading';
    else if (contractQuery.isError) status = 'error';
    const retry = () => contractQuery.refetch().catch(() => undefined);

    return (
      <AsyncContentState
        status={status}
        error={contractQuery.error}
        errorTitle="تعذر تحميل العقد"
        errorFallbackMessage={getContractDetailErrorMessage(contractQuery.error)}
        errorAction={<Button onClick={retry}>إعادة المحاولة</Button>}
        emptyTitle="العقد غير موجود"
        emptyDescription="ربما تم حذف العقد أو لا تملك صلاحية الوصول إليه."
      >
        {null}
      </AsyncContentState>
    );
  }

  const contract = contractQuery.data;
  const contractStatus = normalizeContractStatus(contract.status);
  const renewalAllowed = canEditContract && canRenewContract(contract);
  const terminationAllowed = canCancelContract && canTerminateContract(contract);
  const extensionAllowed = canEditContract && canGenerateInvoices && canExtendShortStayContract(contract);
  const openRenewal = () => { if (renewalAllowed) setRenewOpen(true); };
  const openExtension = () => { if (extensionAllowed) setExtendOpen(true); };
  const openTermination = () => { if (terminationAllowed) setTerminateOpen(true); };
  const handleShare = () => shareContractLink(contract);
  const contractMenuActions: ActionMenuItem[] = [
    ...(extensionAllowed ? [{
      id: 'extend-short-stay',
      label: 'تمديد الإقامة',
      icon: <CalendarPlus className="size-4" />,
      onSelect: openExtension,
    }] : []),
    ...(canViewReports ? [{
      id: 'reports',
      label: 'كشف وتقارير العقد',
      icon: <BarChart3 className="size-4" />,
      onSelect: () => {
        void navigate({
          to: '/reports',
          search: { section: 'statements', contractId: contract.id, tenantId: contract.tenant_id ?? undefined } as never,
        });
      },
    }] : []),
    ...buildContractActions({
      onPrint: documentSettings.isReady ? () => printContractView(contract, documentSettings.companySettings) : undefined,
      onPdf: documentSettings.isReady ? () => exportContractPdf(contract, documentSettings.companySettings) : undefined,
      onWhatsApp: contract.people?.phone ? () => shareContractViaWhatsApp(contract) : undefined,
      onShare: handleShare,
      onRenew: renewalAllowed ? openRenewal : undefined,
      onTerminate: terminationAllowed ? openTermination : undefined,
    }),
  ];

  return (
    <PageLayout dir="rtl" size="wide" visualVariant="malek-pro">
      {!documentSettings.isReady && !documentSettings.isLoading ? <DocumentReadinessNotice /> : null}
      <EntityDetailHeader
        title={contract.reference ?? 'عقد الإيجار'}
        subtitle={`${contract.people?.full_name ?? 'مستأجر غير محدد'} · ${contract.properties?.title ?? 'عقار غير محدد'} · الوحدة ${contract.units?.unit_number ?? '—'}`}
        status={<StatusBadge tone={contractStatusTone[contractStatus]}>{contractStatusLabels[contractStatus]}</StatusBadge>}
        backTo="/contracts"
        actions={(
          <>
            {canEditContract ? (
              <Button asChild className="min-h-11">
                <Link to="/contracts/$contractId/edit" params={{ contractId }}>
                  <Edit className="me-2 size-4" aria-hidden="true" />
                  تعديل
                </Link>
              </Button>
            ) : null}
            {contractMenuActions.length > 0 ? <ActionMenu items={contractMenuActions} label="إجراءات العقد" /> : null}
          </>
        )}
      />
      <ContractDetailWorkspace contract={contract} settings={companySettings} />
      {renewalAllowed ? (
        <ContractRenewalDialog
          contract={contract}
          open={renewOpen}
          onOpenChange={setRenewOpen}
          onRenewed={async (result) => navigate({ to: '/contracts/$contractId', params: { contractId: result.new_contract_id } })}
        />
      ) : null}
      {extensionAllowed ? <ContractShortStayExtensionDialog contract={contract} open={extendOpen} onOpenChange={setExtendOpen} /> : null}
      {terminationAllowed ? <ContractTerminationDialog contractId={contract.id} open={terminateOpen} onOpenChange={setTerminateOpen} /> : null}
    </PageLayout>
  );
}
