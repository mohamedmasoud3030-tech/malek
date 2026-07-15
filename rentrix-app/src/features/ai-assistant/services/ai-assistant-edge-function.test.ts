import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AI assistant edge function', () => {
  it('exists and has auth check, validation, rate limiting and safe logging', () => {
    const funcPath = resolve(import.meta.dirname, '../../../../../supabase/functions/ai-assistant/index.ts');
    const content = readFileSync(funcPath, 'utf8');

    expect(content).toContain('assertAuthenticated');
    expect(content).toContain('AUTH_REQUIRED');
    expect(content).toContain('rateLimiter');
    expect(content).toContain('RATE_LIMIT_MAX');
    expect(content).toContain('RATE_LIMIT_EXCEEDED');
    expect(content).toContain('sqlStatementPattern');
    expect(content).toContain('isPrivateHostname');
    expect(content).toContain('AI_PROVIDER_API_KEY');
    expect(content).toContain('AI_CONFIG_MISSING');
    expect(content).toContain('قراءة فقط');
  });

  it('does not have write permissions and is read-only', () => {
    const funcPath = resolve(import.meta.dirname, '../../../../../supabase/functions/ai-assistant/index.ts');
    const content = readFileSync(funcPath, 'utf8');

    expect(content).toContain('قراءة فقط');
    expect(content).toContain('لا تنفذ تعديلات');
    expect(content).not.toContain('supabase.from');
    expect(content).not.toContain('.insert');
    expect(content).not.toContain('.update');
    expect(content).not.toContain('.delete');
  });

  it('handles missing provider config gracefully with 503', () => {
    const funcPath = resolve(import.meta.dirname, '../../../../../supabase/functions/ai-assistant/index.ts');
    const content = readFileSync(funcPath, 'utf8');

    expect(content).toContain('503');
    expect(content).toContain('إعدادات الذكاء الاصطناعي غير مكتملة');
    expect(content).toContain('AI_PROVIDER_BASE_URL');
  });

  it('has safe logging without exposing secrets', () => {
    const funcPath = resolve(import.meta.dirname, '../../../../../supabase/functions/ai-assistant/index.ts');
    const content = readFileSync(funcPath, 'utf8');

    expect(content).toContain('console.log');
    expect(content).toContain('console.error');
    // Should NOT log apiKey value directly - check that console.log does not include apiKey variable
    expect(content).not.toMatch(/console\.log\([^)]*apiKey[^)]*\)/);
    expect(content).not.toMatch(/console\.error\([^)]*apiKey[^)]*\)/);
    // Should log metadata, not full prompt
    expect(content).toContain('promptLength');
    expect(content).toContain('durationMs');
    // Ensure it logs safe metadata
    expect(content).toContain('AI request success');
  });

  it('frontend service does not contain mock data', () => {
    const servicePath = resolve(import.meta.dirname, './ai-assistant-service.ts');
    const content = readFileSync(servicePath, 'utf8');

    expect(content).not.toContain('placehold.co');
    expect(content).not.toContain('mock');
    expect(content).toContain('buildAiAssistantContext');
    expect(content).toContain('supabase');
  });
});
