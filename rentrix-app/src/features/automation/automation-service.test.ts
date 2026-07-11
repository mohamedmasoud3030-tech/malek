import { describe, expect, it } from 'vitest';
import { automationRulesCatalog } from './automation-catalog';
import { localAutomationGateway } from './automation-service';

describe('automation provider boundary', () => {
  it('keeps provider execution opt-in while allowing local previews', async () => {
    const rule = automationRulesCatalog[0];
    expect(localAutomationGateway.previewRule(rule).accepted).toBe(true);
    await expect(localAutomationGateway.updateRule({ ruleId: rule.id, status: 'paused' })).resolves.toMatchObject({
      accepted: false,
      provider: 'local-preview',
    });
  });
});
