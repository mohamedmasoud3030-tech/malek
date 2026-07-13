import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Edit, MessageCircle, Printer, RefreshCw, Share2, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { AsyncContentState } from '@/components/async-content-state';
import { EntityDetailHeader } from '@/components/layout/entity-detail-header';
import { PageLayout } from '@/components/layout/page-layout';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { buildContractActions } from '@/components/ui/entity-action-presets';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { exportContractPdf, openContractWhatsApp, printContractView, shareContractLink } from '../actions/contractDetailActions';
import { ContractDocumentsShell } from '../contractDocumentsShell';
import { ContractPaymentsTab } from '../contractPaymentsTab';
import { ContractFinancialTimelineSection, ContractLifecycleSection, ContractOverviewSection, ContractTimelineSection } from '../components/ContractDetailSections';
import { ContractRenewalDialog } from '../lifecycle/ContractRenewalDialog';
import { ContractTerminationDialog } from '../lifecycle/ContractTerminationDialog';
import { canRenewContract, canTerminateContract } from '../lifecycle/contractLifecycleRules';
import { useContract } from '../useContracts';

const getContractDetailErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء تحميل العقد.';

export function ContractDetailPage() {
  const { contractId } = useParams({ strict: false }) as { contractId: string };
  const navigate = useNavigate();
  const contractQuery = useContract(contractId);
  const companySettings = useCompanySettingsContract();
  const [renewOpen, setRenewOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);

  if (contractQuery.isLoading || contractQuery.isError || !contractQuery.data) {
    return <AsyncContentState status={contractQuery.isLoading ? 'loading' : contractQuery.isError ? 'error' : 'empty'} error={contractQuery.error} errorTitle="تعذر تحميل العقد" errorFallbackMessage={getContractDetailErrorMessage(contractQuery.error)} errorAction={<Button onClick={() => void contractQuery.refetch()}>إعادة المحاولة</Button>} emptyTitle="العقد غير موجود" emptyDescription="ربما تم حذف العقد أو لا تملك صلاحية الوصول إليه.">{null}</AsyncContentState>;
  }

  const contract = contractQuery.data;
  const renewalAllowed = canRenewContract(contract);
  const terminationAllowed = canTerminateContract(contract);
  const openRenewal = () => setRenewOpen(true);
  const openTermination = () => setTerminateOpen(true);
  const contractMenuActions = buildContractActions({
    onPrint: printContractView,
    onPdf: () => exportContractPdf(contract, companySettings),
    onWhatsApp: () => openContractWhatsApp(contract),
    onShare: () => { void shareContractLink(contract); },
    onRenew: renewalAllowed ? openRenewal : undefined,
    onTerminate: terminationAllowed ? openTermination : undefined,
  });

  return <PageLayout dir="rtl" size="wide"><EntityDetailHeader title="تفاصيل العقد" subtitle={`العقد رقم #${contract.id.slice(0, 8)} — عرض كامل للعقد وسجل مراحله.`} backTo="/contracts" actions={<><Button variant="secondary" className="hidden sm:inline-flex" disabled={!renewalAllowed} onClick={openRenewal}><RefreshCw className="me-2 size-4" />تجديد</Button>{terminationAllowed && <Button variant="destructive" className="hidden sm:inline-flex" onClick={openTermination}><ShieldAlert className="me-2 size-4" />إنهاء العقد</Button>}<Button variant="secondary" className="hidden md:inline-flex" onClick={printContractView}><Printer className="me-2 size-4" />طباعة</Button><Button variant="secondary" className="hidden md:inline-flex" onClick={() => exportContractPdf(contract, companySettings)}>تصدير PDF</Button><Button variant="secondary" className="hidden lg:inline-flex" onClick={() => openContractWhatsApp(contract)}><MessageCircle className="me-2 size-4" />واتساب</Button><Button variant="secondary" className="hidden lg:inline-flex" onClick={() => { void shareContractLink(contract); }}><Share2 className="me-2 size-4" />مشاركة</Button><ActionMenu items={contractMenuActions} label="إجراءات العقد" /><Button asChild><Link to="/contracts/$contractId/edit" params={{ contractId }}><Edit className="me-2 size-4" />تعديل</Link></Button></>} />
    <ContractOverviewSection contract={contract} settings={companySettings} />
    <ContractLifecycleSection contract={contract} settings={companySettings} renewalAllowed={renewalAllowed} onRenew={openRenewal} canTerminate={terminationAllowed} onTerminate={openTermination} />
    <ContractPaymentsTab contractId={contract.id} />
    <ContractFinancialTimelineSection contract={contract} settings={companySettings} />
    <ContractTimelineSection contract={contract} settings={companySettings} />
    <ContractDocumentsShell contractId={contract.id} />
    <ContractRenewalDialog contract={contract} open={renewOpen} onOpenChange={setRenewOpen} onRenewed={async (result) => navigate({ to: '/contracts/$contractId', params: { contractId: result.new_contract_id } })} />
    <ContractTerminationDialog contractId={contract.id} open={terminateOpen} onOpenChange={setTerminateOpen} />
  </PageLayout>;
}
