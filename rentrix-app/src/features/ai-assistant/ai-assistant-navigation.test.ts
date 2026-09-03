import { describe, expect, it } from 'vitest';
import { ROUTE_CONTRACT } from '@/app/navigation/route-contract';
import {
  buildAiNavigationTargets,
  isAllowedAiNavigationTarget,
  type AiNavigationTarget,
} from './ai-assistant-navigation';
import type { AiAssistantAction, AiAssistantSurfaceContext } from './types';

const ALL_ACTIONS: readonly AiAssistantAction[] = [
  'summarize_overdue_invoices',
  'summarize_contract_renewals',
  'summarize_vacancy',
  'summarize_month',
  'draft_tenant_payment_reminder',
  'explain_property_financial_snapshot',
  'explain_current_surface',
  'identify_riskiest_overdue_tenants',
  'list_contracts_needing_action_this_week',
  'locate_dormant_funds',
  'list_vacant_units_needing_followup',
  'identify_lowest_performing_properties',
  'list_overdue_or_critical_maintenance',
  'prioritize_office_actions_top5',
  'generate_daily_brief',
  'draft_contract_renewal_followup',
  'draft_maintenance_followup',
  'draft_owner_summary',
  'draft_internal_note',
];

function surface(
  entityType: NonNullable<AiAssistantSurfaceContext['entityType']>,
  entityId: string,
): AiAssistantSurfaceContext {
  return {
    route: `/${entityType}s/${entityId}`,
    entityType,
    entityId,
    entityLabel: null,
    section: entityType === 'property' ? 'properties' : `${entityType}s`,
  };
}

describe('buildAiNavigationTargets', () => {
  it('maps each declared action to the canonical in-app report/workspace', () => {
    expect(buildAiNavigationTargets('summarize_overdue_invoices')).toEqual([
      { label: 'فتح المتأخرات', to: '/reports', search: { section: 'analytics', view: 'overdue' } },
    ]);
    expect(buildAiNavigationTargets('summarize_contract_renewals')[0]?.to).toBe('/contracts');
    expect(buildAiNavigationTargets('summarize_vacancy')[0]).toEqual({
      label: 'فتح الإشغال والشغور',
      to: '/reports',
      search: { section: 'analytics', view: 'occupancy' },
    });
    expect(buildAiNavigationTargets('summarize_month')[0]?.to).toBe('/reports');
    expect(buildAiNavigationTargets('draft_tenant_payment_reminder')[0]?.to).toBe('/communication');
    expect(buildAiNavigationTargets('explain_property_financial_snapshot')[0]?.to).toBe('/reports');
  });

  it('offers only canonical navigation for free-form questions', () => {
    const targets = buildAiNavigationTargets(undefined, { freeform: true });
    expect(targets.map((target) => target.to).sort()).toEqual(['/financials', '/reports']);
  });

  it('returns no targets when no action and no free-form context exists', () => {
    expect(buildAiNavigationTargets(undefined)).toEqual([]);
  });

  it('never derives destinations from model output (closed union only)', () => {
    expect(buildAiNavigationTargets('post_journal' as AiAssistantAction)).toEqual([]);
  });

  it('gives every v3 operational action only canonical route-contract destinations', () => {
    const canonicalRoutes = new Set(ROUTE_CONTRACT.map((entry) => entry.canonical));
    for (const action of ALL_ACTIONS) {
      for (const target of buildAiNavigationTargets(action)) {
        expect(canonicalRoutes.has(target.to), `${action} → ${target.to} must be a canonical MALEK route`).toBe(true);
        expect(isAllowedAiNavigationTarget(target)).toBe(true);
      }
    }
  });

  it('routes the new operational actions to their owning workspaces', () => {
    expect(buildAiNavigationTargets('list_overdue_or_critical_maintenance')[0]?.to).toBe('/maintenance');
    expect(buildAiNavigationTargets('locate_dormant_funds')[0]?.to).toBe('/financials');
    expect(buildAiNavigationTargets('generate_daily_brief')[0]?.to).toBe('/dashboard');
    expect(buildAiNavigationTargets('prioritize_office_actions_top5')[0]?.to).toBe('/dashboard');
    expect(buildAiNavigationTargets('identify_riskiest_overdue_tenants').map((target) => target.to)).toContain('/reports');
    expect(buildAiNavigationTargets('list_vacant_units_needing_followup').map((target) => target.to)).toContain('/properties');
    expect(buildAiNavigationTargets('draft_owner_summary')[0]?.to).toBe('/owners');
    expect(buildAiNavigationTargets('draft_maintenance_followup').map((target) => target.to)).toContain('/communication');
  });

  it('adds the verified current record and useful owning workspaces for explain-current-surface', () => {
    const contractTargets = buildAiNavigationTargets('explain_current_surface', {
      freeform: false,
      surface: surface('contract', 'contract-123'),
    });
    expect(contractTargets.map((target) => target.to)).toEqual([
      '/contracts/contract-123',
      '/reports',
      '/communication',
    ]);
    expect(contractTargets.every(isAllowedAiNavigationTarget)).toBe(true);

    const ownerTargets = buildAiNavigationTargets('explain_current_surface', {
      freeform: false,
      surface: surface('owner', 'owner-123'),
    });
    expect(ownerTargets.map((target) => target.to)).toEqual([
      '/owners/owner-123',
      '/owner-settlements',
      '/reports',
    ]);
    expect(ownerTargets.every(isAllowedAiNavigationTarget)).toBe(true);
  });

  it('rejects unsafe ids instead of constructing a detail link', () => {
    const targets = buildAiNavigationTargets('explain_current_surface', {
      freeform: false,
      surface: surface('owner', 'owner;delete'),
    });
    expect(targets.some((target) => target.to.startsWith('/owners/'))).toBe(false);
  });
});

describe('isAllowedAiNavigationTarget', () => {
  it('accepts every deterministic target produced by the builder', () => {
    for (const action of ALL_ACTIONS) {
      for (const target of buildAiNavigationTargets(action)) {
        expect(isAllowedAiNavigationTarget(target)).toBe(true);
      }
    }
  });

  it('rejects raw URLs, mutation paths, and external/contact schemes', () => {
    const rejected: AiNavigationTarget[] = [
      { label: 'x', to: 'https://evil.example' },
      { label: 'x', to: 'mailto:tenant@example.com' },
      { label: 'x', to: 'tel:+96891234567' },
      { label: 'x', to: 'https://wa.me/96891234567' },
      { label: 'x', to: '/invoices/update' },
      { label: 'x', to: '/financials/.from(invoices).insert()' },
    ];
    for (const target of rejected) {
      expect(isAllowedAiNavigationTarget(target)).toBe(false);
    }
  });
});
