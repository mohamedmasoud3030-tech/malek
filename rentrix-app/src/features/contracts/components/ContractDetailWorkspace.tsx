import { CalendarClock, FileText, Landmark, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SectionTabPanel, SectionTabs, type SectionTabItem } from '@/components/ui/section-tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { formatContractDate, formatContractMoney } from '../contractDisplayFormatters';
import { ContractDocumentsShell } from '../contractDocumentsShell';
import { ContractPaymentsTab } from '../contractPaymentsTab';
import {
  ContractOverviewSection,
  ContractTimelineSection,
  getExpiryDescription,
} from '../components/ContractDetailSections';
import { ContractEvidenceSection } from '../evidence/ContractEvidenceSection';
import { ContractApprovalSection } from '../lifecycle/contract-approval-workflow';
import { contractStatusLabels, contractStatusTone } from '../contractSchema';
import { normalizeContractStatus } from '@/lib/contractStatus';
import type { ContractDetail } from '../services/contractService';

type ContractDetailTab = 'overview' | 'financials' | 'documents';

const tabs: readonly SectionTabItem<ContractDetailTab>[] = [
  { id: 'overview', label: 'نظرة عامة', icon: UserRound },
  { id: 'financials', label: 'المالية', icon: Landmark },
  { id: 'documents', label: 'المستندات والنشاط', icon: FileText },
];

function ContractMobileSummary({ contract, settings }: Readonly<{ contract: ContractDetail; settings: CompanySettingsContract }>) {
  const status = normalizeContractStatus(contract.status);

  return (
    <Card className="sm:hidden" data-contract-mobile-summary>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{contract.people?.full_name ?? 'مستأجر غير محدد'}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {contract.properties?.title ?? 'عقار غير محدد'} · الوحدة {contract.units?.unit_number ?? '—'}
            </p>
          </div>
          <StatusBadge tone={contractStatusTone[status]}>{contractStatusLabels[status]}</StatusBadge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border/65 bg-muted/20 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground">قيمة الإيجار</p>
            <p className="mt-1 text-sm font-bold tabular-nums">{formatContractMoney(settings, contract.rent_amount)}</p>
          </div>
          <div className="rounded-xl border border-border/65 bg-muted/20 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground">ينتهي في</p>
            <p className="mt-1 text-sm font-bold tabular-nums">{formatContractDate(settings, contract.end_date)}</p>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
          {getExpiryDescription(settings, contract)}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * The shared detail-workspace composition: one mobile summary, one compact
 * tab switcher, and progressive disclosure of specialist contract material.
 */
export function ContractDetailWorkspace({
  contract,
  settings,
}: Readonly<{
  contract: ContractDetail;
  settings: CompanySettingsContract;
}>) {
  const [activeTab, setActiveTab] = useState<ContractDetailTab>('overview');

  return (
    <section className="space-y-3" aria-label="مساحة عمل العقد" data-contract-detail-workspace>
      <ContractMobileSummary contract={contract} settings={settings} />
      <SectionTabs
        items={tabs}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="أقسام العقد"
        compactMobile
      />

      <SectionTabPanel id="overview" activeId={activeTab}>
        <div
          className="grid min-w-0 gap-4 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] xl:items-start"
          data-contract-overview-composition
        >
          <ContractApprovalSection contract={contract} />
          <ContractOverviewSection contract={contract} settings={settings} />
        </div>
      </SectionTabPanel>

      <SectionTabPanel id="financials" activeId={activeTab}>
        <ContractPaymentsTab contractId={contract.id} />
      </SectionTabPanel>

      <SectionTabPanel id="documents" activeId={activeTab}>
        <div className="grid min-w-0 gap-4 xl:grid-cols-2" data-contract-documents-composition>
          <ContractEvidenceSection contractId={contract.id} />
          <ContractDocumentsShell contractId={contract.id} />
          <div className="xl:col-span-2">
            <ContractTimelineSection contract={contract} settings={settings} />
          </div>
        </div>
      </SectionTabPanel>
    </section>
  );
}
