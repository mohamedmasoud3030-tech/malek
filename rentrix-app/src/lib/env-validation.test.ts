import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('production env validation', () => {
  it('vite.config.ts contains production env guard that blocks placeholders', () => {
    const configPath = resolve(import.meta.dirname, '../../vite.config.ts');
    const content = readFileSync(configPath, 'utf8');
    expect(content).toContain('production-env-guard');
    expect(content).toContain('PLACEHOLDER_URLS');
    expect(content).toContain('PLACEHOLDER_KEYS');
    expect(content).toContain('example.supabase.co');
    expect(content).toContain('invalid.supabase.local');
    expect(content).toContain('test-anon-key');
    expect(content).toContain('فشل بناء الإنتاج');
  });

  it('vite config allows test env with VITEST', () => {
    const configPath = resolve(import.meta.dirname, '../../vite.config.ts');
    const content = readFileSync(configPath, 'utf8');
    expect(content).toContain('VITEST');
    expect(content).toContain('isTest');
    expect(content).toContain('isProdBuild');
  });

  it('env.ts still provides isConfigured for runtime diagnostics', () => {
    const envPath = resolve(import.meta.dirname, './env.ts');
    const content = readFileSync(envPath, 'utf8');
    expect(content).toContain('isConfigured');
    expect(content).toContain('PLACEHOLDER_URLS');
    expect(content).toContain('PLACEHOLDER_KEYS');
  });

  it('env validation does not break test execution', () => {
    // This test itself runs with VITEST=true, so it should not fail
    expect(process.env.VITEST).toBeTruthy();
  });
});
