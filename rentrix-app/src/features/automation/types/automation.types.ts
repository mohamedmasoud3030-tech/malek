/**
 * Automation Types and Interfaces
 * Ready for backend integration with automation_rules, automation_runs, and automation_logs tables
 */

// ============================================================
// Core Types
// ============================================================

export type AutomationChannel = 'whatsapp' | 'email' | 'in_app' | 'sms';
export type AutomationStatus = 'active' | 'paused' | 'draft';
export type AutomationTriggerType = 
  | 'contract_expiring'
  | 'contract_renewed'
  | 'contract_terminated'
  | 'rent_due'
  | 'rent_overdue'
  | 'invoice_generated'
  | 'payment_received'
  | 'maintenance_created'
  | 'maintenance_resolved'
  | 'owner_statement_ready'
  | 'manual';

export type AutomationCategory = 
  | 'contracts'
  | 'rent'
  | 'owners'
  | 'maintenance'
  | 'collections';

export type AutomationAudienceType = 
  | 'all_tenants'
  | 'all_owners'
  | 'specific_tenant'
  | 'specific_owner'
  | 'overdue_tenants'
  | 'expiring_contract_tenants';

// ============================================================
// Automation Rule Interface
// ============================================================

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  category: AutomationCategory;
  channel: AutomationChannel;
  trigger: AutomationTriggerType;
  trigger_label: string;
  audience: AutomationAudienceType;
  audience_label: string;
  status: AutomationStatus;
  template_id: string;
  config: AutomationConfig;
  created_at: string;
  updated_at: string;
}

export interface AutomationConfig {
  /** Days before/after trigger event */
  days_offset?: number;
  /** Custom filter criteria */
  filter_criteria?: Record<string, unknown>;
  /** Enable/disable specific channels */
  channels_enabled?: Record<AutomationChannel, boolean>;
  /** Include attachments (PDFs, statements) */
  include_attachments?: boolean;
  /** Schedule settings */
  schedule?: {
    enabled: boolean;
    cron?: string;
    time?: string;
    days?: number[];
  };
}

// ============================================================
// Template Interface
// ============================================================

export interface AutomationTemplate {
  id: string;
  name: string;
  channel: AutomationChannel;
  subject?: string;
  body: string;
  variables: string[];
  category: AutomationCategory;
}

// ============================================================
// Execution Types
// ============================================================

export interface AutomationRun {
  id: string;
  rule_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  triggered_by: AutomationTriggerType;
  recipients_count: number;
  success_count: number;
  failure_count: number;
  error_message?: string;
}

