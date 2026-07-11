import { describe, expect, it } from 'vitest';
import {
  buildContractExpiryDispatch,
  buildOwnerMonthlyStatementDispatch,
  buildOverdueEscalationDispatch,
  buildRentReminderDispatch,
} from './automation-dispatch';
import type { AutomationRecipient } from './types/automation.types';

const tenant: AutomationRecipient = { id: 't1', name: 'Tenant One', phone: '+9689', type: 'tenant' };
const owner: AutomationRecipient = { id: 'o1', name: 'Owner One', email: 'o@x.com', type: 'owner' };
const collector: AutomationRecipient = { id: 'u1', name: 'Collector', type: 'user' };

describe('automation dispatch builders (provider-neutral, no send)', () => {
  it('builds a contract-expiry dispatch without attachments or sends', () => {
    const dispatch = buildContractExpiryDispatch({
      ruleId: 'contract-expiry-30',
      channel: 'whatsapp',
      context: { contractId: 'c1', tenantName: 'Tenant One', propertyTitle: 'Bld A', unitNumber: '101', endDate: '2026-08-01' },
      recipient: tenant,
    });
    expect(dispatch.kind).toBe('contract_expiry');
    expect(dispatch.sent).toBe(false);
    expect(dispatch.recipients).toHaveLength(1);
    expect(dispatch.attachments).toHaveLength(0);
    expect(dispatch.templateVariables).toMatchObject({ tenant_name: 'Tenant One', end_date: '2026-08-01' });
  });

  it('builds a rent-reminder dispatch with an invoice attachment', () => {
    const dispatch = buildRentReminderDispatch({
      ruleId: 'rent-reminder-due',
      channel: 'whatsapp',
      context: { invoiceId: 'inv1', dueDate: '2026-07-15', amount: 500, tenantName: 'Tenant One', unitNumber: '101' },
      recipient: tenant,
    });
    expect(dispatch.kind).toBe('rent_reminder');
    expect(dispatch.attachments).toEqual([{ kind: 'invoice', refId: 'inv1' }]);
    expect(dispatch.templateVariables.amount).toBe(500);
  });

  it('adds a collector recipient for overdue escalation', () => {
    const dispatch = buildOverdueEscalationDispatch({
      ruleId: 'rent-overdue-escalation',
      channel: 'email',
      context: { invoiceId: 'inv2', dueDate: '2026-06-01', amount: 800, tenantName: 'Tenant One', unitNumber: '101', daysOverdue: 10 },
      recipient: tenant,
      collector,
    });
    expect(dispatch.kind).toBe('overdue_escalation');
    expect(dispatch.recipients).toHaveLength(2);
    expect(dispatch.templateVariables.days_overdue).toBe(10);
  });

  it('builds an owner monthly statement dispatch with an owner_statement attachment', () => {
    const dispatch = buildOwnerMonthlyStatementDispatch({
      ruleId: 'owner-monthly-report',
      channel: 'email',
      context: { ownerId: 'o1', ownerName: 'Owner One', periodFrom: '2026-06-01', periodTo: '2026-06-30', collected: 1000, expenses: 200, net: 800, occupancy: 95 },
      recipient: owner,
    });
    expect(dispatch.kind).toBe('owner_monthly_statement');
    expect(dispatch.attachments).toEqual([{ kind: 'owner_statement', refId: 'o1' }]);
    expect(dispatch.templateVariables).toMatchObject({ owner_name: 'Owner One', collected: 1000, net: 800, occupancy: 95 });
  });
});
