import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunicationOutboundPanel } from "../components/communication-outbound-panel";
import {
  listNotificationTemplates,
  sendOutboundMessage,
} from "./outbound-communication-service";

describe("outbound communication preview boundary", () => {
  it("lists versioned Arabic and English templates without provider SDKs", () => {
    const arabic = listNotificationTemplates("whatsapp", "ar");
    const english = listNotificationTemplates("whatsapp", "en");
    expect(arabic.length).toBeGreaterThan(0);
    expect(english).toHaveLength(arabic.length);
    expect(
      arabic.every(
        (template) => template.locale === "ar" && template.version === 1,
      ),
    ).toBe(true);
    expect(english.every((template) => template.locale === "en")).toBe(true);
  });

  it("requires consent and human review before preparing an external preview", async () => {
    const base = {
      channel: "whatsapp" as const,
      to: "+96891234567",
      body: "ignored custom text",
      templateId: "whatsapp-rent-reminder",
    };
    await expect(sendOutboundMessage(base)).resolves.toMatchObject({
      accepted: false,
      mode: "preview",
    });
    await expect(
      sendOutboundMessage({ ...base, consentGranted: true }),
    ).resolves.toMatchObject({ accepted: false });

    const result = await sendOutboundMessage({
      ...base,
      consentGranted: true,
      humanReviewed: true,
    });
    expect(result.accepted).toBe(true);
    expect(result.provider).toBe("local-preview");
    expect(result).not.toHaveProperty("previewUrl");
    expect(result.preview?.body).not.toContain("91234567");
    expect(result.preview?.body).not.toContain("ignored custom text");
    expect(result.message).toContain("لم تُفتح قناة خارجية");
  });

  it("renders an accessible Arabic/RTL-safe local preview form with no external handoff link", () => {
    const html = renderToStaticMarkup(
      createElement(CommunicationOutboundPanel),
    );
    expect(html).toContain("معاينة الاتصالات الخارجية");
    expect(html).toContain("قناة المعاينة");
    expect(html).toContain("لغة الرسالة");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("لا توجد قناة إرسال حية");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain('target="_blank"');
  });

  it("validates recipients and leaves SMS disabled", async () => {
    await expect(
      sendOutboundMessage({
        channel: "email",
        to: "",
        body: "ignored",
        templateId: "email-owner-statement",
        consentGranted: true,
        humanReviewed: true,
      }),
    ).resolves.toMatchObject({ accepted: false });

    await expect(
      sendOutboundMessage({
        channel: "sms",
        to: "+96891234567",
        body: "ignored",
      }),
    ).resolves.toMatchObject({ accepted: false, provider: "local-preview" });
  });
});
