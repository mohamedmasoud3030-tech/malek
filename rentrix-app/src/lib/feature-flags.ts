/**
 * MALEK Feature Flags — lightweight, config‑backed, provider‑neutral.
 *
 * == Principles ==
 *
 * 1. **Flags are NOT authorization.**  Server‑side enforcement (RLS/RPC) is the
 *    only gate for destructive or privileged actions.  A client flag can hide
 *    a UI element but must never prevent a direct API call.
 *
 * 2. **Default is OFF.**  Every flag defaults to `false` so new work never
 *    reaches production until deliberately enabled.
 *
 * 3. **Kill switch wins.**  `VITE_KILL_<FLAG_NAME>=false` overrides every other
 *    source.  Set it in the Vercel dashboard during an incident; no code deploy
 *    required.
 *
 * 4. **Expire & clean up.**  Each flag has a target cleanup commit reference.
 *    Run `scripts/check-expired-flags.mjs` before every release.
 *
 * == Evaluation order ==
 *
 *   1. Kill‑switch env var (`VITE_KILL_<NAME>`) → force OFF if `=false`
 *   2. Env‑var default (`VITE_FEATURE_<NAME>=true`) → deployment‑level ON
 *   3. `localStorage` override (`ff:<name>=1`) → per‑user ON (staff only)
 *   4. Role gate → limited to roles in the `roles` array
 *   5. Fallback → `defaultValue` from the definition
 *
 * @see FEATURE_ROLLOUT_POLICY.md for rollout stages, owners, and cleanup.
 */

const FLAG_KILL_PREFIX = 'VITE_KILL_';
const FLAG_ENV_PREFIX = 'VITE_FEATURE_';
const LOCAL_STORAGE_PREFIX = 'ff:';

// ---------------------------------------------------------------------------
// Flag inventory — single source of truth
// ---------------------------------------------------------------------------

export interface FeatureFlagDef {
  /** Short kebab‑case identifier (used for kill/env/localStorage keys). */
  key: string;
  /** Human‑readable Arabic name for dashboards. */
  labelAr: string;
  /** Human‑readable English name. */
  labelEn: string;
  /** Owner team or person (email / GitHub handle). */
  owner: string;
  /** Short description of what this flag controls. */
  description: string;
  /** Target cleanup (SHA, tag, or date). */
  cleanupBy: string;
  /** Phase: alpha / beta / stable / deprecated. */
  phase: 'alpha' | 'beta' | 'stable' | 'deprecated';
  /** Default value when no override is present. */
  defaultValue: boolean;
  /** If set, only these roles see the feature when enabled. */
  roles?: readonly ('ADMIN' | 'MANAGER' | 'USER')[];
  /** If true, this flag is safe to expose to browser DevTools. */
  public: boolean;
  /** Link to the product requirement or issue. */
  tracker?: string;
}

