import { describe, expect, it } from 'vitest';
import { communicationEventPolicies } from '@/features/communication/communication-system';
import { AUTOMATION_INTENT_COMMUNICATION_EVENT, type AutomationDispatchIntent } from './types';

describe('canonical automation dispatch intent', () => {
  it('maps every intent kind to a real communication event policy', () => {
    const policyEvents = new Set(communicationEventPolicies.map((policy) => policy.eventType));
    for (const [kind, eventType] of Object.entries(AUTOMATION_INTENT_COMMUNICATION_EVENT)) {
      expect(policyEvents.has(eventType), `${kind} must delegate to a governed communication event`).toBe(true);
    }
  });

  it('covers the four foundational automations including owner monthly statements', () => {
    expect(Object.keys(AUTOMATION_INTENT_COMMUNICATION_EVENT).sort()).toEqual([
      'contract_expiry',
      'overdue_escalation',
      'owner_monthly_statement',
      'rent_reminder',
    ]);
    expect(AUTOMATION_INTENT_COMMUNICATION_EVENT.owner_monthly_statement).toBe('OWNER_STATEMENT_READY');
  });

  it('keeps recipients as identifier references and attachments as document references', () => {
    // Type-level contract exercised with a representative value: no phone/email
    // fields exist on the recipient reference, and the intent has no send flag.
    const intent: AutomationDispatchIntent = {
      kind: 'owner_monthly_statement',
      ruleId: 'rule-1',
      channel: 'email',
      recipients: [{ type: 'owner', id: 'owner-1' }],
      templateVariables: { period_from: '2026-08-01', period_to: '2026-08-31' },
      attachments: [{ kind: 'owner_statement', refId: 'owner-1' }],
      preparedAt: '2026-09-01T00:00:00.000Z',
    };
    expect(intent.recipients[0]).toEqual({ type: 'owner', id: 'owner-1' });
    expect(intent.recipients[0]).not.toHaveProperty('phone');
    expect(intent.recipients[0]).not.toHaveProperty('email');
    expect(intent).not.toHaveProperty('sent');
    expect(intent.attachments[0].kind).toBe('owner_statement');
  });
});
