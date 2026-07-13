import type { useCompanyFormatters } from '@/hooks/useCompanyFormatters';
import type { DashboardSnapshot } from '../dashboardSnapshot';

export type DashboardSummaryCard = {
  title: string;
  value: string | number;
  isMoney: boolean;
};

type CompanyFormatters = ReturnType<typeof useCompanyFormatters>;

export function buildDashboardSummaryCards(
  snapshot: DashboardSnapshot | undefined,
  settings: CompanyFormatters,
): DashboardSummaryCard[] {
  const { money } = settings;
  const financial = snapshot?.financial;
  const operational = snapshot?.operational;

  return [
    { title: 'الإيجار المستحق', value: money(financial?.rentDue ?? 0), isMoney: true },
    { title: 'المحصل هذا الشهر', value: money(financial?.collectedRent ?? 0), isMoney: true },
    { title: 'الرصيد المتبقي', value: money(financial?.outstandingRent ?? 0), isMoney: true },
    { title: 'المصروفات', value: money(financial?.expenses ?? 0), isMoney: true },
    { title: 'المحصل بعد المصروفات', value: money(financial?.netPosition ?? 0), isMoney: true },
    { title: 'الإشغال', value: `${operational?.occupancyRate ?? 0}%`, isMoney: false },
    { title: 'تنتهي خلال 30 يوم', value: operational?.expiringContracts30Days ?? 0, isMoney: false },
  ];
}
