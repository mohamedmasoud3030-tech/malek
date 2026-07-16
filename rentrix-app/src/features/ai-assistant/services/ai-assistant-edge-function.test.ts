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
    expect(content).toContain('secureHashUserId');
    expect(content).toContain('userId');
    expect(content).not.toContain('slice(7, 20)');
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

  it('has safe logging without exposing secrets and rate limit after auth', () => {
    const funcPath = resolve(import.meta.dirname, '../../../../../supabase/functions/ai-assistant/index.ts');
    const content = readFileSync(funcPath, 'utf8');

    expect(content).toContain('console.log');
    expect(content).toContain('console.error');
    expect(content).not.toMatch(/console\.log\([^)]*apiKey[^)]*\)/);
    expect(content).toContain('promptLength');
    expect(content).toContain('durationMs');
    expect(content).toContain('AI request success');
    // Rate limit after auth: check execution order inside Deno.serve, not definition order
    const authCallIndex = content.indexOf('const authResult = await assertAuthenticated');
    const rateLimitCallIndex = content.indexOf('checkRateLimitForUser(userId)');
    expect(authCallIndex).toBeGreaterThan(-1);
    expect(rateLimitCallIndex).toBeGreaterThan(-1);
    expect(rateLimitCallIndex).toBeGreaterThan(authCallIndex);
    // Should mention centralized storage TODO
    expect(content).toContain('centralized');
    expect(content).toContain('Supabase table');
  });

  it('rate limiting uses user id not partial JWT', () => {
    const funcPath = resolve(import.meta.dirname, '../../../../../supabase/functions/ai-assistant/index.ts');
    const content = readFileSync(funcPath, 'utf8');
    expect(content).toContain('secureHashUserId');
    expect(content).toContain('user:${userId}');
    expect(content).not.toContain('slice(7, 20)');
    expect(content).toContain('checkRateLimitForUser');
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
