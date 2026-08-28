/**
 * AI Assistant navigation contract — P4 Intelligence.
 *
 * PRD-008 allows the assistant to **navigate**: it may open the canonical
 * workspace that answers the operator's question, but it is never accounting
 * authority and never mutates anything.
 *
 * Navigation targets are derived deterministically from the *requested action*
 * (a closed union), never from model output. This keeps model replies
 * ungrounded text: if the model hallucinates a destination, no deep link is
 * produced. Every target is an in-app route already gated by its own route
 * permission; no raw URL, no query injection, no mutation route.
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
      label: 'فتح تعتيق المتأخرات',
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
  draft_tenant_payment_reminder: [
    {
      label: 'فتح مركز التواصل',
      to: '/communication',
    },
  ],
  explain_property_financial_snapshot: [
    {
      label: 'فتح نظرة الأداء',
      to: '/reports',
      search: { section: 'analytics', view: 'overview' },
    },
  ],
};

const FREEFORM_NAVIGATION_TARGETS: readonly AiNavigationTarget[] = [
  { label: 'فتح التقارير', to: '/reports' },
  { label: 'فتح العمليات المالية', to: '/financials' },
];

/**
 * Allowed route destinations — the only values that may ever be navigated to
 * from assistant output. Kept as an explicit allowlist so a future action or
 * a regression cannot introduce an arbitrary route.
 */
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
  // Index only after an explicit membership test so an unknown/future action
  // value can never produce `undefined` or arbitrary navigation.
  const targets =
    action && action in NAVIGATION_BY_ACTION
      ? NAVIGATION_BY_ACTION[action]
      : context?.freeform
        ? FREEFORM_NAVIGATION_TARGETS
        : [];
  return targets.filter((target) => ALLOWED_NAVIGATION_ROUTES.has(target.to));
}

/** Forbidden destination shapes (mutation / raw URLs) — checked by tests. */
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
