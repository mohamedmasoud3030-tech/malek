import type { AutomationChannel } from './types';
import type {
  AutomationDispatch,
  AutomationDispatchAttachment,
  AutomationDispatchKind,
  AutomationRecipient,
} from './types/automation.types';

/**
 * Provider-neutral automation dispatch builders.
 *
 * These assemble a structured {@link AutomationDispatch} payload from domain
 * context for the four foundational automations (contract-expiry reminders,
 * rent reminders, overdue escalation, owner monthly statements). They perform
 * NO network calls and never touch a notification provider — they are the
 * architecture-only preparation layer a future worker/gateway consumes.
 */

export type ContractExpiryContext = {
  contractId: string;
  tenantName: string;
  propertyTitle: string;
  unitNumber: string;
  endDate: string;
};

export type RentReminderContext = {
  invoiceId: string;
  dueDate: string;
  amount: number;
  tenantName: string;
  unitNumber: string;
};

export type OverdueEscalationContext = {
  invoiceId: string;
  dueDate: string;
  amount: number;
  tenantName: string;
  unitNumber: string;
  daysOverdue: number;
};

export type OwnerMonthlyStatementContext = {
  ownerId: string;
  ownerName: string;
  periodFrom: string;
  periodTo: string;
  collected: number;
  expenses: number;
  net: number;
  occupancy: number;
};

function buildDispatch(params: {
  kind: AutomationDispatchKind;
  ruleId: string;
  channel: AutomationChannel;
  recipients: AutomationRecipient[];
  templateVariables: Record<string, string | number>;
  attachments: AutomationDispatchAttachment[];
  preparedAt?: string;
}): AutomationDispatch {
  return {
    kind: params.kind,
    ruleId: params.ruleId,
    channel: params.channel,
    recipients: params.recipients,
    templateVariables: params.templateVariables,
    attachments: params.attachments,
    preparedAt: params.preparedAt ?? new Date().toISOString(),
    sent: false,
  };
}

export function buildContractExpiryDispatch(params: {
  ruleId: string;
  channel: AutomationChannel;
  context: ContractExpiryContext;
  recipient: AutomationRecipient;
  preparedAt?: string;
}): AutomationDispatch {
  const { ruleId, channel, context, recipient, preparedAt } = params;
  return buildDispatch({
    kind: 'contract_expiry',
    ruleId,
    channel,
    recipients: [recipient],
    templateVariables: {
      tenant_name: context.tenantName,
      property_title: context.propertyTitle,
      unit_number: context.unitNumber,
      end_date: context.endDate,
    },
    attachments: [],
    preparedAt,
  });
}

export function buildRentReminderDispatch(params: {
  ruleId: string;
  channel: AutomationChannel;
  context: RentReminderContext;
  recipient: AutomationRecipient;
  preparedAt?: string;
}): AutomationDispatch {
  const { ruleId, channel, context, recipient, preparedAt } = params;
  return buildDispatch({
    kind: 'rent_reminder',
    ruleId,
    channel,
    recipients: [recipient],
    templateVariables: {
      tenant_name: context.tenantName,
      unit_number: context.unitNumber,
      due_date: context.dueDate,
      amount: context.amount,
      invoice_id: context.invoiceId,
    },
    attachments: [{ kind: 'invoice', refId: context.invoiceId }],
    preparedAt,
  });
}

export function buildOverdueEscalationDispatch(params: {
  ruleId: string;
  channel: AutomationChannel;
  context: OverdueEscalationContext;
  recipient: AutomationRecipient;
  collector?: AutomationRecipient;
  preparedAt?: string;
}): AutomationDispatch {
  const { ruleId, channel, context, recipient, collector, preparedAt } = params;
  const recipients = collector ? [recipient, collector] : [recipient];
  return buildDispatch({
    kind: 'overdue_escalation',
    ruleId,
    channel,
    recipients,
    templateVariables: {
      tenant_name: context.tenantName,
      unit_number: context.unitNumber,
      due_date: context.dueDate,
      amount: context.amount,
      days_overdue: context.daysOverdue,
      invoice_id: context.invoiceId,
    },
    attachments: [{ kind: 'invoice', refId: context.invoiceId }],
    preparedAt,
  });
}

export function buildOwnerMonthlyStatementDispatch(params: {
  ruleId: string;
  channel: AutomationChannel;
  context: OwnerMonthlyStatementContext;
  recipient: AutomationRecipient;
  preparedAt?: string;
}): AutomationDispatch {
  const { ruleId, channel, context, recipient, preparedAt } = params;
  return buildDispatch({
    kind: 'owner_monthly_statement',
    ruleId,
    channel,
    recipients: [recipient],
    templateVariables: {
      owner_name: context.ownerName,
      period_from: context.periodFrom,
      period_to: context.periodTo,
      collected: context.collected,
      expenses: context.expenses,
      net: context.net,
      occupancy: context.occupancy,
    },
    attachments: [{ kind: 'owner_statement', refId: context.ownerId }],
    preparedAt,
  });
}
