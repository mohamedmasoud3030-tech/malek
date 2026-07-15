import { describe, expect, it } from 'vitest';
import { automationRulesCatalog } from './automation-catalog';
import { localAutomationGateway } from './automation-service';

describe('automation provider boundary', () => {
  it('keeps provider execution real and allows previews', async () => {
    const rule = automationRulesCatalog[0];
    expect(localAutomationGateway.previewRule(rule).accepted).toBe(true);
    // In test env without Supabase, updateRule will fail gracefully and return accepted:false with automation-worker provider
    const result = await localAutomationGateway.updateRule({ ruleId: rule.id, status: 'paused' });
    expect(result.accepted).toBe(false);
    expect(result.provider).toBe('automation-worker');
  });
});
