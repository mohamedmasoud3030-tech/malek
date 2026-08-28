import { Link } from '@tanstack/react-router';
import { HandCoins } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface OwnerObligationsSectionProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

/** Owner funds are a liability/settlement signal, never office profit. */
export function OwnerObligationsSection({ snapshot, isLoading, settings }: OwnerObligationsSectionProps) {
  const payable = snapshot?.ownerFunds.netPayable ?? 0;
  const drafts = snapshot?.ownerFunds.settlementsDraft ?? 0;
  const approved = snapshot?.ownerFunds.settlementsApproved ?? 0;
  const pending = drafts + approved;

  return (
    <Link
      to="/owner-settlements"
      data-dashboard-owner-obligations-link
      className="block max-w-xl rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label="مستحقات الملاك — انتقل إلى تسويات الملاك"
    >
      <KpiCard
        label="مستحقات الملاك"
        value={isLoading ? 'جارٍ التحميل' : formatCompanyMoney(settings, payable)}
        sub={isLoading ? 'نحمّل الالتزامات الحالية' : pending > 0 ? `${pending} تسوية بانتظار الاعتماد أو الصرف` : 'لا توجد تسويات معلقة'}
        icon={HandCoins}
        accent={pending > 0 ? 'amber' : payable > 0 ? 'sky' : 'slate'}
        className="h-full"
      />
    </Link>
  );
}
