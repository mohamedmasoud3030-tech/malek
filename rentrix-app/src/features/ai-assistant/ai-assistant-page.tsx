import { AlertTriangle, ArrowUpRight, Bot, ChevronDown, Loader2, Send, Sparkles } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { APP_BRAND_NAME } from '@/lib/brand';
import { env } from '@/lib/env';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { AiAssistantAction, AiAssistantMessage, AiAssistantResponse, AiAssistantSurfaceContext } from './types';
import { useSmartAssistant } from './use-smart-assistant';
import { isAiAssistantConfigurationError } from './services/ai-assistant-service';
import { buildAiNavigationTargets } from './ai-assistant-navigation';
import { deriveAiAssistantSurfaceContext } from './ai-assistant-surface-context';
import { AssistantSpeechControl } from './speech/assistant-speech-control';
import { useAssistantSpeech } from './speech/use-assistant-speech';

type AssistantAction = {
  action: AiAssistantAction;
  title: string;
  prompt: string;
};

/** Always-visible operational quick actions — the office owner's daily four. */
const assistantActions = [
  {
    action: 'summarize_overdue_invoices',
    title: 'مين متأخر؟',
    prompt: 'مين متأخر عليا وإجمالي المتأخرات كام؟',
  },
  {
    action: 'generate_daily_brief',
    title: 'مستحق النهارده',
    prompt: 'إيه المستحق النهارده وإيه أهم حاجة أعملها؟',
  },
  {
    action: 'summarize_contract_renewals',
    title: 'عقود هتخلص',
    prompt: 'إيه العقود اللي هتخلص قريب؟',
  },
  {
    action: 'summarize_vacancy',
    title: 'الوحدات الفاضية',
    prompt: 'عندي كام وحدة فاضية ونسبة الإشغال كام؟',
  },
] as const satisfies AssistantAction[];

/** Progressive disclosure: shown only after the user asks for more. */
const moreAssistantActions = [
  {
    action: 'list_overdue_or_critical_maintenance',
    title: 'الصيانة المفتوحة',
    prompt: 'إيه طلبات الصيانة المفتوحة أو الحرجة؟',
  },
  {
    action: 'prioritize_office_actions_top5',
    title: 'أهم 5 إجراءات',
    prompt: 'إيه أهم 5 حاجات المكتب لازم يعملها النهارده؟',
  },
  {
    action: 'summarize_month',
    title: 'ملخص الشهر',
    prompt: 'اعمل لي ملخص الشهر ده.',
  },
  {
    action: 'locate_dormant_funds',
    title: 'فلوس واقفة',
    prompt: 'فين الفلوس الواقفة أو التأمينات المحتجزة؟',
  },
] as const satisfies AssistantAction[];

/** Contextual entity quick action labels (per surface entity type). */
const surfaceActionTitles: Record<NonNullable<AiAssistantSurfaceContext['entityType']>, string> = {
  property: 'ملخص العقار ده',
  unit: 'الوحدة دي عاملة إيه؟',
  contract: 'العقد ده عامل إيه؟',
  tenant: 'المستأجر ده عليه إيه؟',
  owner: 'ملخص المالك ده',
  person: 'ملخص الملف ده',
};

/**
 * Where is the user right now? Derived from the live location so the same
 * canonical component works on the full route and the floating global panel.
 * Safe by construction: only sanitized route-shaped ids leave this step, and
 * the service still verifies them against authoritative rows before use.
 */
function readSurfaceContext(): AiAssistantSurfaceContext {
  if (typeof window === 'undefined') {
    return { route: '/', entityType: null, entityId: null, entityLabel: null, section: null };
  }
  return deriveAiAssistantSurfaceContext(window.location.pathname);
}

const initialMessage: AiAssistantMessage = {
  id: 'assistant-welcome',
  role: 'assistant',
  content: `مرحباً! أنا مساعد ${APP_BRAND_NAME} الذكي.\nاسألني بالعربي العادي عن التحصيل، الشغور، العقود أو ملخص الفترة.`,
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

function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  const message = error instanceof Error ? error.message : 'تعذر تشغيل المساعد.';
  if (message.includes('تعذر التحقق من ملخص البيانات المسموح')) {
    return 'تعذر تجهيز بيانات المساعد الآن. أعد المحاولة بعد قليل.';
  }
  return message;
}

