export type CommunicationChannel =
  | "in_app"
  | "email"
  | "whatsapp"
  | "sms"
  | "push";
export type CommunicationLocale = "ar" | "en";
export type CommunicationPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
export type CommunicationEventType =
  | "ACCESS_DECISION"
  | "SUPPORT_STATUS_CHANGED"
  | "PAYMENT_RECEIPT_POSTED"
  | "PAYMENT_RESULT_UNCERTAIN"
  | "CONTRACT_EXPIRING"
  | "RENT_DUE_REMINDER"
  | "OVERDUE_FOLLOW_UP"
  | "MAINTENANCE_URGENT"
  | "OWNER_STATEMENT_READY";

export type CommunicationEventPolicy = Readonly<{
  eventType: CommunicationEventType;
  classification: "TRANSACTIONAL" | "OPTIONAL_OPERATIONAL";
  priority: CommunicationPriority;
  channels: readonly CommunicationChannel[];
  mandatoryInApp: boolean;
  externalRequiresConsent: boolean;
  externalRequiresHumanReview: boolean;
  dedupeWindowHours: number;
  maxPerRecipientPerDay: number;
  quietHoursApply: boolean;
  deepLink: string;
}>;

export const communicationEventPolicies: readonly CommunicationEventPolicy[] = [
  {
    eventType: "ACCESS_DECISION",
    classification: "TRANSACTIONAL",
    priority: "HIGH",
    channels: ["in_app"],
    mandatoryInApp: true,
    externalRequiresConsent: false,
    externalRequiresHumanReview: false,
    dedupeWindowHours: 24,
    maxPerRecipientPerDay: 5,
    quietHoursApply: false,
    deepLink: "/settings?section=users-permissions",
  },
  {
    eventType: "SUPPORT_STATUS_CHANGED",
    classification: "TRANSACTIONAL",
    priority: "NORMAL",
    channels: ["in_app"],
    mandatoryInApp: true,
    externalRequiresConsent: false,
    externalRequiresHumanReview: false,
    dedupeWindowHours: 1,
    maxPerRecipientPerDay: 10,
    quietHoursApply: false,
    deepLink: "/help",
  },
  {
    eventType: "PAYMENT_RECEIPT_POSTED",
    classification: "TRANSACTIONAL",
    priority: "HIGH",
    channels: ["in_app", "email", "whatsapp"],
    mandatoryInApp: true,
    externalRequiresConsent: true,
    externalRequiresHumanReview: true,
    dedupeWindowHours: 168,
    maxPerRecipientPerDay: 3,
    quietHoursApply: true,
    deepLink: "/financials?section=collections&view=receipts",
  },
  {
    eventType: "PAYMENT_RESULT_UNCERTAIN",
    classification: "TRANSACTIONAL",
    priority: "CRITICAL",
    channels: ["in_app"],
    mandatoryInApp: true,
    externalRequiresConsent: false,
    externalRequiresHumanReview: false,
    dedupeWindowHours: 24,
    maxPerRecipientPerDay: 5,
    quietHoursApply: false,
    deepLink: "/financials?section=collections&view=receipts",
  },
  {
    eventType: "CONTRACT_EXPIRING",
    classification: "OPTIONAL_OPERATIONAL",
    priority: "NORMAL",
    channels: ["in_app", "email", "whatsapp"],
    mandatoryInApp: false,
    externalRequiresConsent: true,
    externalRequiresHumanReview: true,
    dedupeWindowHours: 168,
    maxPerRecipientPerDay: 1,
    quietHoursApply: true,
    deepLink: "/contracts",
  },
  {
    eventType: "RENT_DUE_REMINDER",
    classification: "OPTIONAL_OPERATIONAL",
    priority: "NORMAL",
    channels: ["email", "whatsapp"],
    mandatoryInApp: false,
    externalRequiresConsent: true,
    externalRequiresHumanReview: true,
    dedupeWindowHours: 72,
    maxPerRecipientPerDay: 1,
    quietHoursApply: true,
    deepLink: "/financials?section=collections&view=invoices",
  },
  {
    eventType: "OVERDUE_FOLLOW_UP",
    classification: "OPTIONAL_OPERATIONAL",
    priority: "HIGH",
    channels: ["in_app", "email", "whatsapp"],
    mandatoryInApp: false,
    externalRequiresConsent: true,
    externalRequiresHumanReview: true,
    dedupeWindowHours: 168,
    maxPerRecipientPerDay: 1,
    quietHoursApply: true,
    deepLink: "/financials?section=collections&view=arrears",
  },
  {
    eventType: "MAINTENANCE_URGENT",
    classification: "TRANSACTIONAL",
    priority: "HIGH",
    channels: ["in_app"],
    mandatoryInApp: true,
    externalRequiresConsent: false,
    externalRequiresHumanReview: false,
    dedupeWindowHours: 24,
    maxPerRecipientPerDay: 5,
    quietHoursApply: false,
    deepLink: "/maintenance",
  },
  {
    eventType: "OWNER_STATEMENT_READY",
    classification: "OPTIONAL_OPERATIONAL",
    priority: "NORMAL",
    channels: ["in_app", "email"],
    mandatoryInApp: false,
    externalRequiresConsent: true,
    externalRequiresHumanReview: true,
    dedupeWindowHours: 672,
    maxPerRecipientPerDay: 1,
    quietHoursApply: true,
    deepLink: "/reports",
  },
] as const;

