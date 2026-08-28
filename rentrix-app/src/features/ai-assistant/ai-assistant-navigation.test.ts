import { describe, expect, it } from 'vitest';
import {
  buildAiNavigationTargets,
  isAllowedAiNavigationTarget,
  type AiNavigationTarget,
} from './ai-assistant-navigation';
import type { AiAssistantAction } from './types';

const ALL_ACTIONS: readonly AiAssistantAction[] = [
  'summarize_overdue_invoices',
  'summarize_contract_renewals',
  'summarize_vacancy',
  'summarize_month',
  'draft_tenant_payment_reminder',
  'explain_property_financial_snapshot',
];

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