function formatAssistantResponse(response: AiAssistantResponse): string {
  return response.reply;
}

export function AiAssistantPage({ embedded = false }: { embedded?: boolean }) {
  const [messages, setMessages] = useState<AiAssistantMessage[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [configurationMissing, setConfigurationMissing] = useState(!env.isConfigured);
  const assistant = useSmartAssistant();
  const { autoSpeak, setAutoSpeak, speakCompletedMessage } = useAssistantSpeech();
  const scrollRef = useRef<HTMLDivElement>(null);

  const pending = assistant.isPending;
  const errorMessage = configurationMissing ? null : getErrorMessage(assistant.error);
  const surface = readSurfaceContext();
  const surfaceAction: AssistantAction | null = surface.entityType && surface.entityId
    ? {
        action: 'explain_current_surface',
        title: surfaceActionTitles[surface.entityType],
        prompt: 'اشرح لي وضع الصفحة اللي أنا فيها دلوقتي.',
      }
    : null;
  const visibleActions: readonly AssistantAction[] = [
    ...(surfaceAction ? [surfaceAction] : []),
    ...assistantActions,
    ...(showMoreActions ? moreAssistantActions : []),
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  function submitPrompt(rawPrompt: string, action?: AiAssistantAction) {
    const prompt = rawPrompt.trim();
    if (!prompt || pending || configurationMissing) return;

    const userMessage = createMessage('user', prompt, action);
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);
    setInput('');

    assistant.mutate(
      { prompt, action, history, surface: readSurfaceContext() },
      {
        onSuccess: (response) => {
          const reply = createMessage('assistant', formatAssistantResponse(response), action);
          setMessages((current) => [...current, reply]);
          // Voice is an extra modality: the text above is canonical, and audio
          // only plays automatically when the user opted in (default OFF).
          speakCompletedMessage(reply);
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

  const chatContent = (
    <div className={cn('flex h-full flex-col', embedded ? 'min-h-0' : 'min-h-[70dvh]')}>
      <div
        ref={scrollRef}
        className={cn('flex-1 overflow-y-auto overscroll-contain', embedded ? 'px-2.5 py-2' : 'p-3 sm:p-4')}
        aria-live="polite"
      >
        <div className={cn(embedded ? 'space-y-2.5' : 'space-y-3')}>
          {messages.map((message) => {
            const isUser = message.role === 'user';
            const isWelcome = message.id === 'assistant-welcome';
            const navigationTargets = isUser || (embedded && !message.action)
              ? []
              : buildAiNavigationTargets(message.action, { freeform: true });

            return (
              <div key={message.id} className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'flex gap-2',
                    isUser ? 'max-w-[86%] flex-row-reverse' : 'max-w-[88%] flex-row',
                    embedded && isWelcome && 'max-w-full',
                  )}
                >
                  {!embedded || isUser || !isWelcome ? (
                    <div
                      className={cn(
                        'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {isUser ? 'أنت' : <Bot className="size-4" />}
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      'text-[13px] leading-6',
                      isUser
                        ? 'rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-primary-foreground shadow-sm'
                        : 'rounded-2xl rounded-bl-md border border-border/60 bg-card px-3.5 py-2.5 text-foreground shadow-sm',
                      embedded && isWelcome && 'rounded-none border-0 bg-transparent px-0.5 py-0.5 text-[12.5px] leading-5 shadow-none',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    {!isUser ? <AssistantSpeechControl messageId={message.id} content={message.content} /> : null}
                    {navigationTargets.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5" data-ai-navigation>
                        {navigationTargets.map((target) => (
                          <Link
                            key={`${target.to}-${target.label}`}
                            to={target.to}
                            search={target.search}
                            className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary transition hover:bg-primary/10"
                          >
                            <ArrowUpRight className="size-3" aria-hidden="true" />
                            {target.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {pending ? (
            <div className="flex justify-start">
              <div className="flex max-w-[85%] gap-2">
                <div className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Bot className="size-4" />
                </div>
                <div className="rounded-2xl rounded-bl-md border border-border/60 bg-card px-3.5 py-2.5 text-[13px] leading-6 shadow-sm">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    يكتب...
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={cn('shrink-0 border-t border-border/50 bg-card', embedded ? 'px-2 py-1.5' : 'bg-muted/20 px-3 py-2')}>
        <div className="flex max-w-full gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar">
          {visibleActions.map((item) => (
            <button
              key={item.action}
              type="button"
              onClick={() => submitPrompt(item.prompt, item.action)}
              disabled={pending || configurationMissing}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50',
                embedded ? 'min-h-10 px-2.5' : 'min-h-11 px-3',
              )}
            >
              <Sparkles className="size-3" />
              {item.title}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowMoreActions((current) => !current)}
            disabled={configurationMissing}
            aria-expanded={showMoreActions}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border bg-transparent text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50',
              embedded ? 'min-h-10 px-2.5' : 'min-h-11 px-3',
            )}
          >
            <ChevronDown className={cn('size-3 transition-transform', showMoreActions && 'rotate-180')} />
            {showMoreActions ? 'أقل' : 'المزيد'}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div role="alert" className="mx-3 mt-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className={cn('shrink-0 border-t border-border/60 bg-card', embedded ? 'p-2' : 'p-3')}>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submitPrompt(input);
              }
            }}
            placeholder={embedded ? 'اسأل المساعد...' : 'اسأل مثلاً: مين متأخر؟ عندي كام وحدة فاضية؟'}
            disabled={pending || configurationMissing}
            aria-label="رسالة المساعد"
            className={cn(
              'max-h-32 min-h-11 flex-1 resize-none rounded-xl border-border/70 bg-muted/25 px-3 py-2.5 text-sm leading-6 focus-visible:ring-2 focus-visible:ring-primary/20',
              embedded && 'max-h-24',
            )}
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={pending || configurationMissing || !input.trim()}
            className="size-11 shrink-0 rounded-xl"
            aria-label="إرسال"
          >
            <Send className="size-4" />
          </Button>
        </form>
        {!embedded ? (
          <p className="mt-1.5 px-1 text-[11px] leading-4 text-muted-foreground">
            قراءة وتحليل فقط — أي اعتماد أو تسجيل نهائي يظل بيد المستخدم المخول.
          </p>
        ) : null}
      </div>
    </div>
  );

  if (embedded) {
    return chatContent;
  }

  return (
    <PageLayout size="wide" dir="rtl" lang="ar" className="p-0">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Bot className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">المساعد الذكي</p>
              <p className="truncate text-xs text-muted-foreground">مساعد {APP_BRAND_NAME} للقراءة والتحليل</p>
            </div>
          </div>
          <label
            className="flex min-h-11 shrink-0 cursor-pointer select-none items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs font-bold text-foreground/80 transition hover:bg-muted"
            title="عند التفعيل، تُنطق ردود المساعد الجديدة تلقائياً"
          >
            <span className="whitespace-nowrap">التحدث التلقائي</span>
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(event) => setAutoSpeak(event.target.checked)}
              aria-label="التحدث تلقائياً بردود المساعد"
            />
          </label>
        </div>
        {configurationMissing ? (
          <Card role="alert" className="m-3 border-warning/40 bg-warning/10">
            <CardHeader className="p-3">
              <CardTitle className="flex items-center gap-2 text-sm text-warning-foreground">
                <AlertTriangle className="size-4" />
                {translateSharedLabel('aiUnavailable', getAppLanguageState().language)}
              </CardTitle>
              <CardDescription className="text-xs leading-5">
                اضبط دالة Supabase Edge Function باسم <span dir="ltr">ai-assistant</span> ثم أعد التحميل.
              </CardDescription>
              <div className="pt-2">
                <Button asChild size="sm" variant="secondary">
                  <Link to="/settings">{translateSharedLabel('configureAiAssistant', getAppLanguageState().language)}</Link>
                </Button>
              </div>
            </CardHeader>
          </Card>
        ) : null}
        <div className="min-h-0 flex-1">{chatContent}</div>
      </div>
    </PageLayout>
  );
}
