import { useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import type { UserRole } from '@/domain/types';
import flagDefinitions from './feature-flag-definitions.json';

/**
 * MALEK Feature Flags — lightweight, config-backed, provider-neutral.
 *
 * Security invariant:
 * Feature flags are presentation/rollout controls only. They are never
 * authorization. RLS, RPC permissions, route permissions and backend validation
 * remain authoritative for privileged operations.
 *
 * Evaluation order:
 *   1. Unknown flag -> OFF
 *   2. Kill switch (`VITE_KILL_<NAME>=false`) -> force OFF
 *   3. Role gate -> fail closed for missing/unknown/unauthorized roles
 *   4. Vite deployment override (`VITE_FEATURE_<NAME>=true`) -> ON
 *   5. Authorized local preview (`ff:<name>=1|0`) -> ON/OFF
 *   6. Definition default
 *
 * VITE_* values are browser build-time configuration in Vite. Changing them on
 * Vercel requires a deployment/rebuild before users receive the new bundle.
 *
 * @see FEATURE_ROLLOUT_POLICY.md
 */

const FLAG_KILL_PREFIX = 'VITE_KILL_';
const FLAG_ENV_PREFIX = 'VITE_FEATURE_';
const LOCAL_STORAGE_PREFIX = 'ff:';
const VALID_ROLES = new Set<UserRole>(['ADMIN', 'MANAGER', 'ACCOUNTANT', 'OPERATIONS', 'USER', 'VIEWER']);

type FeaturePhase = 'alpha' | 'beta' | 'stable' | 'deprecated';
type FeatureFlagEnv = Record<string, string | undefined>;

export interface FeatureFlagDef {
  key: string;
  labelAr: string;
  labelEn: string;
  owner: string;
  description: string;
  cleanupBy: string;
  phase: FeaturePhase;
  defaultValue: boolean;
  roles?: readonly UserRole[];
  public: boolean;
  tracker?: string;
}

const FLAGS = flagDefinitions as FeatureFlagDef[];
const flagByKey = new Map<string, FeatureFlagDef>(FLAGS.map((flag) => [flag.key, flag]));

export function getFlagDefinition(key: string): FeatureFlagDef | undefined {
  return flagByKey.get(key);
}

export function listAllFlags(): readonly FeatureFlagDef[] {
  return FLAGS;
}

/**
 * Exposes only Vite public environment values to the flag evaluator.
 * Tests may inject an explicit env object through isFeatureEnabled options.
 */
export function getFeatureFlagEnv(): FeatureFlagEnv {
  return import.meta.env as FeatureFlagEnv;
}

export function isFeatureEnabled(
  key: string,
  options?: { role?: string | null; env?: FeatureFlagEnv },
): boolean {
  const def = flagByKey.get(key);
  if (!def) return false;

  const env = options?.env ?? getFeatureFlagEnv();
  const role = normalizeRole(options?.role);

  // 1. Kill switch always wins.
  const killKey = `${FLAG_KILL_PREFIX}${toEnvKey(key)}`;
  if (env[killKey] === 'false') return false;

  // 2. Role restrictions are eligibility boundaries for rollout only.
  // Missing, unknown and unauthorized roles fail closed before any ON override.
  if (def.roles) {
    if (!role || !def.roles.includes(role)) return false;
  }

  // 3. Deployment-level Vite rollout override.
  const envKey = `${FLAG_ENV_PREFIX}${toEnvKey(key)}`;
  if (env[envKey] === 'true') return true;

  // 4. Local preview override. This is evaluated only after role eligibility.
  if (typeof localStorage !== 'undefined') {
    try {
      const localOverride = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${key}`);
      if (localOverride === '1') return true;
      if (localOverride === '0') return false;
    } catch {
      // Storage can be unavailable in SSR/private contexts; fall through safely.
    }
  }

  // 5. Canonical definition default.
  return def.defaultValue;
}

export function getPublicFlagStates(options?: {
  role?: string | null;
  env?: FeatureFlagEnv;
}): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const def of FLAGS) {
    if (def.public) result[def.key] = isFeatureEnabled(def.key, options);
  }
  return result;
}

function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role || !VALID_ROLES.has(role as UserRole)) return null;
  return role as UserRole;
}

function toEnvKey(kebab: string): string {
  return kebab.replaceAll('-', '_').toUpperCase();
}

/**
 * React wrapper using the authorization role resolved by the existing auth
 * subsystem. Restricted flags remain OFF until authorization is available.
 */
export function useFeatureFlag(key: string): boolean {
  const { authorization } = useAuth();
  return useMemo(
    () => isFeatureEnabled(key, { role: authorization?.role }),
    [key, authorization?.role],
  );
}
