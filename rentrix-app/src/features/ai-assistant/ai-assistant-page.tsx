import { AlertTriangle, ArrowUpRight, Bot, Loader2, Send, Sparkles } from 'lucide-react';
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
import type { AiAssistantAction, AiAssistantMessage, AiAssistantResponse } from './types';
import { useSmartAssistant } from './use-smart-assistant';
import { isAiAssistantConfigurationError } from './services/ai-assistant-service';
import { buildAiNavigationTargets } from './ai-assistant-navigation';

type AssistantAction = {
  action: AiAssistantAction;
  title: string;
  prompt: string;
};

const assistantActions = [
  {
    action: 'summarize_overdue_invoices',
    title: 'مين متأخر؟',
    prompt: 'مين متأخر عليا وإجمالي المتأخرات كام؟',
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
  {
    action: 'summarize_month',
    title: 'ملخص الشهر',
    prompt: 'اعمل لي ملخص الشهر ده.',
  },
] as const satisfies AssistantAction[];

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
  return error instanceof Error ? error.message : 'تعذر تشغيل المساعد.';
}

function formatAssistantResponse(response: AiAssistantResponse): string {
  return response.reply;
}

export function AiAssistantPage({ embedded = false }: { embedded?: boolean }) {
  const [messages, setMessages] = useState<AiAssistantMessage[]>([initialMessage]);
  const [input, setInput] = useState('');
  const [configurationMissing, setConfigurationMissing] = useState(!env.isConfigured);
  const assistant = useSmartAssistant();
  const scrollRef = useRef<HTMLDivElement>(null);

  const pending = assistant.isPending;
  const errorMessage = configurationMissing ? null : getErrorMessage(assistant.error);

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
      { prompt, action, history },
      {
        onSuccess: (response) => {
          setMessages((current) => [...current, createMessage('assistant', formatAssistantResponse(response), action)]);
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4" aria-live="polite">
        <div className="space-y-3">
          {messages.map((message) => {
            const isUser = message.role === 'user';
            const navigationTargets = isUser
              ? []
              : buildAiNavigationTargets(message.action, { freeform: true });
            return (
              <div key={message.id} className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
                <div className={cn('flex max-w-[85%] gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
                  <div
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                      isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isUser ? 'أنت' : <Bot className="size-4" />}
                  </div>
                  <div
                    className={cn(
                      'rounded-2xl px-3.5 py-2.5 text-[13px] leading-6 shadow-sm',
                      isUser
                        ? 'rounded-br-md bg-primary text-primary-foreground'
                        : 'rounded-bl-md border border-border/60 bg-card text-foreground',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
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

      <div className="shrink-0 border-t border-border/60 bg-muted/20 px-3 py-2">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {assistantActions.map((item) => (
            <button
              key={item.action}
              type="button"
              onClick={() => submitPrompt(item.prompt, item.action)}
              disabled={pending || configurationMissing}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
            >
              <Sparkles className="size-3" />
              {item.title}
            </button>
          ))}
        </div>
      </div>

      {errorMessage ? (
        <div role="alert" className="mx-3 mt-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="shrink-0 border-t border-border/70 bg-card p-3">
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
            placeholder="اسأل مثلاً: مين متأخر؟ عندي كام وحدة فاضية؟"
            disabled={pending || configurationMissing}
            aria-label="رسالة المساعد"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border-border/70 bg-muted/30 px-3 py-2.5 text-sm leading-6 focus-visible:ring-2 focus-visible:ring-primary/20"
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
        <p className="mt-1.5 px-1 text-[11px] leading-4 text-muted-foreground">
          قراءة وتحليل فقط — أي اعتماد أو تسجيل نهائي يظل بيد المستخدم المخول.
        </p>
      </div>
    </div>
  );

  if (embedded) {
    return chatContent;
  }

  return (
    <PageLayout size="wide" dir="rtl" lang="ar" visualVariant="malek-pro" className="p-0">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
        <div className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-muted/20 px-4 py-3">
          <div className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
            <Bot className="size-4" />
          </div>
          <div>
            <p className="text-sm font-bold">المساعد الذكي</p>
            <p className="text-xs text-muted-foreground">مساعد {APP_BRAND_NAME} للقراءة والتحليل</p>
          </div>
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
