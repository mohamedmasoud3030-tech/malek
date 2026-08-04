/**
 * Canonical route-to-navigation-root map.
 *
 * Every protected route must map to exactly one navigation root. This map is
 * the single source of truth for:
 *  - desktop sidebar active state
 *  - mobile drawer active state
 *  - bottom mobile navigation active state
 *  - workspace sub-nav context
 *  - breadcrumb root
 *  - aria-current resolution
 *  - page-title lookup
 *
 * UX-013 / UX-015 / UX-069: active navigation state and terminology source.
 */

/** The primary navigation root each route belongs to. */
export const routeNavRoot = new Map<string, string>([
  // Dashboard
  ['/dashboard', '/dashboard'],
  ['/', '/dashboard'],

  // Portfolio hub & children
  ['/properties', '/properties'],
  ['/properties/new', '/properties'],
  ['/properties/$propertyId', '/properties'],
  ['/properties/$propertyId/edit', '/properties'],
  ['/properties/$propertyId/units', '/properties'],
  ['/properties/$propertyId/units/$unitId', '/properties'],
  ['/owners', '/properties'],
  ['/owners/$ownerId', '/properties'],
  ['/units', '/properties'],
  ['/lands', '/properties'],

  // Relationships / Contracts hub & children
  ['/contracts', '/contracts'],
  ['/contracts/new', '/contracts'],
  ['/contracts/$contractId', '/contracts'],
  ['/contracts/$contractId/edit', '/contracts'],
  ['/people', '/contracts'],
  ['/people/new', '/contracts'],
  ['/people/$personId/edit', '/contracts'],
  ['/tenants', '/contracts'],
  ['/leads', '/contracts'],
  ['/communication', '/contracts'],

  // Operations hub & children
  ['/maintenance', '/maintenance'],
  ['/utilities', '/maintenance'],
  ['/automation', '/maintenance'],
  ['/documents-vault', '/maintenance'],

  // Finance hub & children
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

  // Reports hub
  ['/reports', '/reports'],
  ['/ai-assistant', '/reports'],

  // Governance / Settings hub & children
  ['/settings', '/settings'],
  ['/change-password', '/settings'],
  ['/audit-log', '/settings'],
  ['/data-integrity', '/settings'],
  ['/system', '/settings'],
]);

/** Arabic display name for each navigation root. */
export const navRootTitle: Record<string, string> = {
  '/dashboard': 'لوحة التحكم',
  '/properties': 'المحفظة العقارية',
  '/contracts': 'العلاقات والعقود',
  '/maintenance': 'التشغيل والصيانة',
  '/financials': 'المالية',
  '/reports': 'التقارير',
  '/settings': 'الإدارة والحوكمة',
};

/**
 * Given any route pathname, returns the canonical navigation root.
 * Falls back to '/dashboard' for unknown routes.
 */
export function getNavRoot(pathname: string): string {
  // Exact match first
  if (routeNavRoot.has(pathname)) return routeNavRoot.get(pathname)!;

  // Try longest-prefix match (for nested routes not explicitly mapped)
  const sortedKeys = [...routeNavRoot.keys()].sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (pathname.startsWith(key + '/') || pathname === key) {
      return routeNavRoot.get(key)!;
    }
  }

  return '/dashboard';
}
