/**
 * AI Assistant navigation contract — P4 Intelligence.
 *
 * The assistant may navigate to the canonical workspace that answers the
 * operator's question, but it is never accounting authority and never mutates
 * anything. Navigation targets are deterministic and action-based only.
 */

import type { AiAssistantAction } from './types';

export type AiNavigationTarget = Readonly<{
  label: string;
  to: string;
  search?: Readonly<Record<string, string>>;
}>;

export type AiNavigationContext = Readonly<{
  /** True for free-form questions without a declared action. */
  freeform: boolean;
}>;

const NAVIGATION_BY_ACTION: Readonly<Record<AiAssistantAction, readonly AiNavigationTarget[]>> = {
  summarize_overdue_invoices: [
    {
      label: 'فتح المتأخرات',
      to: '/reports',
      search: { section: 'analytics', view: 'overdue' },
    },
  ],
  summarize_contract_renewals: [
    {
      label: 'فتح العقود',
      to: '/contracts',
    },
  ],
  summarize_vacancy: [
    {
      label: 'فتح الإشغال والشغور',
      to: '/reports',
      search: { section: 'analytics', view: 'occupancy' },
    },
  ],
  summarize_month: [
    {
      label: 'فتح أداء المكتب',
      to: '/reports',
      search: { section: 'analytics', view: 'overview' },
    },
  ],
  draft_tenant_payment_reminder: [
    {
      label: 'فتح مركز التواصل',
      to: '/communication',
    },
  ],
  explain_property_financial_snapshot: [
    {
      label: 'فتح أداء المكتب',
      to: '/reports',
      search: { section: 'analytics', view: 'overview' },
    },
  ],
};

const FREEFORM_NAVIGATION_TARGETS: readonly AiNavigationTarget[] = [
  { label: 'فتح التقارير', to: '/reports' },
  { label: 'فتح العمليات المالية', to: '/financials' },
];

const ALLOWED_NAVIGATION_ROUTES: ReadonlySet<string> = new Set([
  '/reports',
  '/contracts',
  '/communication',
  '/financials',
]);

export function buildAiNavigationTargets(
  action: AiAssistantAction | undefined,
  context?: AiNavigationContext,
): readonly AiNavigationTarget[] {
  const targets =
    action && action in NAVIGATION_BY_ACTION
      ? NAVIGATION_BY_ACTION[action]
      : context?.freeform
        ? FREEFORM_NAVIGATION_TARGETS
        : [];
  return targets.filter((target) => ALLOWED_NAVIGATION_ROUTES.has(target.to));
}

export const FORBIDDEN_NAVIGATION_PATTERNS = [
  /^https?:/i,
  /\.(insert|update|delete|upsert)\(/i,
  /mailto:/i,
  /tel:/i,
  /wa\.me/i,
] as const;

export function isAllowedAiNavigationTarget(target: AiNavigationTarget): boolean {
  if (!ALLOWED_NAVIGATION_ROUTES.has(target.to)) return false;
  const serialized = JSON.stringify(target);
  return FORBIDDEN_NAVIGATION_PATTERNS.every((pattern) => !pattern.test(serialized));
}
