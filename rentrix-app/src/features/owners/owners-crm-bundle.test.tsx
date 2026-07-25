import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { canAccess, canShowNavigationItem, getAuthorizationContextFromUser } from '@/features/auth/permissions';
import { navGroups, type NavItem } from '@/app/navigation/app-nav-items';
import { CommissionsView } from '@/features/commissions/components/commissions-view';
import { CommunicationHubView } from '@/features/communication/components/communication-hub-view';
import { LandsView } from '@/features/lands/components/lands-view';
import { LeadsView } from '@/features/leads/components/leads-view';

const sourceRoot = fileURLToPath(new URL('../..', import.meta.url));
const forbiddenNamePieces = [
  ['App', 'Context'],
  ['use', 'App'],
  ['react-router', '-dom'],
] as const;
const destructiveCalls = ['.delete(', '.rpc('] as const;

function userWithRole(role: unknown) {
  return { id: 'user-1', email: 'user@example.com', app_metadata: { user_role: role } };
}

function readFeatureSources(relativePath: string): string {
  const absolutePath = join(sourceRoot, relativePath);
  if (!statSync(absolutePath).isDirectory()) return readFileSync(absolutePath, 'utf8');

  const entries = readdirSync(absolutePath).flatMap((entry) => {
    const entryPath = join(absolutePath, entry);
    if (statSync(entryPath).isDirectory()) return readFeatureSources(join(relativePath, entry));
    return entry.endsWith('.ts') || entry.endsWith('.tsx') ? readFileSync(entryPath, 'utf8') : '';
  });

  return entries.join('\n');
}

describe('Owners and CRM route authorization', () => {
  it('allows admin and manager CRM read access while denying regular users', () => {
    const admin = getAuthorizationContextFromUser(userWithRole('ADMIN'));
    const manager = getAuthorizationContextFromUser(userWithRole('MANAGER'));
    const user = getAuthorizationContextFromUser(userWithRole('USER'));

    expect(canAccess(admin, 'owners.hub.view')).toBe(true);
    expect(canAccess(manager, 'communication.view')).toBe(true);
    expect(canAccess(user, 'lands.view')).toBe(false);
  });

  it('fails closed for missing and unknown role claims', () => {
    expect(getAuthorizationContextFromUser(userWithRole(undefined))).toBeNull();
    expect(getAuthorizationContextFromUser(userWithRole('OWNER'))).toBeNull();
    expect(canAccess(null, 'owners.hub.view')).toBe(false);
  });
});

describe('Owners and CRM navigation visibility', () => {
  it('exposes approved CRM and operations modules to managers while hiding them from regular users', () => {
    const manager = getAuthorizationContextFromUser(userWithRole('MANAGER'));
    const user = getAuthorizationContextFromUser(userWithRole('USER'));
    const allNavItems: NavItem[] = [];
    for (const [, items] of navGroups) {
      allNavItems.push(...items);
    }
    const crmNavItems = allNavItems.filter(([, labelKey]) => ['owners', 'ownersHub', 'lands', 'leads', 'commissions', 'communication'].includes(labelKey));
    const crmNavKeys = crmNavItems.map(([, labelKey]) => labelKey);

    expect(crmNavKeys).toEqual(expect.arrayContaining(['owners', 'lands', 'leads', 'commissions', 'communication']));
    expect(crmNavItems.every(([, , , , permission]) => canShowNavigationItem(manager, permission))).toBe(true);
    expect(crmNavItems.every(([, , , , permission]) => !canShowNavigationItem(user, permission))).toBe(true);
  });
});

