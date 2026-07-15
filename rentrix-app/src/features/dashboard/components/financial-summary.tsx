import { Link } from '@tanstack/react-router';
import { WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/loading-state';
import { StatCard } from '@/components/ui/stat-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface FinancialSummaryProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
}

export function FinancialSummary({ snapshot, isLoading, settings }: FinancialSummaryProps) {
  const money = (v: number | null | undefined) => formatCompanyMoney(settings, v);

  const items = [
    { label: 'المفوتر', value: snapshot?.financial.rentDue, tone: 'default' as const },
    { label: 'المحصّل', value: snapshot?.financial.collectedRent, tone: 'success' as const },
    { label: 'المتبقي', value: snapshot?.financial.outstandingRent, tone: 'warning' as const },
    { label: 'المصروفات', value: snapshot?.financial.expenses, tone: 'danger' as const },
    { label: 'صافي الدخل', value: snapshot?.financial.netPosition, tone: 'info' as const },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold">النظرة المالية للشهر</CardTitle>
          <Link to="/financials">
            <Button variant="secondary" size="sm" className="gap-1">
              <WalletCards className="size-3.5" /> المالية
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState variant="cards" rows={5} label="جارٍ تحميل الملخص المالي" />
        ) : (
          <ResponsiveCardGrid desktopColumns={5} gap="sm">
            {items.map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={money(item.value ?? 0)}
                tone={item.tone}
              />
            ))}
          </ResponsiveCardGrid>
        )}
      </CardContent>
    </Card>
  );
}
