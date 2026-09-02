import type { CommunicationEventType } from '@/features/communication/communication-system';

export type AutomationChannel = 'whatsapp' | 'email' | 'in_app' | 'sms';
export type AutomationStatus = 'active' | 'paused' | 'draft';
export type AutomationFrequency = 'daily' | 'weekly' | 'monthly' | 'on_event';

export type AutomationRule = Readonly<{
  id: string;
  name: string;
  description: string;
  category: 'contracts' | 'rent' | 'owners' | 'maintenance' | 'collections';
  channel: AutomationChannel;
  status: AutomationStatus;
  frequency: AutomationFrequency;
  triggerLabel: string;
  audienceLabel: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  successRate: number;
}>;

export type AutomationTemplatePreview = Readonly<{
  id: string;
  title: string;
  channel: AutomationChannel;
  body: string;
}>;

// ============================================================
// Provider-neutral dispatch intent (salvaged canonical semantics)
// ============================================================
//
// An intent DESCRIBES what the durable worker should deliver — nothing in
// the browser sends messages. Boundaries:
// - Channel, template, consent, quiet hours, and dedupe policy are owned by
//   the communication system (communicationEventPolicies); the mapping below
//   hands each intent kind to its canonical communication event.
// - Recipients are identifier references only. Contact details (phone/email)
//   are resolved server-side by the worker from the canonical person/owner/
//   tenant records — there is intentionally no second contact model here.
// - Attachments are document REFERENCES (e.g. the owner statement for a
//   period). Document generation is owned by the document platform; automation
//   never generates reports itself.
// - owner_monthly_statement is an intent kind, not an automation_rules
//   rule_type: the durable enqueue RPC currently executes contract_expiry /
//   overdue_invoice / maintenance_overdue only. Owner-statement delivery is
//   represented truthfully as a communication intent (OWNER_STATEMENT_READY)
//   until the worker gains a dedicated rule type.

export type AutomationIntentKind =
  | 'contract_expiry'
  | 'rent_reminder'
  | 'overdue_escalation'
  | 'owner_monthly_statement';

/** Identifier-only recipient reference; the worker resolves contact details server-side. */
export type AutomationRecipientRef = Readonly<{
  type: 'tenant' | 'owner' | 'user';
  id: string;
}>;

/** Reference to a document produced by the canonical document platform. */
export type AutomationAttachmentRef = Readonly<{
  kind: 'invoice' | 'owner_statement';
  refId: string;
}>;

export type AutomationDispatchIntent = Readonly<{
  kind: AutomationIntentKind;
  ruleId: string;
  channel: AutomationChannel;
  recipients: readonly AutomationRecipientRef[];
  templateVariables: Readonly<Record<string, string | number>>;
  attachments: readonly AutomationAttachmentRef[];
  /** ISO timestamp when the intent was prepared. Preparation is not delivery. */
  preparedAt: string;
}>;

/**
 * Every intent kind delivers through its canonical communication event, so
 * template copy, channel policy, consent, and human review stay owned by the
 * communication system — never re-implemented inside automation.
 */
export const AUTOMATION_INTENT_COMMUNICATION_EVENT: Readonly<Record<AutomationIntentKind, CommunicationEventType>> = {
  contract_expiry: 'CONTRACT_EXPIRING',
  rent_reminder: 'RENT_DUE_REMINDER',
  overdue_escalation: 'OVERDUE_FOLLOW_UP',
  owner_monthly_statement: 'OWNER_STATEMENT_READY',
};
