import { createPortal } from 'react-dom';
import { Maximize2, Sparkles, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { FloatingPanel } from '@/components/ui/floating-panel';
import { LoadingState } from '@/components/ui/loading-state';

const AiAssistantExperience = lazy(async () => {
  const module = await import('./ai-assistant-page');
  return { default: module.AiAssistantPage };
});

export const OPEN_AI_ASSISTANT_EVENT = 'malek:open-ai-assistant';
const AI_ASSISTANT_PANEL_ID = 'malek-ai-assistant-panel';
const AI_ASSISTANT_TITLE_ID = 'malek-ai-assistant-title';
const AI_ASSISTANT_DESCRIPTION_ID = 'malek-ai-assistant-description';

type AiAssistantGlobalActionProps = Readonly<{
  /** Render an inline trigger for a surface that owns its own placement. */
  showTrigger?: boolean;
  /** Render the shared desktop/tablet trigger in AppShell's utility slot. */
  showHeaderTrigger?: boolean;
}>;

/**
 * Canonical AI entry point: a deliberately compact floating conversation.
 * It stays narrow on phones and relies on the explicit expand control for the
 * full assistant workspace instead of pretending to be a full-screen sheet.
 *
 * The controller owns every entry point (desktop header, phone dock event and
 * optional inline trigger) so the panel has one open state, one labelled
 * dialog and one focus-restoration path.
 */
export function AiAssistantGlobalAction({
  showTrigger = true,
  showHeaderTrigger = false,
}: AiAssistantGlobalActionProps) {
  const [open, setOpen] = useState(false);
  const [headerTriggerTarget, setHeaderTriggerTarget] = useState<HTMLElement | null>(null);
  const activeTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!showHeaderTrigger || typeof document === 'undefined') {
      setHeaderTriggerTarget(null);
      return undefined;
    }

    const target = document.querySelector<HTMLElement>('[data-header-ai-assistant-slot]');
    setHeaderTriggerTarget(target);
    return undefined;
  }, [showHeaderTrigger]);

  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener(OPEN_AI_ASSISTANT_EVENT, openAssistant);
    return () => window.removeEventListener(OPEN_AI_ASSISTANT_EVENT, openAssistant);
  }, []);

  const renderTrigger = (className: string) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-label="فتح مساعد الذكاء الاصطناعي"
      aria-expanded={open}
      aria-controls={AI_ASSISTANT_PANEL_ID}
      aria-haspopup="dialog"
      title="مساعد الذكاء الاصطناعي"
      onClick={(event) => {
        activeTriggerRef.current = event.currentTarget;
        setOpen((value) => !value);
      }}
      data-ai-assistant-trigger
    >
      <Sparkles className="size-[22px]" aria-hidden="true" />
    </Button>
  );

  return (
    <>
      {showTrigger ? renderTrigger('size-11 shrink-0 rounded-xl px-0 text-muted-foreground hover:bg-muted hover:text-foreground') : null}
      {showHeaderTrigger && headerTriggerTarget
        ? createPortal(
            renderTrigger('shrink-0 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground'),
            headerTriggerTarget,
          )
        : null}

      <FloatingPanel
        open={open}
        onOpenChange={setOpen}
        id={AI_ASSISTANT_PANEL_ID}
        labelledBy={AI_ASSISTANT_TITLE_ID}
        aria-describedby={AI_ASSISTANT_DESCRIPTION_ID}
        triggerRef={activeTriggerRef}
        className="fixed z-[90] flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-elevated bottom-[calc(var(--mobile-dock-clearance,5.25rem)+0.75rem)] left-1/2 h-[min(32rem,64dvh)] w-[min(21.5rem,calc(100vw-2rem))] max-h-[calc(100dvh-var(--mobile-dock-clearance,5.25rem)-2.25rem)] -translate-x-1/2 sm:bottom-5 sm:left-4 sm:h-[32rem] sm:max-h-[72dvh] sm:w-[22rem] sm:max-w-[calc(100vw-2rem)] sm:translate-x-0 md:w-[23rem]"
      >
        <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-card px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id={AI_ASSISTANT_TITLE_ID} className="truncate text-[13px] font-bold leading-4">المساعد الذكي</h2>
              <p id={AI_ASSISTANT_DESCRIPTION_ID} className="truncate text-[10px] leading-4 text-muted-foreground">قراءة وتحليل</p>
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
                <Maximize2 className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="grid size-10 min-h-11 min-w-11 place-items-center rounded-full px-0 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="إغلاق المساعد"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={<LoadingState label="جارٍ تحميل المساعد..." />}>
            <AiAssistantExperience embedded />
          </Suspense>
        </div>
      </FloatingPanel>
    </>
  );
}
