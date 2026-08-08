/** Canonical route-to-primary-navigation-root map. */
export const routeNavRoot = new Map<string, string>([
  ['/dashboard', '/dashboard'],
  ['/', '/dashboard'],

  ['/properties', '/properties'],
  ['/properties/new', '/properties'],
  ['/properties/$propertyId', '/properties'],
  ['/properties/$propertyId/edit', '/properties'],
  ['/properties/$propertyId/units', '/properties'],
  ['/properties/$propertyId/units/$unitId', '/properties'],
  ['/units', '/properties'],
  ['/lands', '/properties'],

  ['/owners', '/owners'],
  ['/owners/$ownerId', '/owners'],

  ['/tenants', '/tenants'],

  ['/contracts', '/contracts'],
  ['/contracts/new', '/contracts'],
  ['/contracts/$contractId', '/contracts'],
  ['/contracts/$contractId/edit', '/contracts'],
  ['/people', '/contracts'],
  ['/people/new', '/contracts'],
  ['/people/$personId/edit', '/contracts'],
  ['/leads', '/contracts'],
  ['/communication', '/contracts'],

  ['/maintenance', '/maintenance'],
  ['/utilities', '/maintenance'],
  ['/automation', '/maintenance'],
  ['/documents-vault', '/maintenance'],

  // Finance has one primary destination. The operational subroutes stay valid
  // but must keep the single Finance item highlighted.
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

  // Accounting and reports are one primary destination. /accounting remains a
  // compatibility deep-link into the general-ledger report section.
  ['/reports', '/reports'],
  ['/accounting', '/reports'],
  ['/ai-assistant', '/ai-assistant'],

  ['/settings', '/settings'],
  ['/change-password', '/settings'],
  ['/audit-log', '/settings'],
  ['/data-integrity', '/settings'],
  ['/system', '/settings'],
]);

export const navRootTitle: Record<string, string> = {
  '/dashboard': 'لوحة التحكم',
  '/properties': 'العقارات',
  '/owners': 'الملاك',
  '/tenants': 'المستأجرون',
  '/contracts': 'العقود',
  '/maintenance': 'التشغيل والصيانة',
  '/financials': 'المالية',
  '/reports': 'المحاسبة والتقارير',
  '/ai-assistant': 'المساعد الذكي',
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
