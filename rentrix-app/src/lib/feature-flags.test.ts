import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getFeatureFlagEnv,
  getFlagDefinition,
  getPublicFlagStates,
  isFeatureEnabled,
  listAllFlags,
} from './feature-flags';

function stubLocalStorage(values: Record<string, string>) {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = value; },
    removeItem: (key: string) => { delete values[key]; },
    clear: () => {
      for (const key of Object.keys(values)) delete values[key];
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('feature flag definitions', () => {
  it('lists the reviewed flag registry with required metadata', () => {
    const flags = listAllFlags();
    const expectedKeys = [
      'ai-assistant',
      'reports-v2',
      'financial-wave-2',
      'owner-agreements-v2',
      'dashboard-v2',
      'commission-lifecycle-v2',
    ];
    const actualKeys = flags.map((flag) => flag.key);

    expect(new Set(actualKeys).size).toBe(actualKeys.length);
    expect([...actualKeys].sort()).toEqual([...expectedKeys].sort());

    for (const flag of flags) {
      expect(flag.key).toBeTruthy();
      expect(flag.owner).toBeTruthy();
      expect(flag.cleanupBy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(flag.phase).toMatch(/^(alpha|beta|stable|deprecated)$/);
      expect(typeof flag.defaultValue).toBe('boolean');
      expect(flag.public).toBe(true);
    }
  });

  it('looks up a flag by key and rejects unknown flags', () => {
    expect(getFlagDefinition('ai-assistant')?.labelAr).toBe('المساعد الذكي');
    expect(getFlagDefinition('nonexistent')).toBeUndefined();
    expect(isFeatureEnabled('unknown-flag')).toBe(false);
  });

  it('uses the real Vite import.meta.env adapter when env is not injected', () => {
    expect(getFeatureFlagEnv()).toBe(import.meta.env);
  });
});

describe('kill switch precedence', () => {
  it('kill=false beats env=true', () => {
    expect(isFeatureEnabled('reports-v2', {
      role: 'ADMIN',
      env: { VITE_KILL_REPORTS_V2: 'false', VITE_FEATURE_REPORTS_V2: 'true' },
    })).toBe(false);
  });

  it('kill=false beats localStorage=1', () => {
    stubLocalStorage({ 'ff:reports-v2': '1' });
    expect(isFeatureEnabled('reports-v2', {
      role: 'ADMIN',
      env: { VITE_KILL_REPORTS_V2: 'false' },
    })).toBe(false);
  });

  it('kill=false beats a default=true flag', () => {
    expect(isFeatureEnabled('ai-assistant', {
      role: 'ADMIN',
      env: { VITE_KILL_AI_ASSISTANT: 'false' },
    })).toBe(false);
  });
});

describe('role eligibility cannot be expanded by rollout sources', () => {
  it('ADMIN-only + ADMIN + env=true => ON', () => {
    expect(isFeatureEnabled('financial-wave-2', {
      role: 'ADMIN',
      env: { VITE_FEATURE_FINANCIAL_WAVE_2: 'true' },
    })).toBe(true);
  });

  it('ADMIN-only + USER + env=true => OFF', () => {
    expect(isFeatureEnabled('financial-wave-2', {
      role: 'USER',
      env: { VITE_FEATURE_FINANCIAL_WAVE_2: 'true' },
    })).toBe(false);
  });

  it('ADMIN-only + unresolved role + env=true => OFF', () => {
    for (const role of [undefined, null, '']) {
      expect(isFeatureEnabled('financial-wave-2', {
        role,
        env: { VITE_FEATURE_FINANCIAL_WAVE_2: 'true' },
      })).toBe(false);
    }
  });

  it('ADMIN-only + ADMIN + localStorage=1 => ON', () => {
    stubLocalStorage({ 'ff:reports-v2': '1' });
    expect(isFeatureEnabled('reports-v2', { role: 'ADMIN', env: {} })).toBe(true);
  });

  it('ADMIN-only + USER + localStorage=1 => OFF', () => {
    stubLocalStorage({ 'ff:reports-v2': '1' });
    expect(isFeatureEnabled('reports-v2', { role: 'USER', env: {} })).toBe(false);
  });

  it('ADMIN-only + unresolved role + localStorage=1 => OFF', () => {
    stubLocalStorage({ 'ff:reports-v2': '1' });
    expect(isFeatureEnabled('reports-v2', { env: {} })).toBe(false);
  });

  it('unknown or invalid roles fail closed', () => {
    expect(isFeatureEnabled('reports-v2', {
      role: 'OWNER',
      env: { VITE_FEATURE_REPORTS_V2: 'true' },
    })).toBe(false);
  });
});

describe('default and local preview semantics', () => {
  it('restricted default=true is ON for authorized role', () => {
    expect(isFeatureEnabled('ai-assistant', { role: 'ADMIN', env: {} })).toBe(true);
    expect(isFeatureEnabled('ai-assistant', { role: 'MANAGER', env: {} })).toBe(true);
  });

  it('restricted default=true is OFF for unauthorized or unresolved role', () => {
    expect(isFeatureEnabled('ai-assistant', { role: 'USER', env: {} })).toBe(false);
    expect(isFeatureEnabled('ai-assistant', { env: {} })).toBe(false);
  });

  it('localStorage=0 turns an otherwise authorized flag OFF', () => {
    stubLocalStorage({ 'ff:ai-assistant': '0' });
    expect(isFeatureEnabled('ai-assistant', { role: 'ADMIN', env: {} })).toBe(false);
  });

  it('environment ON wins over local preview OFF after role eligibility', () => {
    stubLocalStorage({ 'ff:reports-v2': '0' });
    expect(isFeatureEnabled('reports-v2', {
      role: 'ADMIN',
      env: { VITE_FEATURE_REPORTS_V2: 'true' },
    })).toBe(true);
  });
});

describe('public states preserve role restrictions', () => {
  it('does not expose restricted flags to USER even when env enables them', () => {
    const states = getPublicFlagStates({
      role: 'USER',
      env: { VITE_FEATURE_FINANCIAL_WAVE_2: 'true' },
    });
    expect(states['financial-wave-2']).toBe(false);
    expect(states['ai-assistant']).toBe(false);
  });
});

describe('expiry contract', () => {
  it('every alpha/beta flag has a valid cleanup date', () => {
    for (const flag of listAllFlags()) {
      if (flag.phase === 'alpha' || flag.phase === 'beta') {
        expect(flag.cleanupBy, `${flag.key} must have cleanupBy`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isNaN(Date.parse(`${flag.cleanupBy}T00:00:00Z`))).toBe(false);
      }
    }
  });
});

describe('role vocabulary alignment', () => {
  it('treats a restricted flag as fail-closed for non-targeted real roles', () => {
    expect(isFeatureEnabled('ai-assistant', { role: 'OPERATIONS' })).toBe(false);
    expect(isFeatureEnabled('ai-assistant', { role: 'ACCOUNTANT' })).toBe(false);
    expect(isFeatureEnabled('ai-assistant', { role: 'VIEWER' })).toBe(false);
  });

  it('still rejects genuinely unknown roles', () => {
    expect(isFeatureEnabled('ai-assistant', { role: 'SUPERUSER' })).toBe(false);
  });
});
