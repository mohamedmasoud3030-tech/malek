import type { CompanySettingsContract } from '@/lib/companySettings';
import type { DashboardSnapshot } from '../dashboard-snapshot';

interface HeroBannerProps {
  snapshot: DashboardSnapshot | undefined;
  isLoading: boolean;
  settings: CompanySettingsContract;
  today: string;
  isRefreshing?: boolean;
  lastUpdatedAt?: number;
  onRefresh?: () => void;
}

/**
 * Compatibility boundary retained while the dashboard call site is phased out.
 *
 * The old dashboard-only date / freshness / overflow card was intentionally
 * removed. Day + date now live in the shared PageLayout context strip so the
 * same compact, stable context is present across operational pages without a
 * duplicate dashboard card, refresh badge, or overflow menu.
 */
export function HeroBanner(_props: HeroBannerProps) {
  return null;
}
