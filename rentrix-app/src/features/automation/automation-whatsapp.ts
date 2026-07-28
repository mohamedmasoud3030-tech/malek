import { APP_BRAND_NAME } from '@/lib/brand';
import { buildWhatsAppUrl, renderMessageTemplate } from '@/services/whatsapp';
import { automationTemplatePreviews } from './automation-catalog';
import type { AutomationTemplatePreview } from './types';
import type { AutomationDispatch, AutomationDispatchKind, AutomationRecipient } from './types/automation.types';

export type AutomationWhatsAppPreview = Readonly<{
  accepted: boolean;
  recipient: AutomationRecipient | null;
  message: string;
  previewUrl?: string;
  reason?: string;
}>;

const templateByDispatchKind: Record<AutomationDispatchKind, string> = {
  contract_expiry: 'tpl-contract-expiry',
  rent_reminder: 'tpl-rent-reminder',
  overdue_escalation: 'tpl-overdue-escalation',
  owner_monthly_statement: 'tpl-owner-report',
};

const demoTemplateVariables: Record<string, string | number> = {
  tenant_name: 'أحمد علي',
  owner_name: 'مالك العقار',
  unit_number: 'A-1',
  property_title: 'برج صحار',
  due_date: '2026-07-31',
  end_date: '2026-08-30',
  amount: '250.000 ر.ع',
  days_overdue: 7,
  month: 'يوليو 2026',
  collected: '1,250.000 ر.ع',
  expenses: '150.000 ر.ع',
  net: '1,100.000 ر.ع',
  occupancy: '92%',
};

export function getAutomationWhatsAppTemplate(kind: AutomationDispatchKind): AutomationTemplatePreview | undefined {
  const templateId = templateByDispatchKind[kind];
  return automationTemplatePreviews.find((template) => template.id === templateId && template.channel === 'whatsapp');
}

export function renderAutomationWhatsAppMessage(dispatch: AutomationDispatch): string {
  const template = getAutomationWhatsAppTemplate(dispatch.kind);
  const body = template?.body ?? Object.entries(dispatch.templateVariables)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  const attachmentLine = dispatch.attachments.length > 0
    ? `\n\nمرفقات/مستندات مرتبطة متاحة من داخل ${APP_BRAND_NAME}.`
    : '';
  return `${renderMessageTemplate(body, dispatch.templateVariables)}${attachmentLine}`;
}

export function buildAutomationWhatsAppPreview(dispatch: AutomationDispatch): AutomationWhatsAppPreview {
  if (dispatch.channel !== 'whatsapp') {
    return {
      accepted: false,
      recipient: dispatch.recipients[0] ?? null,
      message: 'هذه القاعدة ليست مضبوطة على قناة واتساب.',
      reason: 'unsupported_channel',
    };
  }

  const recipient = dispatch.recipients.find((candidate) => Boolean(candidate.phone?.trim())) ?? null;
  const message = renderAutomationWhatsAppMessage(dispatch);

  if (!recipient?.phone) {
    return {
      accepted: false,
      recipient,
      message,
      reason: 'missing_phone',
    };
  }

  return {
    accepted: true,
    recipient,
    message,
    previewUrl: buildWhatsAppUrl(recipient.phone, message),
  };
}

export function buildTemplateWhatsAppDemoUrl(template: AutomationTemplatePreview): string | null {
  if (template.channel !== 'whatsapp') return null;
  return buildWhatsAppUrl('', renderMessageTemplate(template.body, demoTemplateVariables));
}
