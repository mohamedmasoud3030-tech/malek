import { Link, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/hooks/use-auth';
import { canShowNavigationItem } from '@/features/auth/permissions';
import { workspaceChildNavItems } from '@/app/navigation/app-nav-items';
import { getNavRoot } from '@/app/navigation/route-nav-map';
import { workspaceLabels } from '@/app/navigation/terminology-registry';

export interface WorkspaceSubNavProps {
  rootPath: string;
  className?: string;
}

/**
 * Maps a child nav path to the hub `?section=` id used after consolidation.
 * Child routes now redirect into the hub, so active state must also match
 * the section search param when the user is already on the hub root.
 */
const pathToSectionId: Record<string, string> = {
  '/owners': 'owners',
  '/units': 'units',
  '/lands': 'lands',
  '/people': 'people',
  '/tenants': 'tenants',
  '/leads': 'leads',
  '/communication': 'communication',
  '/utilities': 'utilities',
  '/automation': 'automation',
  '/documents-vault': 'documents_vault',
  '/invoices': 'invoices',
  '/receipts': 'receipts',
  '/expenses': 'expenses',
  '/arrears': 'arrears',
  '/deposits': 'deposits',
  '/owner-settlements': 'owner_settlements',
  '/bank-reconciliation': 'bank_reconciliation',
  '/commissions': 'commissions',
};

function readSectionParam(search: unknown): string | null {
  if (search && typeof search === 'object' && 'section' in search) {
    const value = (search as { section?: unknown }).section;
    return typeof value === 'string' ? value : null;
  }
  if (typeof search === 'string' && search.length > 0) {
    const normalized = search.startsWith('?') ? search.slice(1) : search;
    return new URLSearchParams(normalized).get('section');
  }
  return null;
}

/**
 * Secondary workspace navigation bar displaying child destinations for a top-level hub.
 * Preserves all routes, deep links, and permissions without cluttering the main sidebar.
 *
 * Mobile behaviour matches SectionTabs: horizontal scroll with hidden scrollbars
 * and min-h-10 touch targets — no overflow menu pattern.
 */
export function WorkspaceSubNav({ rootPath, className = '' }: WorkspaceSubNavProps) {
  const { authorization } = useAuth();
  const location = useLocation();
  const items = workspaceChildNavItems[rootPath] ?? [];
  const sectionParam = readSectionParam(location.search);

  const visibleItems = items.filter((item) =>
    canShowNavigationItem(authorization, item[4]),
  );

  if (visibleItems.length === 0) {
    return null;
  }

  const isOnHubRoot = location.pathname === rootPath;
  // Highlight "hub home" only when no child section is selected.
  const hubHomeActive = isOnHubRoot && !sectionParam;

  return (
    <nav
      className={`no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-border pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      aria-label="التنقل الداخلي لمساحة العمل"
    >
      <Link
        to={rootPath}
        aria-current={hubHomeActive ? 'page' : undefined}
        className={`min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
          hubHomeActive
            ? 'border border-primary/20 bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        الرئيسية للمساحة
      </Link>
      {visibleItems.map(([to, , description, Icon]) => {
        const sectionId = pathToSectionId[to];
        const activeByPath = location.pathname === to || location.pathname.startsWith(`${to}/`);
        const activeBySection = Boolean(sectionId && isOnHubRoot && sectionParam === sectionId);
        const active = activeByPath || activeBySection;
        // UX-015: Use canonical workspace labels instead of description.split(' ')[0]
        const shortLabel = sectionId && workspaceLabels[sectionId]
          ? workspaceLabels[sectionId]
          : description;

        return (
          <Link
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
              active
                ? 'border border-primary/20 bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
