import { Eye, ExternalLink, Mail, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CommunicationLocale } from "../communication-system";
import {
  listNotificationTemplates,
  sendOutboundMessage,
  type OutboundChannel,
  type OutboundMessageResult,
} from "../services/outbound-communication-service";
import { openWhatsAppComposer } from "../services/whatsapp-share-service";

export function CommunicationOutboundPanel() {
  const [channel, setChannel] = useState<OutboundChannel>("whatsapp");
  const [locale, setLocale] = useState<CommunicationLocale>("ar");
  const templates = useMemo(
    () => listNotificationTemplates(undefined, locale),
    [locale],
  );
  const channelTemplates = templates.filter(
    (template) => template.channel === channel,
  );
  const [templateId, setTemplateId] = useState("whatsapp-rent-reminder");
  const [to, setTo] = useState("");
  const [consentGranted, setConsentGranted] = useState(false);
  const [humanReviewed, setHumanReviewed] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [preview, setPreview] =
    useState<OutboundMessageResult["preview"]>(undefined);
  const selectedTemplate =
    channelTemplates.find((template) => template.id === templateId) ??
    channelTemplates[0];

  const selectFirstTemplate = (
    nextChannel: OutboundChannel,
    nextLocale: CommunicationLocale,
  ) => {
    const first = listNotificationTemplates(nextChannel, nextLocale)[0];
    setTemplateId(first?.id ?? "");
    setPreview(undefined);
  };

  const handlePrepare = async () => {
    if (!selectedTemplate) return;
    setIsPreparing(true);
    try {
      const result = await sendOutboundMessage({
        channel,
        to,
        body: selectedTemplate.body,
        subject: selectedTemplate.subject,
        templateId: selectedTemplate.id,
        locale,
        consentGranted,
        humanReviewed,
      });
      if (!result.accepted) {
        setPreview(undefined);
        toast.error(result.message);
        return;
      }
      setPreview(result.preview);
      toast.success(result.message);
    } finally {
      setIsPreparing(false);
    }
  };

  /**
   * Explicit human action: after a local preview is accepted, the operator
   * chooses to open WhatsApp with the prepared text and lets the recipient be
   * confirmed manually. Nothing is sent by MALEK; no Business API is used.
   */
  const handleOpenWhatsApp = () => {
    if (!preview) return;
    const outcome = openWhatsAppComposer({
      phone: to || undefined,
      text: [preview.subject, preview.body].filter(Boolean).join("\n"),
    });
    if (!outcome.result.ok) {
      toast.error(
        outcome.result.reason === "PHONE_INVALID"
          ? "رقم واتساب غير صالح."
          : "تعذر تجهيز رابط واتساب.",
      );
      return;
    }
    if (!outcome.opened) {
      toast.error(
        "تعذر فتح واتساب. سُمح للمتصفح بفتح نافذة جديدة ثم أعد المحاولة.",
      );
      return;
    }
    toast.success("تم فتح واتساب لإرسال الرسالة يدويًا.");
  };

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="size-4 text-primary" aria-hidden="true" />
          معاينة الاتصالات الخارجية
        </CardTitle>
        <CardDescription>
          معاينة محلية لقوالب آمنة: لا يُوضع المستلم أو النص في رابط قبل خطوة
          المستخدم الصريحة. بعد المعاينة يمكن فتح واتساب لإرسال يدوي، ولا
          توجد قناة إرسال حية أو Business API.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={channel === "whatsapp" ? "primary" : "outline"}>
            واتساب — معاينة
          </Badge>
          <Badge variant={channel === "email" ? "primary" : "outline"}>
            بريد — معاينة
          </Badge>
          <Badge variant="outline">SMS وPush غير مفعّلين</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="القناة">
            <Select
              value={channel}
              onChange={(event) => {
                const next = event.target.value as OutboundChannel;
                setChannel(next);
                selectFirstTemplate(next, locale);
              }}
              aria-label="قناة المعاينة"
            >
              <option value="whatsapp">واتساب — معاينة فقط</option>
              <option value="email">بريد إلكتروني — معاينة فقط</option>
            </Select>
          </FormField>

          <FormField label="اللغة">
            <Select
              value={locale}
              onChange={(event) => {
                const next = event.target.value as CommunicationLocale;
                setLocale(next);
                selectFirstTemplate(channel, next);
              }}
              aria-label="لغة الرسالة"
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </Select>
          </FormField>

          <FormField label="القالب">
            <Select
              value={selectedTemplate?.id ?? ""}
              onChange={(event) => {
                setTemplateId(event.target.value);
                setPreview(undefined);
              }}
              aria-label="قالب الرسالة"
            >
              {channelTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label={
              channel === "whatsapp" ? "رقم واتساب للاختبار" : "بريد للاختبار"
            }
            required
          >
            <Input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder={
                channel === "whatsapp" ? "+9689xxxxxxx" : "name@example.com"
              }
              inputMode={channel === "whatsapp" ? "tel" : "email"}
              autoComplete="off"
              dir="ltr"
            />
          </FormField>

          {selectedTemplate?.subject ? (
            <FormField label="الموضوع الآمن">
              <Input
                value={selectedTemplate.subject}
                readOnly
                dir={locale === "ar" ? "rtl" : "ltr"}
              />
            </FormField>
          ) : null}

          <FormField label="نص القالب الآمن" wide>
            <Textarea
              value={selectedTemplate?.body ?? ""}
              readOnly
              className="min-h-28"
              dir={locale === "ar" ? "rtl" : "ltr"}
            />
          </FormField>
        </div>

        <div className="grid gap-3 rounded-2xl border bg-muted/20 p-3 sm:grid-cols-2">
          <label className="flex min-h-11 items-start gap-2 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={consentGranted}
              onChange={(event) => setConsentGranted(event.target.checked)}
            />
            <span>أؤكد وجود موافقة موثقة من المستلم على هذه القناة.</span>
          </label>
          <label className="flex min-h-11 items-start gap-2 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={humanReviewed}
              onChange={(event) => setHumanReviewed(event.target.checked)}
            />
            <span>راجعت الغرض والقالب والمستلم قبل المعاينة.</span>
          </label>
        </div>

        {preview ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-2xl border border-success/30 bg-success/10 p-4"
          >
            <p className="flex items-center gap-2 text-sm font-bold text-success">
              <Eye className="size-4" aria-hidden="true" />
              معاينة محلية — لم يتم الإرسال
            </p>
            {preview.subject ? (
              <p
                className="mt-3 text-sm font-bold"
                dir={locale === "ar" ? "rtl" : "ltr"}
              >
                {preview.subject}
              </p>
            ) : null}
            <p
              className="mt-2 whitespace-pre-wrap text-sm leading-7"
              dir={locale === "ar" ? "rtl" : "ltr"}
            >
              {preview.body}
            </p>
            <p className="mt-3 text-xs text-muted-foreground" dir="ltr">
              {preview.templateKey} · v{preview.templateVersion}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            onClick={() => void handlePrepare()}
            disabled={isPreparing || !selectedTemplate}
          >
            {channel === "whatsapp" ? (
              <MessageCircle className="me-2 size-4" />
            ) : (
              <Mail className="me-2 size-4" />
            )}
            {isPreparing ? "جارٍ التحقق..." : "تجهيز معاينة محلية"}
          </Button>
          {channel === "whatsapp" && preview ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenWhatsApp}
              data-whatsapp-open-action
            >
              <ExternalLink className="me-2 size-4" />
              فتح واتساب لإرسال يدوي
            </Button>
          ) : null}
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            لا تدخل كلمة مرور أو رمزاً أو رقم هوية أو حساباً بنكياً. بيانات
            المستلم تبقى في هذا النموذج ولا تظهر في المعاينة أو السجل.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