const FLAGS: readonly FeatureFlagDef[] = [
  {
    key: 'ai-assistant',
    labelAr: 'المساعد الذكي',
    labelEn: 'AI Assistant',
    owner: 'platform',
    description: 'AI‑powered chat assistant for operational queries.',
    cleanupBy: '2026-12-01',
    phase: 'beta',
    defaultValue: true,
    roles: ['ADMIN', 'MANAGER'],
    public: true,
  },
  {
    key: 'reports-v2',
    labelAr: 'التقارير المتقدمة',
    labelEn: 'Reports V2',
    owner: 'platform',
    description: 'New reports architecture with aggregated read models.',
    cleanupBy: '2026-11-01',
    phase: 'alpha',
    defaultValue: false,
    roles: ['ADMIN'],
    public: true,
  },
  {
    key: 'financial-wave-2',
    labelAr: 'الموجة المالية الثانية',
    labelEn: 'Financial Wave 2',
    owner: 'platform',
    description: 'Enhanced bank reconciliation, expense categories, and cash‑flow projections.',
    cleanupBy: '2026-11-01',
    phase: 'alpha',
    defaultValue: false,
    roles: ['ADMIN'],
    public: true,
  },
  {
    key: 'owner-agreements-v2',
    labelAr: 'اتفاقيات الملاك المتقدمة',
    labelEn: 'Owner Agreements V2',
    owner: 'platform',
    description: 'Versioned owner agreements with maker‑checker approval workflow.',
    cleanupBy: '2026-10-15',
    phase: 'alpha',
    defaultValue: false,
    roles: ['ADMIN'],
    public: true,
  },
  {
    key: 'dashboard-v2',
    labelAr: 'لوحة التحكم الجديدة',
    labelEn: 'Dashboard V2',
    owner: 'platform',
    description: 'Redesigned dashboard with task‑centric layout.',
    cleanupBy: '2026-10-01',
    phase: 'alpha',
    defaultValue: false,
    roles: ['ADMIN'],
    public: true,
  },
  {
    key: 'malek-pro-visual',
    labelAr: 'الهوية البصرية MALEK Pro',
    labelEn: 'MALEK Pro Visual',
    owner: 'platform',
    description: 'Emerald/slate operational visual wave (data‑visual‑wave="malek‑pro").',
    cleanupBy: '2026-09-15',
    phase: 'beta',
    defaultValue: true,
    roles: ['ADMIN', 'MANAGER', 'USER'],
    public: true,
  },
  {
    key: 'commission-lifecycle-v2',
    labelAr: 'دورة العمولات المتقدمة',
    labelEn: 'Commission Lifecycle V2',
    owner: 'platform',
    description: 'Atomic commission pay/reverse with GL integration.',
    cleanupBy: '2026-10-01',
    phase: 'alpha',
    defaultValue: false,
    roles: ['ADMIN', 'MANAGER'],
    public: true,
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const flagByKey = new Map<string, FeatureFlagDef>(FLAGS.map((f) => [f.key, f]));

export function getFlagDefinition(key: string): FeatureFlagDef | undefined {
  return flagByKey.get(key);
}

export function listAllFlags(): readonly FeatureFlagDef[] {
  return FLAGS;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Resolve whether `key` is enabled for the current session.
 *
 * Order:  kill switch → env‑var → localStorage → role gate → default.
 */
export function isFeatureEnabled(
  key: string,
  options?: { role?: string | null; env?: Record<string, string | undefined> },
): boolean {
  const def = flagByKey.get(key);
  if (!def) return false;

  const env = options?.env ?? (typeof process !== 'undefined' ? process.env : {});
  const role = options?.role;

  // 1. Kill switch (force OFF)
  const killKey = `${FLAG_KILL_PREFIX}${toEnvKey(key)}`;
  if (env[killKey] === 'false') return false;

  // 2. Env var (deployment‑level override)
  const envKey = `${FLAG_ENV_PREFIX}${toEnvKey(key)}`;
  if (env[envKey] === 'true') return true;

  // 3. localStorage override (staff preview)
  if (typeof localStorage !== 'undefined') {
    try {
      const ls = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${key}`);
      if (ls === '1') return true;
      if (ls === '0') return false;
    } catch {
      // localStorage may be blocked (private browsing, SSR)
    }
  }

  // 4. Role gate
  if (def.roles && role && !def.roles.includes(role as any)) return false;

  // 5. Default
  return def.defaultValue;
}

/**
 * Return a plain object of all public flag states for hydration into
 * page‑level contexts (never use for server‑side enforcement).
 */
export function getPublicFlagStates(options?: {
  role?: string | null;
  env?: Record<string, string | undefined>;
}): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const def of FLAGS) {
    if (def.public) {
      result[def.key] = isFeatureEnabled(def.key, options);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toEnvKey(kebab: string): string {
  return kebab.replace(/-/g, '_').toUpperCase();
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';

/**
 * React hook wrapping `isFeatureEnabled` with the current auth role.
 *
 * @example
 * ```tsx
 * const showAssistant = useFeatureFlag('ai-assistant');
 * if (!showAssistant) return null;
 * return <AiAssistantPanel />;
 * ```
 */
export function useFeatureFlag(key: string): boolean {
  const { authorization } = useAuth();
  return useMemo(
    () => isFeatureEnabled(key, { role: authorization?.role }),
    [key, authorization?.role],
  );
}