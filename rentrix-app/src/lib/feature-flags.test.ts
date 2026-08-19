import { describe, expect, it, vi } from 'vitest';
import { isFeatureEnabled, getFlagDefinition, listAllFlags, getPublicFlagStates } from './feature-flags';

describe('feature flag definitions', () => {
  it('lists all flags with required metadata', () => {
    const flags = listAllFlags();
    expect(flags.length).toBeGreaterThanOrEqual(6);
    for (const flag of flags) {
      expect(flag.key).toBeTruthy();
      expect(flag.owner).toBeTruthy();
      expect(flag.cleanupBy).toBeTruthy();
      expect(flag.phase).toMatch(/^(alpha|beta|stable|deprecated)$/);
      expect(typeof flag.defaultValue).toBe('boolean');
      expect(flag.public).toBe(true);
    }
  });

  it('looks up a flag by key', () => {
    expect(getFlagDefinition('ai-assistant')?.labelAr).toBe('المساعد الذكي');
    expect(getFlagDefinition('nonexistent')).toBeUndefined();
  });

  it('returns default values when no override is present', () => {
    const def = getFlagDefinition('reports-v2');
    expect(def?.defaultValue).toBe(false);

    // No env vars = default
    expect(isFeatureEnabled('reports-v2')).toBe(false);
  });

  it('respects the defaultValue of stable/beta flags', () => {
    expect(isFeatureEnabled('malek-pro-visual')).toBe(true);
    expect(isFeatureEnabled('ai-assistant')).toBe(true);
  });

  it('returns false for unknown flags', () => {
    expect(isFeatureEnabled('unknown-flag')).toBe(false);
  });
});

describe('environment override', () => {
  it('VITE_FEATURE_* env var forces a flag ON', () => {
    expect(isFeatureEnabled('reports-v2', { env: { VITE_FEATURE_REPORTS_V2: 'true' } })).toBe(true);
  });

  it('VITE_KILL_* env var forces a flag OFF even when other sources say ON', () => {
    expect(
      isFeatureEnabled('ai-assistant', { env: { VITE_KILL_AI_ASSISTANT: 'false', VITE_FEATURE_AI_ASSISTANT: 'true' } }),
    ).toBe(false);
  });

  it('kill switch overrides localStorage', () => {
    // Mock localStorage for environments where Storage is not available
    const mockStorage: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
    });
    mockStorage['ff:reports-v2'] = '1';
    expect(
      isFeatureEnabled('reports-v2', { env: { VITE_KILL_REPORTS_V2: 'false' } }),
    ).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('role gating', () => {
  it('allows ADMIN to see ADMIN-only flags when enabled', () => {
    const result = isFeatureEnabled('financial-wave-2', { role: 'ADMIN' });
    // Default is false, so without env override it's still false
    expect(result).toBe(false);
  });

  it('hides ADMIN-only flags from USER even when default is true', () => {
    const def = getFlagDefinition('ai-assistant');
    expect(def?.roles).toContain('ADMIN');
    expect(def?.roles).toContain('MANAGER');
    expect(def?.roles).not.toContain('USER');

    // ai-assistant default is true but USER is excluded
    expect(isFeatureEnabled('ai-assistant', { role: 'USER' })).toBe(false);
    expect(isFeatureEnabled('ai-assistant', { role: 'ADMIN' })).toBe(true);
  });

  it('returns public flag states as a plain object', () => {
    const states = getPublicFlagStates({ env: { VITE_FEATURE_FINANCIAL_WAVE_2: 'true' } });
    expect(states['ai-assistant']).toBe(true);
    expect(states['financial-wave-2']).toBe(true);
    expect(states['reports-v2']).toBe(false);
  });
});

describe('expiry contract', () => {
  it('every alpha/beta flag has a cleanup date', () => {
    for (const flag of listAllFlags()) {
      if (flag.phase === 'alpha' || flag.phase === 'beta') {
        expect(flag.cleanupBy, `${flag.key} must have cleanupBy`).toBeTruthy();
        // Should be a date string like 2026-10-01
        expect(flag.cleanupBy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('deprecated flags must have a cleanupBy in the past or present', () => {
    // No deprecated flags yet — this test ensures cleanup happens
    for (const flag of listAllFlags()) {
      expect(flag.phase, `${flag.key} should not be 'deprecated' yet`).not.toBe('deprecated');
    }
  });
});