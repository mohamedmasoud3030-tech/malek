import {
  communicationTemplates,
  type CommunicationEventType,
} from "@/features/communication/communication-system";
import type { AutomationTemplatePreview } from "./types";
import type {
  AutomationDispatch,
  AutomationDispatchKind,
} from "./types/automation.types";

export type AutomationWhatsAppPreview = Readonly<{
  accepted: boolean;
  message: string;
  reason:
    | "unsupported_channel"
    | "missing_phone"
    | "external_provider_disabled";
}>;

const eventByDispatchKind: Record<
  AutomationDispatchKind,
  CommunicationEventType
> = {
  contract_expiry: "CONTRACT_EXPIRING",
  rent_reminder: "RENT_DUE_REMINDER",
  overdue_escalation: "OVERDUE_FOLLOW_UP",
  owner_monthly_statement: "OWNER_STATEMENT_READY",
};

/** Renders only canonical generic copy; dispatch variables and attachments are intentionally ignored. */
export function renderAutomationWhatsAppMessage(
  dispatch: AutomationDispatch,
): string {
  return (
    communicationTemplates.find(
      (template) =>
        template.eventType === eventByDispatchKind[dispatch.kind] &&
        template.channel === "whatsapp" &&
        template.locale === "ar",
    )?.body ?? "يوجد تحديث تشغيلي. راجع المسار المعتمد داخل MALEK."
  );
}

export function buildAutomationWhatsAppPreview(
  dispatch: AutomationDispatch,
): AutomationWhatsAppPreview {
  const message = renderAutomationWhatsAppMessage(dispatch);
  if (dispatch.channel !== "whatsapp")
    return { accepted: false, message, reason: "unsupported_channel" };
  if (
    !dispatch.recipients.some((candidate) => Boolean(candidate.phone?.trim()))
  ) {
    return { accepted: false, message, reason: "missing_phone" };
  }
  return {
    accepted: false,
    message,
    reason: "external_provider_disabled",
  };
}

/** External URLs are prohibited in preview mode because they expose recipient/content in the URL. */
export function buildTemplateWhatsAppDemoUrl(
  _template: AutomationTemplatePreview,
): null {
  return null;
}
