import { buildWhatsAppUrl, renderMessageTemplate } from '@/services/whatsapp';

/**
 * Outbound communication service boundary.
 *
 * UI components must call this layer (or a future provider adapter) instead of
 * embedding WhatsApp/Email SDKs directly. Implementations can later swap in
 * real providers without rewriting the Communication Center UI.
 */

export type OutboundChannel = 'whatsapp' | 'email' | 'sms';

export type OutboundMessageRequest = Readonly<{
  channel: OutboundChannel;
  to: string;
  subject?: string;
  body: string;
  templateId?: string;
  variables?: Record<string, string>;
  relatedEntityType?: string;
  relatedEntityId?: string;
}>;

export type OutboundMessageResult = Readonly<{
  accepted: boolean;
  provider: 'local-preview' | 'whatsapp-provider' | 'email-provider' | 'sms-provider';
  previewUrl?: string;
  message: string;
}>;

export type OutboundProviderAdapter = Readonly<{
  id: string;
  channel: OutboundChannel;
  mode: 'preview' | 'external';
  prepare: (request: OutboundMessageRequest, body: string) => OutboundMessageResult;
}>;

export const outboundProviderCapabilities: readonly Readonly<{
  channel: OutboundChannel;
  provider: string;
  mode: 'preview' | 'external';
  configured: boolean;
}>[] = [
  { channel: 'whatsapp', provider: 'local-preview', mode: 'preview', configured: true },
  { channel: 'email', provider: 'local-preview', mode: 'preview', configured: true },
  { channel: 'sms', provider: 'sms-provider', mode: 'external', configured: false },
];

export function getOutboundProviderCapability(channel: OutboundChannel) {
  return outboundProviderCapabilities.find((capability) => capability.channel === channel);
}

export type NotificationTemplate = Readonly<{
  id: string;
  name: string;
  channel: OutboundChannel | 'in_app';
  subject?: string;
  body: string;
  variables: readonly string[];
}>;

export const notificationTemplates: readonly NotificationTemplate[] = [
  {
    id: 'whatsapp-rent-reminder',
    name: 'تذكير إيجار عبر واتساب',
    channel: 'whatsapp',
    body: 'مرحباً {{name}}، تذكير باستحقاق إيجار {{unit}} بتاريخ {{date}} بمبلغ {{amount}}.',
    variables: ['name', 'unit', 'date', 'amount'],
  },
  {
    id: 'email-owner-statement',
    name: 'كشف مالك بالبريد',
    channel: 'email',
    subject: 'كشف حساب {{month}} — {{property}}',
    body: 'نرفق ملخص التحصيل والمصروفات لصافي {{net}} عن فترة {{month}}.',
    variables: ['month', 'property', 'net'],
  },
  {
    id: 'whatsapp-contract-renewal',
    name: 'دعوة تجديد عقد',
    channel: 'whatsapp',
    body: 'عقدكم على {{property}} / {{unit}} ينتهي بتاريخ {{end_date}}. هل نبدأ إجراءات التجديد؟',
    variables: ['property', 'unit', 'end_date'],
  },
  {
    id: 'email-payment-receipt',
    name: 'إرسال إيصال تحصيل',
    channel: 'email',
    subject: 'إيصال تحصيل {{receipt_no}}',
    body: 'تم تسجيل دفعتكم بمبلغ {{amount}} بتاريخ {{date}}. رقم الإيصال: {{receipt_no}}.',
    variables: ['amount', 'date', 'receipt_no'],
  },
] as const;

/**
 * Queue/preview an outbound message without binding UI to a paid provider.
 * Current behavior is a local preview adapter suitable for product UX.
 */
export async function sendOutboundMessage(
  request: OutboundMessageRequest,
): Promise<OutboundMessageResult> {
  const body = request.templateId
    ? renderMessageTemplate(
        notificationTemplates.find((template) => template.id === request.templateId)?.body ?? request.body,
        request.variables,
      )
    : request.body;

  if (request.channel === 'whatsapp') {
    if (!request.to.trim()) {
      return {
        accepted: false,
        provider: 'local-preview',
        message: 'رقم واتساب مطلوب قبل إنشاء رابط الإرسال.',
      };
    }

    return {
      accepted: true,
      provider: 'local-preview',
      previewUrl: buildWhatsAppUrl(request.to, body),
      message: 'تم تجهيز رابط واتساب للمعاينة. لم يتم الإرسال التلقائي.',
    };
  }

  if (request.channel === 'email') {
    if (!request.to.trim()) {
      return {
        accepted: false,
        provider: 'local-preview',
        message: 'البريد الإلكتروني مطلوب قبل تجهيز الرسالة.',
      };
    }

    const subject = request.subject ?? 'رسالة من Rentrix';
    const mailto = `mailto:${encodeURIComponent(request.to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return {
      accepted: true,
      provider: 'local-preview',
      previewUrl: mailto,
      message: 'تم تجهيز مسودة البريد. لم يتم الإرسال التلقائي.',
    };
  }

  return {
    accepted: false,
    provider: 'local-preview',
    message: 'قناة الإرسال غير مفعّلة بعد في هذه البيئة.',
  };
}

export function listNotificationTemplates(channel?: NotificationTemplate['channel']) {
  if (!channel) return [...notificationTemplates];
  return notificationTemplates.filter((template) => template.channel === channel);
}
