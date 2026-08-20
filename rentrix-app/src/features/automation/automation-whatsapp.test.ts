import { describe, expect, it } from "vitest";
import {
  buildRentReminderDispatch,
  buildOverdueEscalationDispatch,
} from "./automation-dispatch";
import {
  buildAutomationWhatsAppPreview,
  buildTemplateWhatsAppDemoUrl,
  renderAutomationWhatsAppMessage,
} from "./automation-whatsapp";
import { automationTemplatePreviews } from "./automation-catalog";
import type { AutomationRecipient } from "./types/automation.types";

const tenant: AutomationRecipient = {
  id: "tenant-1",
  name: "أحمد علي",
  phone: "+968 9000 0000",
  type: "tenant",
};

describe("automation external-channel safety", () => {
  it("renders generic local copy and never creates a URL containing recipient or content", () => {
    const dispatch = buildRentReminderDispatch({
      ruleId: "rent-reminder-due",
      channel: "whatsapp",
      context: {
        invoiceId: "inv-1",
        dueDate: "2026-07-31",
        amount: 250,
        tenantName: "أحمد علي",
        unitNumber: "A-1",
      },
      recipient: tenant,
      preparedAt: "2026-07-25T00:00:00.000Z",
    });

    const preview = buildAutomationWhatsAppPreview(dispatch);
    expect(preview).toMatchObject({
      accepted: false,
      reason: "external_provider_disabled",
    });
    expect(preview.message).not.toContain("أحمد علي");
    expect(preview.message).not.toContain("A-1");
    expect(preview.message).not.toContain("250");
    expect(preview).not.toHaveProperty("previewUrl");
    expect(dispatch.sent).toBe(false);
  });

  it("classifies non-WhatsApp and missing-phone dispatches safely", () => {
    const emailDispatch = buildOverdueEscalationDispatch({
      ruleId: "rent-overdue-escalation",
      channel: "email",
      context: {
        invoiceId: "inv-2",
        dueDate: "2026-07-01",
        amount: 400,
        tenantName: "أحمد علي",
        unitNumber: "A-1",
        daysOverdue: 12,
      },
      recipient: tenant,
    });
    expect(buildAutomationWhatsAppPreview(emailDispatch)).toMatchObject({
      accepted: false,
      reason: "unsupported_channel",
    });

    const noPhone = buildRentReminderDispatch({
      ruleId: "rent-reminder-due",
      channel: "whatsapp",
      context: {
        invoiceId: "inv-3",
        dueDate: "2026-07-31",
        amount: 250,
        tenantName: "أحمد علي",
        unitNumber: "A-1",
      },
      recipient: { ...tenant, phone: "" },
    });
    expect(buildAutomationWhatsAppPreview(noPhone)).toMatchObject({
      accepted: false,
      reason: "missing_phone",
    });
  });

  it("disables demo URLs for every template", () => {
    for (const template of automationTemplatePreviews)
      expect(buildTemplateWhatsAppDemoUrl(template)).toBeNull();
  });

  it("never falls back to dumping dispatch variables", () => {
    const dispatch = buildRentReminderDispatch({
      ruleId: "custom-rent",
      channel: "whatsapp",
      context: {
        invoiceId: "inv-4",
        dueDate: "2026-07-31",
        amount: 1,
        tenantName: "أحمد",
        unitNumber: "A-2",
      },
      recipient: tenant,
    });
    const message = renderAutomationWhatsAppMessage({
      ...dispatch,
      kind: "owner_monthly_statement",
    });
    expect(message).not.toContain("tenant_name");
    expect(message).not.toContain("inv-4");
  });
});
