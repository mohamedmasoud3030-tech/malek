import { Building2, CalendarCheck2, HandCoins, WalletCards } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { LoadingState } from '@/components/ui/loading-state';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface OfficePulseProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

/**
 * Four stable executive slots. Values stay visible even when they are zero so
 * the dashboard does not visually jump between periods or offices.
 */
export function OfficePulse({ snapshot, isLoading, settings }: OfficePulseProps) {
  if (isLoading) {
    return <LoadingState variant="cards" rows={4} label="جارٍ تحميل نبض المكتب" />;
  }

  const collected = snapshot?.collections.collectedAmount ?? 0;
  const outstanding = snapshot?.collections.outstandingAmount ?? 0;
  const occupancyRate = snapshot?.occupancy.occupancyRate ?? 0;
  const activeContracts = snapshot?.contracts.active ?? 0;

  return (
    <div data-dashboard-office-pulse>
      <ResponsiveCardGrid gap="sm" aria-label="نبض المكتب">
        <KpiCard
          label="التحصيل هذا الشهر"
          value={formatCompanyMoney(settings, collected)}
          sub="المبالغ المحصلة ضمن الفترة الحالية"
          icon={HandCoins}
          accent="emerald"
          compact
        />
        <KpiCard
          label="المتبقي للتحصيل"
          value={formatCompanyMoney(settings, outstanding)}
          sub="المبالغ المستحقة غير المحصلة بعد"
          icon={WalletCards}
          accent={outstanding > 0 ? 'amber' : 'slate'}
          compact
        />
        <KpiCard
          label="نسبة الإشغال"
          value={`${occupancyRate}%`}
          sub="الوحدات المشغولة من إجمالي المحفظة"
          icon={Building2}
          accent={occupancyRate >= 90 ? 'emerald' : occupancyRate >= 70 ? 'sky' : 'amber'}
          compact
        />
        <KpiCard
          label="العقود النشطة"
          value={activeContracts}
          sub="العقود السارية حالياً"
          icon={CalendarCheck2}
          accent="sky"
          compact
        />
      </ResponsiveCardGrid>
    </div>
  );
}