export type CommunicationTemplate = Readonly<{
  key: string;
  version: number;
  eventType: CommunicationEventType;
  channel: CommunicationChannel;
  locale: CommunicationLocale;
  subject?: string;
  body: string;
}>;

const copy: Readonly<
  Record<
    CommunicationEventType,
    Readonly<Record<CommunicationLocale, { subject?: string; body: string }>>
  >
> = {
  ACCESS_DECISION: {
    ar: {
      body: "تم تحديث حالة طلب صلاحية. راجع قسم المستخدمين والصلاحيات داخل MALEK.",
    },
    en: {
      body: "A permission request status changed. Review Users & Permissions inside MALEK.",
    },
  },
  SUPPORT_STATUS_CHANGED: {
    ar: { body: "تم تحديث حالة طلب دعم. راجع المساعدة والدعم داخل MALEK." },
    en: {
      body: "A support request status changed. Review Help & Support inside MALEK.",
    },
  },
  PAYMENT_RECEIPT_POSTED: {
    ar: {
      subject: "تحديث حالة تحصيل",
      body: "تم تحديث حالة تحصيل. راجع الإيصال من المسار المعتمد قبل اتخاذ أي إجراء.",
    },
    en: {
      subject: "Collection status update",
      body: "A collection status changed. Review the official receipt before taking action.",
    },
  },
  PAYMENT_RESULT_UNCERTAIN: {
    ar: {
      body: "نتيجة عملية تحصيل تحتاج مراجعة. لا تكرر العملية قبل التحقق من السجل المعتمد.",
    },
    en: {
      body: "A collection result needs review. Do not repeat the action before checking the official record.",
    },
  },
  CONTRACT_EXPIRING: {
    ar: {
      subject: "متابعة عقد",
      body: "يوجد عقد يقترب من نهايته. راجع ملف العقد قبل بدء أي إجراء تجديد.",
    },
    en: {
      subject: "Contract follow-up",
      body: "A contract is approaching its end date. Review the contract before starting renewal.",
    },
  },
  RENT_DUE_REMINDER: {
    ar: {
      subject: "تذكير باستحقاق",
      body: "هذا تذكير عام بوجود استحقاق قادم. تحقق من السجل أو تواصل مع المكتب عبر القناة المعتمدة.",
    },
    en: {
      subject: "Due-date reminder",
      body: "This is a general reminder about an upcoming amount due. Check the official record or contact the office.",
    },
  },
  OVERDUE_FOLLOW_UP: {
    ar: {
      subject: "متابعة استحقاق",
      body: "يوجد استحقاق يحتاج متابعة. تحقق من السجل المعتمد قبل الرد أو السداد.",
    },
    en: {
      subject: "Amount due follow-up",
      body: "An amount due needs follow-up. Check the official record before responding or paying.",
    },
  },
  MAINTENANCE_URGENT: {
    ar: { body: "يوجد طلب صيانة عاجل يحتاج متابعة داخل MALEK." },
    en: { body: "An urgent maintenance request needs attention inside MALEK." },
  },
  OWNER_STATEMENT_READY: {
    ar: {
      subject: "ملخص دوري جاهز",
      body: "أصبح ملخص دوري جاهزاً للمراجعة عبر المسار المعتمد. لا تعتمد على معاينة الرسالة ككشف حساب.",
    },
    en: {
      subject: "Periodic summary ready",
      body: "A periodic summary is ready through the official workflow. Do not treat this preview as a statement.",
    },
  },
};

export const communicationTemplates: readonly CommunicationTemplate[] =
  communicationEventPolicies.flatMap((policy) =>
    policy.channels.flatMap((channel) =>
      (["ar", "en"] as const).map((locale) => ({
        key: `${policy.eventType.toLowerCase()}.${channel}.${locale}`,
        version: 1,
        eventType: policy.eventType,
        channel,
        locale,
        ...copy[policy.eventType][locale],
      })),
    ),
  );

export type CommunicationPreference = Readonly<{
  enabled: boolean;
  locale: CommunicationLocale;
  timezone: string;
  quietHoursStart: number;
  quietHoursEnd: number;
}>;

export type CommunicationPreviewRequest = Readonly<{
  eventType: CommunicationEventType;
  channel: CommunicationChannel;
  locale: CommunicationLocale;
  recipient: string;
  consentGranted: boolean;
  humanReviewed: boolean;
  preference?: CommunicationPreference;
  now?: Date;
}>;

