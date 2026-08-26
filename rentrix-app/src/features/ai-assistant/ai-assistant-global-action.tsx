import { Bot, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { cn } from '@/lib/utils';

const AiAssistantExperience = lazy(async () => {
  const module = await import('./ai-assistant-page');
  return { default: module.AiAssistantPage };
});

export const OPEN_AI_ASSISTANT_EVENT = 'malek:open-ai-assistant';

/**
 * The one canonical AI experience as a compact, persistent floating panel.
 * Clean bot interface without long intro.
 */
export function AiAssistantGlobalAction({ showTrigger = true }: Readonly<{ showTrigger?: boolean }>) {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const requestedByLegacyUrl = search.globalAction === 'ai-assistant';
  const [open, setOpen] = useState(requestedByLegacyUrl);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (requestedByLegacyUrl) setOpen(true);
  }, [requestedByLegacyUrl]);

  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener(OPEN_AI_ASSISTANT_EVENT, openAssistant);
    return () => window.removeEventListener(OPEN_AI_ASSISTANT_EVENT, openAssistant);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        if (!requestedByLegacyUrl) return;
        void navigate({
          to: '.',
          replace: true,
          search: (previous: Record<string, unknown>) => {
            const next = { ...previous };
            delete next.globalAction;
            return next;
          },
        });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, navigate, requestedByLegacyUrl]);

  const close = () => {
    setOpen(false);
    if (!requestedByLegacyUrl) return;
    void navigate({
      to: '.',
      replace: true,
      search: (previous: Record<string, unknown>) => {
        const next = { ...previous };
        delete next.globalAction;
        return next;
      },
    });
  };

  return (
    <>
      {showTrigger ? (
        <Button
          type="button"
          variant="ghost"
          className="size-10 shrink-0 rounded-xl px-0 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="فتح مساعد الذكاء الاصطناعي"
          aria-expanded={open}
          aria-haspopup="dialog"
          title="مساعد الذكاء الاصطناعي"
          onClick={() => setOpen((value) => !value)}
          data-ai-assistant-trigger
        >
          <Bot className="size-4" aria-hidden="true" />
        </Button>
      ) : null}

      <div
        ref={panelRef}
        data-ai-assistant-panel
        data-state={open ? 'open' : 'closed'}
        aria-hidden={open ? undefined : true}
        inert={open ? undefined : true}
        className={cn(
          'fixed z-[90] flex flex-col overflow-hidden border border-border bg-card shadow-elevated transition-[transform,opacity] duration-200 motion-reduce:transition-none',
          'inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] top-auto h-[min(32rem,70dvh)] rounded-2xl',
          'sm:inset-x-auto sm:start-4 sm:bottom-4 sm:w-[24rem] sm:max-w-[calc(100vw-2rem)] sm:h-[30rem] sm:max-h-[70dvh]',
          'md:w-[26rem]',
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
        )}
        role="dialog"
        aria-label="مساعد الذكاء الاصطناعي"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-muted/20 px-3.5 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground">
              <Bot className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-none">المساعد الذكي</p>
              <p className="mt-0.5 truncate text-[11px] leading-none text-muted-foreground">متصل الآن</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="size-8 shrink-0 rounded-full px-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={close}
            aria-label="إغلاق المساعد"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={<LoadingState label="جارٍ تحميل المساعد..." />}>
            <AiAssistantExperience embedded />
          </Suspense>
        </div>
      </div>
    </>
  );
}
