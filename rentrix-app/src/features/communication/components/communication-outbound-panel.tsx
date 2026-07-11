import { ExternalLink, Mail, MessageCircle, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  listNotificationTemplates,
  sendOutboundMessage,
  type OutboundChannel,
} from '../services/outbound-communication-service';

export function CommunicationOutboundPanel() {
  const templates = useMemo(() => listNotificationTemplates(), []);
  const [channel, setChannel] = useState<OutboundChannel>('whatsapp');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(templates[0]?.body ?? '');
  const [isSending, setIsSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const channelTemplates = templates.filter(
    (template) => template.channel === channel || template.channel === 'in_app',
  );

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setBody(template.body);
    if (template.subject) setSubject(template.subject);
  };

  const handleChannelChange = (next: OutboundChannel) => {
    setChannel(next);
    setPreviewUrl(null);
    const first = templates.find((template) => template.channel === next);
    if (first) applyTemplate(first.id);
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      const result = await sendOutboundMessage({
        channel,
        to,
        subject: subject || undefined,
        body,
        templateId: templateId || undefined,
      });

      if (!result.accepted) {
        toast.error(result.message);
        return;
      }

      setPreviewUrl(result.previewUrl ?? null);
      toast.success(result.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="size-4 text-primary" />
          مركز الإرسال والقوالب
        </CardTitle>
        <CardDescription>
          واجهة قابلة للتوسعة لواتساب والبريد وقوالب الإشعارات. لا يتم ربط مزود خارجي داخل المكوّن — الإرسال يمر عبر طبقة الخدمة فقط.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={channel === 'whatsapp' ? 'primary' : 'outline'}>واتساب</Badge>
          <Badge variant={channel === 'email' ? 'primary' : 'outline'}>بريد إلكتروني</Badge>
          <Badge variant="outline">قوالب جاهزة للتخصيص</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="القناة">
            <Select
              value={channel}
              onChange={(event) => handleChannelChange(event.target.value as OutboundChannel)}
              aria-label="قناة الإرسال"
            >
              <option value="whatsapp">واتساب</option>
              <option value="email">بريد إلكتروني</option>
            </Select>
          </FormField>

          <FormField label="القالب">
            <Select
              value={templateId}
              onChange={(event) => applyTemplate(event.target.value)}
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
            label={channel === 'whatsapp' ? 'رقم واتساب' : 'البريد الإلكتروني'}
            required
          >
            <Input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder={channel === 'whatsapp' ? '+9689xxxxxxx' : 'name@example.com'}
              inputMode={channel === 'whatsapp' ? 'tel' : 'email'}
            />
          </FormField>

          {channel === 'email' ? (
            <FormField label="الموضوع">
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} />
            </FormField>
          ) : null}

          <FormField label="نص الرسالة" wide>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-28"
            />
          </FormField>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {previewUrl ? (
            <Button variant="secondary" asChild>
              <a href={previewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="me-2 size-4" />
                فتح المعاينة
              </a>
            </Button>
          ) : null}
          <Button onClick={() => void handleSend()} disabled={isSending}>
            {channel === 'whatsapp' ? (
              <MessageCircle className="me-2 size-4" />
            ) : (
              <Mail className="me-2 size-4" />
            )}
            {isSending ? 'جارٍ التجهيز...' : 'تجهيز الرسالة'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
