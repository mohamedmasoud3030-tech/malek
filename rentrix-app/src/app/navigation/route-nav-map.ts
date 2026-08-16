/** Canonical route-to-primary-navigation-root map. */
export const routeNavRoot = new Map<string, string>([
  ['/dashboard', '/dashboard'],
  ['/', '/dashboard'],

  // Portfolio owns managed assets and ownership context.
  ['/properties', '/properties'],
  ['/properties/new', '/properties'],
  ['/properties/$propertyId', '/properties'],
  ['/properties/$propertyId/edit', '/properties'],
  ['/properties/$propertyId/units', '/properties'],
  ['/properties/$propertyId/units/$unitId', '/properties'],
  ['/units', '/properties'],
  ['/lands', '/properties'],
  ['/lands/$landId', '/properties'],
  ['/owners', '/properties'],
  ['/owners/$ownerId', '/properties'],
  ['/owners/$ownerId/edit', '/properties'],

  // Leasing owns tenant/party relationship workflows around contracts.
  ['/contracts', '/contracts'],
  ['/contracts/new', '/contracts'],
  ['/contracts/$contractId', '/contracts'],
  ['/contracts/$contractId/edit', '/contracts'],
  ['/tenants', '/contracts'],
  ['/tenants/$tenantId', '/contracts'],
  ['/people', '/contracts'],
  ['/people/$personId', '/contracts'],
  ['/people/new', '/contracts'],
  ['/people/$personId/edit', '/contracts'],
  ['/leads', '/contracts'],
  ['/communication', '/contracts'],

  // Services owns operational work and its supporting records.
  ['/maintenance', '/maintenance'],
  ['/service-providers', '/maintenance'],
  ['/service-providers/new', '/maintenance'],
  ['/service-providers/$providerId', '/maintenance'],
  ['/service-providers/$providerId/edit', '/maintenance'],
  ['/utilities', '/maintenance'],
  ['/documents-vault', '/maintenance'],

  ['/automation', '/settings'],

  // Money is one operational financial destination. Detailed registers remain
  // addressable, but they never become competing global navigation roots.
  ['/financials', '/financials'],
  ['/finance/collections', '/financials'],
  ['/finance/expenses', '/financials'],
  ['/finance/deposits', '/financials'],
  ['/finance/banking', '/financials'],
  ['/invoices', '/financials'],
  ['/receipts', '/financials'],
  ['/expenses', '/financials'],
  ['/arrears', '/financials'],
  ['/deposits', '/financials'],
  ['/owner-settlements', '/financials'],
  ['/bank-reconciliation', '/financials'],
  ['/commissions', '/financials'],

  // Reports stays independent from day-to-day money operations.
  ['/reports', '/reports'],
  ['/accounting', '/reports'],
  ['/ai-assistant', '/dashboard'],

  ['/settings', '/settings'],
  ['/change-password', '/settings'],
  ['/audit-log', '/settings'],
  ['/data-integrity', '/settings'],
  ['/system', '/settings'],
]);

export const navRootTitle: Record<string, string> = {
  '/dashboard': 'اليوم',
  '/properties': 'المحفظة',
  '/contracts': 'التأجير',
  '/financials': 'المال',
  '/maintenance': 'الخدمات',
  '/reports': 'التقارير',
  '/settings': 'الإعدادات',
};

export function getNavRoot(pathname: string): string {
  if (routeNavRoot.has(pathname)) return routeNavRoot.get(pathname)!;

  const sortedKeys = [...routeNavRoot.keys()].sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (pathname.startsWith(key + '/') || pathname === key) {
      return routeNavRoot.get(key)!;
    }
  }

  return '/dashboard';
}
