import { AlertTriangle, Bot, Loader2, Send, Sparkles } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import { env } from '@/lib/env';
import { formatLatinNumber } from '@/lib/formatters';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { AiAssistantAction, AiAssistantContext, AiAssistantMessage } from './types';
import { useSmartAssistant } from './use-smart-assistant';
import { isAiAssistantConfigurationError } from './services/ai-assistant-service';

type AssistantAction = {
  action: AiAssistantAction;
  title: string;
  description: string;
  prompt: string;
};

const assistantActions = [
  {
    action: 'summarize_overdue_invoices',
    title: 'تلخيص الفواتير المتأخرة',
    description: 'إجمالي المتأخرات، عدد الفواتير، وأقدم تواريخ الاستحقاق.',
    prompt: 'لخص الفواتير المتأخرة واذكر الأولويات التشغيلية للتحصيل باللغة العربية.',
  },
  {
    action: 'summarize_contract_renewals',
    title: 'العقود القريبة من التجديد',
    description: 'قراءة العقود النشطة التي تنتهي خلال ٩٠ يوماً.',
    prompt: 'لخص العقود القريبة من التجديد واقترح خطوات متابعة غير تنفيذية.',
  },
  {
    action: 'draft_tenant_payment_reminder',
    title: 'صياغة تذكير دفع للمستأجر',
    description: 'مسودة عربية مهذبة مبنية على ملخص المتأخرات، بدون إرسال تلقائي.',
    prompt: 'اكتب مسودة تذكير دفع عربية مهذبة لمستأجر لديه متأخرات، بدون تهديد أو تنفيذ إرسال.',
  },
  {
    action: 'explain_property_financial_snapshot',
    title: 'شرح لقطة مالية للعقارات',
    description: 'إشغال، مبالغ قائمة، تحصيلات، ومصاريف حديثة.',
    prompt: 'اشرح اللقطة المالية الحالية للعقارات وحدد المخاطر أو المؤشرات التي تحتاج متابعة.',
  },
] as const satisfies AssistantAction[];

const initialMessage: AiAssistantMessage = {
  id: 'assistant-welcome',
  role: 'assistant',
  content: 'أنا مساعد قراءة فقط. أستطيع تلخيص المتأخرات، التجديدات، والتنبيهات المالية اعتماداً على البيانات المسموح لحسابك بقراءتها فقط.',
  createdAt: new Date().toISOString(),
};

