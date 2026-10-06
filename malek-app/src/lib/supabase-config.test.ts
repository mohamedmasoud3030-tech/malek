import { describe, expect, it } from 'vitest';
import { resolvePublicSupabaseConfig, SUPABASE_FALLBACK_URL } from './supabase-config';

describe('build/runtime configuration parity', () => {
  it.each([
    [undefined, undefined], [' ', 'key'], ['not a URL', 'key'],
    ['javascript:alert(1)', 'key'], ['https://example.supabase.co/', 'key'],
    ['https://foo.invalid.supabase.local', 'key'], ['https://app.supabase.co', ' test-anon-key '],
    ['https://user:password@app.supabase.co', 'key'],
  ])('fails closed for %s', (url, key) => {
    const result = resolvePublicSupabaseConfig(url, key);
    expect(result.isConfigured).toBe(false);
    expect(result.supabaseUrl).toBe(SUPABASE_FALLBACK_URL);
    expect(result.reason).toBeTruthy();
    expect(result.reason).not.toContain('password');
  });
  it.each(['https://app.supabase.co', 'https://db.example.org', 'http://127.0.0.1:54321'])(
    'accepts hosted/custom/local public config: %s', (url) => {
      expect(resolvePublicSupabaseConfig(` ${url} `, ' public-key ')).toEqual({
        supabaseUrl: url, supabaseAnonKey: 'public-key', isConfigured: true,
      });
    },
  );
});


function legacyKey(role: string) {
  return `${btoa(JSON.stringify({ alg: 'HS256' }))}.${btoa(JSON.stringify({ role }))}.unverifiable-test-signature`;
}

it.each([legacyKey('service_role'), legacyKey('authenticated'), 'sb_secret_not-a-real-key', 'sb_publishable_', 'bad.jwt.payload'])(
  'refuses recognizable non-public or malformed keys without exposing the value', (key) => {
    const config = resolvePublicSupabaseConfig('https://app.supabase.co', key);
    expect(config.isConfigured).toBe(false);
    expect(config.supabaseAnonKey).not.toBe(key);
    expect(config.reason).not.toContain(key);
  },
);

it.each([legacyKey('anon'), 'sb_publishable_not-a-real-key'])(
  'accepts public key families (not proof of server validity)', (key) => {
    expect(resolvePublicSupabaseConfig('https://app.supabase.co', key).isConfigured).toBe(true);
  },
);
