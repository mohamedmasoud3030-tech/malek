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
 * The mobile command dock opens this same mounted conversation through a
 * window event, so there is still only one assistant instance and chat state
 * survives close/reopen.
 */
export function AiAssistantGlobalAction() {
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
      <Button
        type="button"
        variant="ghost"
        className="size-11 shrink-0 rounded-xl px-0 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="فتح مساعد الذكاء الاصطناعي"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="مساعد الذكاء الاصطناعي"
        onClick={() => setOpen((value) => !value)}
        data-ai-assistant-trigger
      >
        <Bot className="size-[1.1rem]" aria-hidden="true" />
      </Button>

      <div
        ref={panelRef}
        data-ai-assistant-panel
        data-state={open ? 'open' : 'closed'}
        aria-hidden={open ? undefined : true}
        inert={open ? undefined : true}
        className={cn(
          'fixed z-[90] flex flex-col overflow-hidden border border-border/80 bg-card shadow-elevated transition-[transform,opacity] duration-200 motion-reduce:transition-none',
          'max-w-[26rem] w-[calc(100vw-2rem)] h-[34rem] max-h-[80dvh] rounded-2xl start-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]',
          'md:start-4 md:bottom-4 md:max-h-[min(40rem,80dvh)]',
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
        )}
        role="dialog"
        aria-label="مساعد الذكاء الاصطناعي"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Bot className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate text-sm font-bold">المساعد الذكي</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="size-9 shrink-0 px-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={close}
            aria-label="إغلاق المساعد"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          <Suspense fallback={<LoadingState label="جارٍ تحميل المساعد..." />}>
            <AiAssistantExperience embedded />
          </Suspense>
        </div>
      </div>
    </>
  );
}