function createMessageId(role: AiAssistantMessage['role']): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${role}-${crypto.randomUUID()}`;
  }

  return `${role}-${Date.now()}`;
}

function createMessage(role: AiAssistantMessage['role'], content: string, action?: AiAssistantAction): AiAssistantMessage {
  return {
    id: createMessageId(role),
    role,
    content,
    action,
    createdAt: new Date().toISOString(),
  };
}

function toArabicCount(value: number): string {
  return formatLatinNumber(value, 'ar');
}

function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : 'تعذر تشغيل مساعد الذكاء الاصطناعي.';
}

function ContextSnapshot({ context }: Readonly<{ context: AiAssistantContext | null }>) {
  if (!context) return null;

  return (
    <div className="grid gap-3 md:grid-cols-3" aria-label="ملخص السياق المقروء">
      <Card variant="muted">
        <CardContent className="space-y-1 pt-6">
          <p className="text-sm font-bold text-muted-foreground">المتأخرات</p>
          <p className="text-2xl font-black" dir="ltr">{formatMoney(context.overdueInvoices.totalOutstanding)}</p>
          <p className="text-xs text-muted-foreground">{toArabicCount(context.overdueInvoices.invoiceCount)} فواتير مفتوحة حتى {context.asOf}</p>
        </CardContent>
      </Card>
      <Card variant="muted">
        <CardContent className="space-y-1 pt-6">
          <p className="text-sm font-bold text-muted-foreground">التجديدات القادمة</p>
          <p className="text-2xl font-black">{toArabicCount(context.contractRenewals.contractCount)}</p>
          <p className="text-xs text-muted-foreground">خلال {toArabicCount(context.contractRenewals.lookaheadDays)} يوماً</p>
        </CardContent>
      </Card>
      <Card variant="muted">
        <CardContent className="space-y-1 pt-6">
          <p className="text-sm font-bold text-muted-foreground">الإشغال</p>
          <p className="text-2xl font-black">{toArabicCount(context.propertyFinancialSnapshot.occupancyRate)}%</p>
          <p className="text-xs text-muted-foreground">{toArabicCount(context.propertyFinancialSnapshot.occupiedUnitCount)} من {toArabicCount(context.propertyFinancialSnapshot.unitCount)} وحدة</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function AiAssistantPage() {
  const [messages, setMessages] = useState<AiAssistantMessage[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [latestContext, setLatestContext] = useState<AiAssistantContext | null>(null);
  const [configurationMissing, setConfigurationMissing] = useState(!env.isConfigured);
  const assistant = useSmartAssistant();

  const pending = assistant.isPending;
  const errorMessage = configurationMissing ? null : getErrorMessage(assistant.error);

  function submitPrompt(rawPrompt: string, action?: AiAssistantAction) {
    const prompt = rawPrompt.trim();
    if (!prompt || pending || configurationMissing) return;

    const userMessage = createMessage('user', prompt, action);
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setInput('');

    assistant.mutate(
      { prompt, action, history },
      {
        onSuccess: (response) => {
          setLatestContext(response.context);
          setMessages((current) => [...current, createMessage('assistant', response.reply, action)]);
        },
        onError: (error) => {
          if (isAiAssistantConfigurationError(error)) setConfigurationMissing(true);
        },
      },
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitPrompt(input);
  }

  return (
    <PageLayout size="wide" dir="rtl" lang="ar">
      <PageHeader
        title="مساعد الذكاء الاصطناعي"
        description="مساعد تشغيلي قراءة فقط يستخدم ملخصات آمنة من بيانات Rentrix المسموح لحسابك بقراءتها، ولا ينفذ أي تعديل أو SQL."
      />

      {configurationMissing ? (
        <Card role="alert" aria-live="assertive" variant="outlined" className="border-warning/50 bg-warning/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning-foreground"><AlertTriangle className="size-5" aria-hidden="true" />{translateSharedLabel('aiUnavailable', getAppLanguageState().language)}</CardTitle>
            <CardDescription>
              اضبط دالة Supabase Edge Function باسم <span dir="ltr">ai-assistant</span> ومتغير <span dir="ltr">AI_PROVIDER_API_KEY</span>، ثم أعد تحميل الصفحة. لا يتم استخدام أي مفتاح مزود من الواجهة الأمامية.
            </CardDescription>
            <div className="pt-2">
              <Button asChild variant="secondary">
                <Link to="/settings">{translateSharedLabel('configureAiAssistant', getAppLanguageState().language)}</Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      <ContextSnapshot context={latestContext} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="size-5 text-primary" />المحادثة</CardTitle>
            <CardDescription>اكتب سؤالاً تشغيلياً أو اختر إجراءً جاهزاً. الردود مساعدة فقط ولا تستبدل المراجعة البشرية.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[32rem] space-y-3 overflow-y-auto rounded-2xl border bg-muted/20 p-3" aria-live="polite">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm',
                    message.role === 'user' ? 'ms-auto bg-primary text-primary-foreground' : 'me-auto border bg-card',
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))}
              {pending ? (
                <div className="me-auto flex max-w-[90%] items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                  <Loader2 className="size-4" />جارٍ تجهيز الرد من السياق المسموح...
                </div>
              ) : null}
            </div>

            {errorMessage ? (
              <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-3">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={configurationMissing ? translateSharedLabel('aiUnavailable', getAppLanguageState().language) : 'مثال: ما أهم المتأخرات التي تحتاج متابعة هذا الأسبوع؟'}
                disabled={pending || configurationMissing}
                aria-label="رسالة مساعد الذكاء الاصطناعي"
                aria-describedby={configurationMissing ? 'ai-assistant-disabled-hint' : undefined}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="submit" disabled={pending || configurationMissing || !input.trim()}>
                  <Send className="me-2 size-4" />إرسال
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" />إجراءات جاهزة</CardTitle>
            <CardDescription>كل إجراء يجمع ملخصاً آمناً ثم يطلب من الدالة الخلفية صياغة قراءة عربية.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {assistantActions.map((item) => (
              <Button
                key={item.action}
                type="button"
                variant="outline"
                className={cn(
                  'h-auto w-full justify-start whitespace-normal rounded-2xl p-3 text-start',
                  configurationMissing && 'cursor-not-allowed opacity-50',
                )}
                disabled={pending || configurationMissing}
                aria-disabled={pending || configurationMissing}
                title={configurationMissing ? translateSharedLabel('aiUnavailable', getAppLanguageState().language) : undefined}
                onClick={() => submitPrompt(item.prompt, item.action)}
              >
                <span className="space-y-1">
                  <span className="block font-black">{item.title}</span>
                  <span className="block text-xs font-medium leading-5 text-muted-foreground">{item.description}</span>
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
