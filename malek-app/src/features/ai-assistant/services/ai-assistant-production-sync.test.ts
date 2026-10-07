import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ai-assistant production runtime contract', () => {
  it('keeps the direct database control fallback that recovered the live Edge Function from 503 responses', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../../../../../', 'supabase/functions/ai-assistant/index.ts'),
      'utf8',
    );

    expect(source).toContain('npm:postgres@3.4.3');
    expect(source).toContain('callControlRpcDirect');
    expect(source).toContain("set local role authenticated");
    expect(source).toContain('authorizeAccess(request, auth.user.userId)');
    expect(source).toContain('reserveProviderBudget(request, auth.user.userId, assistantRequest.requestId)');
  });
});