export type CommunicationPreviewResult = Readonly<{
  accepted: boolean;
  mode: "preview";
  templateKey?: string;
  templateVersion?: number;
  subject?: string;
  body?: string;
  reason?:
    | "CHANNEL_NOT_ALLOWED"
    | "PROVIDER_DISABLED"
    | "CONSENT_REQUIRED"
    | "HUMAN_REVIEW_REQUIRED"
    | "PREFERENCE_DISABLED"
    | "QUIET_HOURS"
    | "RECIPIENT_INVALID";
}>;

export const communicationProviderCapabilities = [
  { channel: "in_app", mode: "internal", enabled: true, unitCostUsd: 0 },
  { channel: "email", mode: "preview", enabled: false, unitCostUsd: null },
  { channel: "whatsapp", mode: "preview", enabled: false, unitCostUsd: null },
  { channel: "sms", mode: "disabled", enabled: false, unitCostUsd: null },
  { channel: "push", mode: "disabled", enabled: false, unitCostUsd: null },
] as const;

function isValidRecipient(
  channel: CommunicationChannel,
  recipient: string,
): boolean {
  if (channel === "in_app") return /^[0-9a-f-]{36}$/i.test(recipient);
  if (channel === "email")
    return (
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) && recipient.length <= 254
    );
  if (channel === "whatsapp" || channel === "sms")
    return /^\+?[1-9]\d{7,14}$/.test(recipient.replace(/[\s-]/g, ""));
  return false;
}

export function isWithinQuietHours(
  now: Date,
  preference: CommunicationPreference,
): boolean {
  const hourPart = new Intl.DateTimeFormat("en-GB", {
    timeZone: preference.timezone,
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart ?? now.getUTCHours());
  const { quietHoursStart: start, quietHoursEnd: end } = preference;
  return start === end
    ? false
    : start > end
      ? hour >= start || hour < end
      : hour >= start && hour < end;
}

export function prepareCommunicationPreview(
  request: CommunicationPreviewRequest,
): CommunicationPreviewResult {
  const policy = communicationEventPolicies.find(
    (candidate) => candidate.eventType === request.eventType,
  );
  if (!policy || !policy.channels.includes(request.channel))
    return { accepted: false, mode: "preview", reason: "CHANNEL_NOT_ALLOWED" };
  if (!isValidRecipient(request.channel, request.recipient))
    return { accepted: false, mode: "preview", reason: "RECIPIENT_INVALID" };
  if (request.channel !== "in_app") {
    if (!request.consentGranted)
      return { accepted: false, mode: "preview", reason: "CONSENT_REQUIRED" };
    if (policy.externalRequiresHumanReview && !request.humanReviewed)
      return {
        accepted: false,
        mode: "preview",
        reason: "HUMAN_REVIEW_REQUIRED",
      };
    if (!request.preference?.enabled)
      return {
        accepted: false,
        mode: "preview",
        reason: "PREFERENCE_DISABLED",
      };
    if (
      policy.quietHoursApply &&
      request.preference &&
      isWithinQuietHours(request.now ?? new Date(), request.preference)
    ) {
      return { accepted: false, mode: "preview", reason: "QUIET_HOURS" };
    }
  }
  const template = communicationTemplates.find(
    (candidate) =>
      candidate.eventType === request.eventType &&
      candidate.channel === request.channel &&
      candidate.locale === request.locale,
  );
  if (!template)
    return { accepted: false, mode: "preview", reason: "CHANNEL_NOT_ALLOWED" };
  return {
    accepted: true,
    mode: "preview",
    templateKey: template.key,
    templateVersion: template.version,
    subject: template.subject,
    body: template.body,
  };
}

export type ProviderFailureClass =
  | "NETWORK"
  | "RATE_LIMIT"
  | "SERVER"
  | "AUTH"
  | "INVALID_RECIPIENT"
  | "REJECTED";
export function getCommunicationRetryDecision(
  attemptCount: number,
  failure: ProviderFailureClass,
) {
  const transient =
    failure === "NETWORK" || failure === "RATE_LIMIT" || failure === "SERVER";
  const delaysSeconds = [60, 300, 1_800] as const;
  if (!transient || attemptCount >= delaysSeconds.length)
    return { retry: false, delaySeconds: null } as const;
  return { retry: true, delaySeconds: delaysSeconds[attemptCount] } as const;
}

export interface CommunicationProviderAdapter {
  readonly id: string;
  readonly mode: "preview" | "live";
  prepare(
    request: CommunicationPreviewRequest,
  ): Promise<CommunicationPreviewResult>;
}

export class PreviewCommunicationAdapter implements CommunicationProviderAdapter {
  readonly id = "local-preview";
  readonly mode = "preview" as const;
  async prepare(
    request: CommunicationPreviewRequest,
  ): Promise<CommunicationPreviewResult> {
    return prepareCommunicationPreview(request);
  }
}