export interface AutomationLog {
  id: string;
  run_id: string;
  rule_id: string;
  recipient_id: string;
  recipient_type: 'tenant' | 'owner' | 'user';
  recipient_name: string;
  recipient_phone?: string;
  recipient_email?: string;
  channel: AutomationChannel;
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  sent_at?: string;
  delivered_at?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// API Response Types
// ============================================================

export interface AutomationListResponse {
  rules: AutomationRule[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AutomationStatsResponse {
  total_rules: number;
  active_rules: number;
  paused_rules: number;
  total_runs: number;
  runs_today: number;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
}

export interface AutomationExecutionResponse {
  run_id: string;
  status: 'pending' | 'running';
  estimated_recipients: number;
}

// ============================================================
// Trigger Definitions
// ============================================================

export interface TriggerDefinition {
  type: AutomationTriggerType;
  label: string;
  description: string;
  icon: string;
  category: AutomationCategory;
}

export const TRIGGER_DEFINITIONS: TriggerDefinition[] = [
  {
    type: 'contract_expiring',
    label: 'تذكير بانتهاء العقد',
    description: 'يُرسل قبل انتهاء العقد بفترة محددة',
    icon: 'CalendarClock',
    category: 'contracts',
  },
  {
    type: 'contract_renewed',
    label: 'تم تجديد العقد',
    description: 'يُرسل عند تجديد عقد جديد',
    icon: 'RefreshCw',
    category: 'contracts',
  },
  {
    type: 'contract_terminated',
    label: 'تم إنهاء العقد',
    description: 'يُرسل عند إنهاء عقد مستأجر',
    icon: 'XCircle',
    category: 'contracts',
  },
  {
    type: 'rent_due',
    label: 'استحقاق الإيجار',
    description: 'يُرسل عند حلول موعد الإيجار',
    icon: 'Calendar',
    category: 'rent',
  },
  {
    type: 'rent_overdue',
    label: 'تأخر في الإيجار',
    description: 'يُرسل عند تأخر المستأجر عن السداد',
    icon: 'AlertCircle',
    category: 'collections',
  },
  {
    type: 'invoice_generated',
    label: 'تم إصدار فاتورة',
    description: 'يُرسل عند إنشاء فاتورة جديدة',
    icon: 'FileText',
    category: 'rent',
  },
  {
    type: 'payment_received',
    label: 'تم استلام دفعة',
    description: 'يُرسل عند تسجيل دفعة مالية',
    icon: 'CheckCircle',
    category: 'rent',
  },
  {
    type: 'maintenance_created',
    label: 'طلب صيانة جديد',
    description: 'يُرسل عند إنشاء طلب صيانة',
    icon: 'Wrench',
    category: 'maintenance',
  },
  {
    type: 'maintenance_resolved',
    label: 'تم حل طلب الصيانة',
    description: 'يُرسل عند إغلاق طلب صيانة',
    icon: 'CheckCircle2',
    category: 'maintenance',
  },
  {
    type: 'owner_statement_ready',
    label: 'كشف حساب المالك جاهز',
    description: 'يُرسل عند جاهزية كشف حساب المالك',
    icon: 'Mail',
    category: 'owners',
  },
];

// ============================================================
// Audience Definitions
// ============================================================

export interface AudienceDefinition {
  type: AutomationAudienceType;
  label: string;
  description: string;
}

export const AUDIENCE_DEFINITIONS: AudienceDefinition[] = [
  {
    type: 'all_tenants',
    label: 'جميع المستأجرين',
    description: 'يرسل لجميع المستأجرين النشطين',
  },
  {
    type: 'all_owners',
    label: 'جميع الملاك',
    description: 'يرسل لجميع المالكين النشطين',
  },
  {
    type: 'overdue_tenants',
    label: 'المستأجرون المتأخرون',
    description: 'يرسل للمستأجرين ذوي الدفعات المتأخرة',
  },
  {
    type: 'expiring_contract_tenants',
    label: 'مستأجرو العقود المنتهية قريباً',
    description: 'يرسل للمستأجرين ذوي العقود القريبة الانتهاء',
  },
];

// ============================================================
// Channel Labels
// ============================================================

export const CHANNEL_LABELS: Record<AutomationChannel, string> = {
  whatsapp: 'واتساب',
  email: 'بريد إلكتروني',
  in_app: 'إشعار داخل النظام',
  sms: 'رسالة نصية',
};

export const STATUS_LABELS: Record<AutomationStatus, string> = {
  active: 'مفعّل',
  paused: 'متوقف',
  draft: 'مسودة',
};

export const CATEGORY_LABELS: Record<AutomationCategory, string> = {
  contracts: 'العقود',
  rent: 'الإيجار',
  owners: 'الملاك',
  maintenance: 'الصيانة',
  collections: 'التحصيل',
};

// ============================================================
// Provider-neutral dispatch (architecture only — no external send)
// ============================================================
//
// The four foundational automations are: contract-expiry reminders, rent
// reminders, overdue escalation, and owner monthly statements. These builders
// assemble a structured, ready-to-send payload from domain context WITHOUT
// touching any notification provider. A future worker/gateway consumes
// AutomationDispatch; nothing here sends a message.

export type AutomationDispatchKind =
  | 'contract_expiry'
  | 'rent_reminder'
  | 'overdue_escalation'
  | 'owner_monthly_statement';

export type AutomationRecipientType = 'tenant' | 'owner' | 'user';

export interface AutomationRecipient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  type: AutomationRecipientType;
}

export type AutomationDispatchAttachmentKind = 'invoice' | 'owner_statement' | 'statement';

export interface AutomationDispatchAttachment {
  kind: AutomationDispatchAttachmentKind;
  refId: string;
}

export interface AutomationDispatch {
  kind: AutomationDispatchKind;
  ruleId: string;
  channel: AutomationChannel;
  recipients: AutomationRecipient[];
  templateVariables: Record<string, string | number>;
  attachments: AutomationDispatchAttachment[];
  /** ISO timestamp when the dispatch was prepared (never sent by this layer). */
  preparedAt: string;
  /** Always false: this layer only prepares; a gateway sends. */
  sent: false;
}