describe('Approved CRM module views', () => {
  it('renders lands as a working module with create action', () => {
    const html = renderToStaticMarkup(<LandsView rows={[]} filters={{ query: '', status: 'all' }} draft={{ plot_no: '', name: '', location: '', area: '', owner_id: '', purchase_price: '', owner_price: '', commission: '', category: 'residential', status: 'available', notes: '' }} editingLand={null} formOpen={false} isLoading={false} isSaving={false} isArchiving={false} error={null} writeError={null} onFiltersChange={() => undefined} onDraftChange={() => undefined} onCreate={() => undefined} onEdit={() => undefined} onFormOpenChange={() => undefined} onSubmit={() => undefined} onArchive={() => undefined} onRetry={() => undefined} />);

    expect(html).toContain('إضافة سجل أرض');
    expect(html).not.toContain('غير متاح');
  });

  it('renders leads as a working module without invented provider behavior', () => {
    const html = renderToStaticMarkup(<LeadsView rows={[]} filters={{ query: '', status: 'all', source: 'all' }} draft={{ name: '', phone: '', email: '', source: 'walk_in', status: 'new', desired_unit_type: '', min_budget: '', max_budget: '', notes: '' }} editingLead={null} formOpen={false} isLoading={false} isSaving={false} isArchiving={false} error={null} writeError={null} onFiltersChange={() => undefined} onDraftChange={() => undefined} onCreate={() => undefined} onEdit={() => undefined} onFormOpenChange={() => undefined} onSubmit={() => undefined} onArchive={() => undefined} onRetry={() => undefined} />);

    expect(html).toContain('إضافة عميل محتمل');
    expect(html).not.toContain('pipeline');
  });

  it('renders commissions without settlement or ledger behavior', () => {
    const html = renderToStaticMarkup(<CommissionsView rows={[]} filters={{ query: '', status: 'all', type: 'all' }} draft={{ staff_name: '', type: 'contract', status: 'pending', source_id: '', deal_value: '', percentage: '2.5', amount: '' }} editingCommission={null} formOpen={false} isLoading={false} isSaving={false} isArchiving={false} error={null} writeError={null} onFiltersChange={() => undefined} onDraftChange={() => undefined} onCreate={() => undefined} onEdit={() => undefined} onFormOpenChange={() => undefined} onSubmit={() => undefined} onArchive={() => undefined} onRetry={() => undefined} />);

    expect(html).toContain('إضافة عمولة');
    expect(html).not.toContain('تسوية');
    expect(html).not.toContain('دفتر أستاذ عام');
  });

  it('renders communication as an internal log without external sends', () => {
    const html = renderToStaticMarkup(<CommunicationHubView rows={[]} filters={{ query: '', channel: 'all', status: 'all' }} draft={{ contact_name: '', contact_phone: '', contact_email: '', channel: 'phone', direction: 'outbound', status: 'logged', subject: '', body: '', related_entity_type: '', related_entity_id: '' }} editingRecord={null} formOpen={false} isLoading={false} isSaving={false} isArchiving={false} error={null} writeError={null} onFiltersChange={() => undefined} onDraftChange={() => undefined} onCreate={() => undefined} onEdit={() => undefined} onFormOpenChange={() => undefined} onSubmit={() => undefined} onArchive={() => undefined} onRetry={() => undefined} />);

    expect(html).toContain('سجل تشغيلي');
    expect(html).not.toContain('WhatsApp');
  });
});

describe('Owners and CRM source safety', () => {
  it('does not reintroduce historical app context or router dependencies', () => {
    const source = ['owners', 'lands', 'leads', 'commissions', 'communication']
      .map((feature) => readFeatureSources(`features/${feature}`))
      .join('\n');

    for (const [left, right] of forbiddenNamePieces) {
      expect(source).not.toContain(`${left}${right}`);
    }
  });

  it('preserves verified writes without destructive deletes or RPC provider sends in expansion modules', () => {
    const ownerManagementSource = readFeatureSources('features/owners/services/owner-service.ts');
    const expansionSource = [
      'features/owners/owner-detail-page.tsx',
      'features/owners/components/owner-detail-view.tsx',
      'features/lands',
      'features/leads',
      'features/commissions',
      'features/communication',
    ].map(readFeatureSources).join('\n');

    expect(ownerManagementSource).toContain('.insert(');
    expect(ownerManagementSource).toContain('.update(');
    expect(ownerManagementSource).not.toContain('.delete(');
    expect(expansionSource).toContain('.insert(');
    expect(expansionSource).toContain('.update(');
    for (const destructiveCall of destructiveCalls) {
      expect(expansionSource).not.toContain(destructiveCall);
    }
    expect(expansionSource).not.toContain('sendMessage');
  });
});
