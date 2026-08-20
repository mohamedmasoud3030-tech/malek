import {
  PreviewCommunicationAdapter,
  communicationTemplates,
  prepareCommunicationPreview,
  type CommunicationEventType,
  type CommunicationLocale,
  type CommunicationPreviewResult,
  type CommunicationProviderAdapter,
} from "../communication-system";

/**
 * Provider-neutral outbound boundary.
 *
 * External channels are preview-only. No recipient, body or subject is put in
 * a URL, browser log or provider call. A live adapter requires a separately
 * approved server-side implementation.
 */
export type OutboundChannel = "whatsapp" | "email" | "sms";

export type OutboundMessageRequest = Readonly<{
  channel: OutboundChannel;
  to: string;
  subject?: string;
  body: string;
  templateId?: string;
  variables?: Record<string, string>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  locale?: CommunicationLocale;
  consentGranted?: boolean;
  humanReviewed?: boolean;
}>;

export type OutboundMessageResult = Readonly<{
  accepted: boolean;
  provider: "local-preview";
  mode: "preview";
  preview?: Pick<
    CommunicationPreviewResult,
    "subject" | "body" | "templateKey" | "templateVersion"
  >;
  message: string;
}>;

export const outboundProviderCapabilities = [
  {
    channel: "whatsapp",
    provider: "local-preview",
    mode: "preview",
    configured: true,
    live: false,
  },
  {
    channel: "email",
    provider: "local-preview",
    mode: "preview",
    configured: true,
    live: false,
  },
  {
    channel: "sms",
    provider: "none",
    mode: "disabled",
    configured: false,
    live: false,
  },
] as const;

export function getOutboundProviderCapability(channel: OutboundChannel) {
  return outboundProviderCapabilities.find(
    (capability) => capability.channel === channel,
  );
}

export type NotificationTemplate = Readonly<{
  id: string;
  name: string;
  channel: OutboundChannel | "in_app";
  eventType: CommunicationEventType;
  subject?: string;
  body: string;
  variables: readonly string[];
  locale: CommunicationLocale;
  version: number;
}>;

const compatibilityTemplates = [
  {
    id: "whatsapp-rent-reminder",
    name: "تذكير استحقاق عبر واتساب",
    channel: "whatsapp",
    eventType: "RENT_DUE_REMINDER",
  },
  {
    id: "email-owner-statement",
    name: "جاهزية ملخص المالك بالبريد",
    channel: "email",
    eventType: "OWNER_STATEMENT_READY",
  },
  {
    id: "whatsapp-contract-renewal",
    name: "متابعة عقد عبر واتساب",
    channel: "whatsapp",
    eventType: "CONTRACT_EXPIRING",
  },
  {
    id: "email-payment-receipt",
    name: "تحديث التحصيل بالبريد",
    channel: "email",
    eventType: "PAYMENT_RECEIPT_POSTED",
  },
] as const;

export const notificationTemplates: readonly NotificationTemplate[] =
  compatibilityTemplates.flatMap((entry) =>
    (["ar", "en"] as const).map((locale) => {
      const canonical = communicationTemplates.find(
        (template) =>
          template.eventType === entry.eventType &&
          template.channel === entry.channel &&
          template.locale === locale,
      );
      if (!canonical)
        throw new Error(
          `Missing communication template: ${entry.eventType}/${entry.channel}/${locale}`,
        );
      return {
        ...entry,
        id: locale === "ar" ? entry.id : `${entry.id}-en`,
        subject: canonical.subject,
        body: canonical.body,
        variables: [],
        locale,
        version: canonical.version,
      };
    }),
  );

const previewAdapter: CommunicationProviderAdapter =
  new PreviewCommunicationAdapter();

function resultMessage(result: CommunicationPreviewResult): string {
  switch (result.reason) {
    case "CONSENT_REQUIRED":
      return "يجب تأكيد موافقة المستلم قبل تجهيز معاينة لقناة خارجية.";
    case "HUMAN_REVIEW_REQUIRED":
      return "تتطلب هذه الرسالة مراجعة بشرية قبل تجهيز المعاينة.";
    case "PREFERENCE_DISABLED":
      return "تفضيل هذه القناة غير مفعّل للمستلم.";
    case "QUIET_HOURS":
      return "تقع المعاينة ضمن ساعات الهدوء المحددة.";
    case "RECIPIENT_INVALID":
      return "بيانات المستلم غير صالحة لهذه القناة.";
    default:
      return "القناة أو الحدث غير مسموح بهما.";
  }
}

export async function sendOutboundMessage(
  request: OutboundMessageRequest,
): Promise<OutboundMessageResult> {
  if (request.channel === "sms") {
    return {
      accepted: false,
      provider: "local-preview",
      mode: "preview",
      message: "قناة SMS غير مفعّلة أو مبررة في هذه البيئة.",
    };
  }
  const template =
    notificationTemplates.find(
      (candidate) => candidate.id === request.templateId,
    ) ??
    notificationTemplates.find(
      (candidate) =>
        candidate.channel === request.channel &&
        candidate.locale === (request.locale ?? "ar"),
    );
  if (!template || template.channel === "in_app") {
    return {
      accepted: false,
      provider: "local-preview",
      mode: "preview",
      message: "القالب المحدد غير صالح لهذه القناة.",
    };
  }

  const result = await previewAdapter.prepare({
    eventType: template.eventType,
    channel: request.channel,
    locale: template.locale,
    recipient: request.to,
    consentGranted: request.consentGranted === true,
    humanReviewed: request.humanReviewed === true,
    preference: {
      enabled: true,
      locale: template.locale,
      timezone: "Asia/Muscat",
      quietHoursStart: 0,
      quietHoursEnd: 0,
    },
  });
  if (!result.accepted) {
    return {
      accepted: false,
      provider: "local-preview",
      mode: "preview",
      message: resultMessage(result),
    };
  }
  return {
    accepted: true,
    provider: "local-preview",
    mode: "preview",
    preview: {
      subject: result.subject,
      body: result.body,
      templateKey: result.templateKey,
      templateVersion: result.templateVersion,
    },
    message:
      "تم تجهيز معاينة محلية فقط. لم تُفتح قناة خارجية ولم تُرسل أي رسالة.",
  };
}

export function listNotificationTemplates(
  channel?: NotificationTemplate["channel"],
  locale: CommunicationLocale = "ar",
) {
  return notificationTemplates.filter(
    (template) =>
      template.locale === locale && (!channel || template.channel === channel),
  );
}

// Exported for focused contract tests without invoking an adapter.
export { prepareCommunicationPreview };
