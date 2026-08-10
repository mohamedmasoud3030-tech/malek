import { Bot } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';

const AiAssistantExperience = lazy(async () => {
  const module = await import('./ai-assistant-page');
  return { default: module.AiAssistantPage };
});

/** The one canonical AI experience. /ai-assistant only opens this global action. */
export function AiAssistantGlobalAction() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const requestedByLegacyUrl = search.globalAction === 'ai-assistant';
  const [open, setOpen] = useState(requestedByLegacyUrl);

  useEffect(() => {
    if (requestedByLegacyUrl) setOpen(true);
  }, [requestedByLegacyUrl]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && requestedByLegacyUrl) {
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

  return (
    <>
      <Button type="button" variant="ghost" className="size-11 shrink-0 rounded-xl px-0 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="فتح مساعد الذكاء الاصطناعي" title="مساعد الذكاء الاصطناعي" onClick={() => setOpen(true)}>
        <Bot className="size-[1.1rem]" aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-[min(96vw,80rem)] p-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">مساعد الذكاء الاصطناعي</DialogTitle>
          <div className="max-h-[88dvh] overflow-y-auto p-3 sm:p-5">
            <Suspense fallback={<LoadingState label="جارٍ تحميل المساعد..." />}><AiAssistantExperience /></Suspense>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
