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
import type { AiAssistantAction, AiAssistantSurfaceContext } from './types';

export type AiNavigationTarget = Readonly<{
  label: string;
  to: string;
  search?: Readonly<Record<string, string>>;
}>;

export type AiNavigationContext = Readonly<{
  /** True for free-form questions without a declared action. */
  freeform: boolean;
  /** Sanitized route/entity descriptor derived by the canonical surface seam. */
  surface?: AiAssistantSurfaceContext;
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
const OWNER_SETTLEMENTS: AiNavigationTarget = { label: 'فتح تسويات الملاك', to: '/owner-settlements' };

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
  '/owner-settlements',
]);

const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DYNAMIC_DETAIL_TEMPLATES: ReadonlySet<string> = new Set([
  '/properties/$propertyId',
  '/contracts/$contractId',
  '/tenants/$tenantId',
  '/owners/$ownerId',
  '/people/$personId',
]);

/** Canonical routes from the route contract. */
const CANONICAL_ROUTES: ReadonlySet<string> = new Set(
  ROUTE_CONTRACT.map((entry) => entry.canonical),
);

function isCanonicalDynamicDetailRoute(to: string): boolean {
  const segments = to.split('/').filter(Boolean);
  if (segments.length !== 2) return false;
  const [root, id] = segments;
  if (!SAFE_ID_PATTERN.test(id)) return false;
  const template =
    root === 'properties' ? '/properties/$propertyId'
      : root === 'contracts' ? '/contracts/$contractId'
        : root === 'tenants' ? '/tenants/$tenantId'
          : root === 'owners' ? '/owners/$ownerId'
            : root === 'people' ? '/people/$personId'
              : null;
  return Boolean(template && DYNAMIC_DETAIL_TEMPLATES.has(template) && CANONICAL_ROUTES.has(template));
}

function isSafeNavigationRoute(to: string): boolean {
  return (
    (ALLOWED_NAVIGATION_ROUTES.has(to) && CANONICAL_ROUTES.has(to))
    || isCanonicalDynamicDetailRoute(to)
  );
}

function entityDetailTarget(surface: AiAssistantSurfaceContext): AiNavigationTarget | null {
  const id = surface.entityId;
  if (!id || !SAFE_ID_PATTERN.test(id)) return null;
  switch (surface.entityType) {
    case 'property': return { label: 'فتح ملف العقار', to: `/properties/${id}` };
    case 'contract': return { label: 'فتح العقد', to: `/contracts/${id}` };
    case 'tenant': return { label: 'فتح ملف المستأجر', to: `/tenants/${id}` };
    case 'owner': return { label: 'فتح ملف المالك', to: `/owners/${id}` };
    case 'person': return { label: 'فتح ملف الشخص', to: `/people/${id}` };
    default: return null;
  }
}

function contextualTargets(surface?: AiAssistantSurfaceContext): readonly AiNavigationTarget[] {
  if (!surface?.entityType || !surface.entityId) return [];
  const detail = entityDetailTarget(surface);
  switch (surface.entityType) {
    case 'property': return [detail, MAINTENANCE_WORKSPACE, OVERDUE_REPORT].filter(Boolean) as AiNavigationTarget[];
    case 'unit': return [CONTRACTS_WORKSPACE, MAINTENANCE_WORKSPACE];
    case 'contract': return [detail, OVERDUE_REPORT, COMMUNICATION_CENTER].filter(Boolean) as AiNavigationTarget[];
    case 'tenant':
    case 'person': return [detail, OVERDUE_REPORT, COMMUNICATION_CENTER].filter(Boolean) as AiNavigationTarget[];
    case 'owner': return [detail, OWNER_SETTLEMENTS, OFFICE_PERFORMANCE].filter(Boolean) as AiNavigationTarget[];
    default: return [];
  }
}

function dedupeTargets(targets: readonly AiNavigationTarget[]): readonly AiNavigationTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.to}|${JSON.stringify(target.search ?? {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildAiNavigationTargets(
  action: AiAssistantAction | undefined,
  context?: AiNavigationContext,
): readonly AiNavigationTarget[] {
  const baseTargets =
    action && action in NAVIGATION_BY_ACTION
      ? NAVIGATION_BY_ACTION[action]
      : context?.freeform
        ? FREEFORM_NAVIGATION_TARGETS
        : [];
  const targets = action === 'explain_current_surface'
    ? [...contextualTargets(context?.surface), ...baseTargets]
    : baseTargets;
  return dedupeTargets(targets).filter((target) => isSafeNavigationRoute(target.to));
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
