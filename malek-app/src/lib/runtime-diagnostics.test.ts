import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const envState = vi.hoisted(() => ({
  isConfigured: true,
  supabaseUrl: 'https://real.supabase.co',
  supabaseAnonKey: 'real-anon-key',
}));

vi.mock('@/lib/env', () => ({
  env: envState,
}));

import { getEnvDiagnostics } from './runtime-diagnostics';

describe('getEnvDiagnostics', () => {
  const originalUrl = import.meta.env.VITE_SUPABASE_URL;
  const originalKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  beforeEach(() => {
    envState.isConfigured = true;
    envState.supabaseUrl = 'https://real.supabase.co';
    envState.supabaseAnonKey = 'real-anon-key';
    import.meta.env.VITE_SUPABASE_URL = 'https://real.supabase.co';
    import.meta.env.VITE_SUPABASE_ANON_KEY = 'real-anon-key';
  });

  afterEach(() => {
    import.meta.env.VITE_SUPABASE_URL = originalUrl;
    import.meta.env.VITE_SUPABASE_ANON_KEY = originalKey;
  });

  it('returns no diagnostics when the public Supabase config is usable', () => {
    expect(getEnvDiagnostics()).toEqual([]);
  });

  it('reports missing URL and key without inviting login', () => {
    import.meta.env.VITE_SUPABASE_URL = '';
    import.meta.env.VITE_SUPABASE_ANON_KEY = '';
    envState.isConfigured = false;

    const codes = getEnvDiagnostics().map((item) => item.code);
    expect(codes).toContain('missing_supabase_url');
    expect(codes).toContain('missing_supabase_anon_key');
    for (const item of getEnvDiagnostics()) {
      expect(item.messageAr.length).toBeGreaterThan(0);
      expect(item.messageAr).not.toMatch(/VITE_|supabase\.co|anon/i);
    }
  });

  it('treats placeholder CI values as not configured', () => {
    import.meta.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    import.meta.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
    envState.isConfigured = false;

    const diagnostics = getEnvDiagnostics();
    expect(diagnostics.some((item) => item.code === 'placeholder_supabase_config')).toBe(true);
    expect(diagnostics[0]?.messageAr).toContain('غير جاهز');
    expect(diagnostics.every((item) => !/example\.supabase|test-anon-key/i.test(item.messageAr))).toBe(true);
  });
});
