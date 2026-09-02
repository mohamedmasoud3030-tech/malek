/**
 * AI Assistant navigation contract — P4 Intelligence.
 *
 * The assistant may navigate to the canonical workspace that answers the
 * operator's question, but it is never accounting authority and never mutates
 * anything. Navigation targets are deterministic and action-based only.
 *
 * Every destination must exist in the canonical route contract
 * (src/app/navigation/route-contract.ts); nothing here is model-generated.
 */

import { ROUTE_CONTRACT } from '@/app/navigation/route-contract';
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

const OVERDUE_REPORT: AiNavigationTarget = {
  label: 'فتح المتأخرات',
  to: '/reports',
  search: { section: 'analytics', view: 'overdue' },
};
const CONTRACTS_WORKSPACE: AiNavigationTarget = { label: 'فتح العقود', to: '/contracts' };
const OFFICE_PERFORMANCE: AiNavigationTarget = {
  label: 'فتح أداء المكتب',
  to: '/reports',
  search: { section: 'analytics', view: 'overview' },
};
const OCCUPANCY_REPORT: AiNavigationTarget = {
  label: 'فتح الإشغال والشغور',
  to: '/reports',
  search: { section: 'analytics', view: 'occupancy' },
};
const COMMUNICATION_CENTER: AiNavigationTarget = { label: 'فتح مركز التواصل', to: '/communication' };
const MAINTENANCE_WORKSPACE: AiNavigationTarget = { label: 'فتح الصيانة', to: '/maintenance' };
const PROPERTIES_WORKSPACE: AiNavigationTarget = { label: 'فتح العقارات', to: '/properties' };
const FINANCIALS_WORKSPACE: AiNavigationTarget = { label: 'فتح العمليات المالية', to: '/financials' };
const TODAY_WORKSPACE: AiNavigationTarget = { label: 'فتح شاشة اليوم', to: '/dashboard' };
const OWNERS_WORKSPACE: AiNavigationTarget = { label: 'فتح الملاك', to: '/owners' };

const NAVIGATION_BY_ACTION: Readonly<Record<AiAssistantAction, readonly AiNavigationTarget[]>> = {
  summarize_overdue_invoices: [OVERDUE_REPORT],
  summarize_contract_renewals: [CONTRACTS_WORKSPACE],
  summarize_vacancy: [OCCUPANCY_REPORT],
  summarize_month: [OFFICE_PERFORMANCE],
  draft_tenant_payment_reminder: [COMMUNICATION_CENTER],
  explain_property_financial_snapshot: [OFFICE_PERFORMANCE],
  explain_current_surface: [],
  identify_riskiest_overdue_tenants: [OVERDUE_REPORT, COMMUNICATION_CENTER],
  list_contracts_needing_action_this_week: [CONTRACTS_WORKSPACE],
  locate_dormant_funds: [FINANCIALS_WORKSPACE],
  list_vacant_units_needing_followup: [OCCUPANCY_REPORT, PROPERTIES_WORKSPACE],
  identify_lowest_performing_properties: [PROPERTIES_WORKSPACE, OVERDUE_REPORT],
  list_overdue_or_critical_maintenance: [MAINTENANCE_WORKSPACE],
  prioritize_office_actions_top5: [TODAY_WORKSPACE],
  generate_daily_brief: [TODAY_WORKSPACE],
  draft_contract_renewal_followup: [COMMUNICATION_CENTER, CONTRACTS_WORKSPACE],
  draft_maintenance_followup: [COMMUNICATION_CENTER, MAINTENANCE_WORKSPACE],
  draft_owner_summary: [OWNERS_WORKSPACE],
  draft_internal_note: [],
};

const FREEFORM_NAVIGATION_TARGETS: readonly AiNavigationTarget[] = [
  { label: 'فتح التقارير', to: '/reports' },
  FINANCIALS_WORKSPACE,
];

const ALLOWED_NAVIGATION_ROUTES: ReadonlySet<string> = new Set([
  '/dashboard',
  '/reports',
  '/contracts',
  '/communication',
  '/financials',
  '/maintenance',
  '/properties',
  '/owners',
]);

/**
 * Canonical routes from the route contract. A navigation target must be both
 * explicitly allow-listed here AND canonical — a typo or a removed route can
 * never leak into the assistant UI.
 */
const CANONICAL_ROUTES: ReadonlySet<string> = new Set(
  ROUTE_CONTRACT.map((entry) => entry.canonical),
);

function isSafeNavigationRoute(to: string): boolean {
  return ALLOWED_NAVIGATION_ROUTES.has(to) && CANONICAL_ROUTES.has(to);
}

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
  return targets.filter((target) => isSafeNavigationRoute(target.to));
}

export const FORBIDDEN_NAVIGATION_PATTERNS = [
  /^https?:/i,
  /\.(insert|update|delete|upsert)\(/i,
  /mailto:/i,
  /tel:/i,
  /wa\.me/i,
] as const;

export function isAllowedAiNavigationTarget(target: AiNavigationTarget): boolean {
  if (!isSafeNavigationRoute(target.to)) return false;
  const serialized = JSON.stringify(target);
  return FORBIDDEN_NAVIGATION_PATTERNS.every((pattern) => !pattern.test(serialized));
}
