import { Maximize2, Sparkles, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { cn } from '@/lib/utils';

const AiAssistantExperience = lazy(async () => {
  const module = await import('./ai-assistant-page');
  return { default: module.AiAssistantPage };
});

export const OPEN_AI_ASSISTANT_EVENT = 'malek:open-ai-assistant';

/**
 * Canonical AI entry point: a deliberately compact floating conversation.
 * It stays narrow on phones and relies on the explicit expand control for the
 * full assistant workspace instead of pretending to be a full-screen sheet.
 */
export function AiAssistantGlobalAction({ showTrigger = true }: Readonly<{ showTrigger?: boolean }>) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener(OPEN_AI_ASSISTANT_EVENT, openAssistant);
    return () => window.removeEventListener(OPEN_AI_ASSISTANT_EVENT, openAssistant);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

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
          <Sparkles className="size-4" aria-hidden="true" />
        </Button>
      ) : null}

      <div
        ref={panelRef}
        data-ai-assistant-panel
        data-state={open ? 'open' : 'closed'}
        aria-hidden={open ? undefined : true}
        inert={open ? undefined : true}
        className={cn(
          'fixed z-[90] flex flex-col overflow-hidden border border-border/80 bg-card shadow-elevated transition-[transform,opacity] duration-200 motion-reduce:transition-none',
          'bottom-[calc(var(--mobile-dock-clearance,5.25rem)+0.75rem)] left-1/2 h-[min(32rem,64dvh)] w-[min(21.5rem,calc(100vw-2rem))] max-h-[calc(100dvh-var(--mobile-dock-clearance,5.25rem)-2.25rem)] -translate-x-1/2 rounded-2xl',
          'sm:bottom-5 sm:left-4 sm:w-[22rem] sm:max-w-[calc(100vw-2rem)] sm:h-[32rem] sm:max-h-[72dvh] sm:translate-x-0',
          'md:w-[23rem]',
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
        )}
        role="dialog"
        aria-label="مساعد الذكاء الاصطناعي"
      >
        <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-card px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-4">المساعد الذكي</p>
              <p className="truncate text-[10px] leading-4 text-muted-foreground">قراءة وتحليل</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              asChild
              type="button"
              variant="ghost"
              className="grid size-10 min-h-11 min-w-11 place-items-center rounded-full px-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Link
                to="/ai-assistant"
                onClick={() => setOpen(false)}
                aria-label="تكبير المساعد إلى مساحة عمل كاملة"
                title="فتح مساحة العمل الكاملة"
              >
                <Maximize2 className="size-3.5" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="grid size-10 min-h-11 min-w-11 place-items-center rounded-full px-0 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={close}
              aria-label="إغلاق المساعد"
            >
              <X className="size-4" />
            </Button>
          </div>
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
