import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

/**
 * Assistant reply reveal — the canonical full text is present (and
 * screen-reader addressable) from the FIRST moment; only the visible span is
 * animated word by word, always finishing within MAX_REVEAL_MS regardless of
 * reply length.
 *
 * - `prefers-reduced-motion: reduce` skips the animation entirely.
 * - While the request is in flight the component renders the progressive
 *   waiting indicator instead of a bubble that just says "typing".
 */

/** Staged Arabic waiting phrases, first one shown immediately. */
const PENDING_STAGES = ['بقرأ بياناتك...', 'بحلل الوضع...', 'بجهز الإجابة...'] as const;
const PENDING_STAGE_MS = 2000;

/** Hard cap on the whole word-by-word reveal, in milliseconds. */
export const MAX_REVEAL_MS = 800;

/**
 * Splits reply text into reveal tokens while preserving the original
 * whitespace (including line breaks), so joining the tokens back yields the
 * exact canonical string.
 */
export function splitRevealTokens(content: string): string[] {
  return content.match(/\S+\s*/g) ?? [];
}

function readPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(readPrefersReducedMotion);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    let query: MediaQueryList;
    try {
      query = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    const listener = () => setReduced(query.matches);
    listener();
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', listener);
      return () => query.removeEventListener('change', listener);
    }
    // Legacy WebKit.
    query.addListener(listener);
    return () => query.removeListener(listener);
  }, []);
  return reduced;
}

export type AssistantStreamingTextProps = Readonly<{
  content: string;
  /** Renders the progressive waiting indicator instead of the reveal. */
  isPending?: boolean;
  className?: string;
}>;

export function AssistantStreamingText({
  content,
  isPending = false,
  className,
}: AssistantStreamingTextProps) {
  const reducedMotion = usePrefersReducedMotion();
  const tokens = useMemo(() => splitRevealTokens(content), [content]);

  const [pendingStage, setPendingStage] = useState(0);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!isPending) {
      setPendingStage(0);
      return;
    }
    const timer = setInterval(
      () => setPendingStage((stage) => (stage + 1) % PENDING_STAGES.length),
      PENDING_STAGE_MS,
    );
    return () => clearInterval(timer);
  }, [isPending]);

  useEffect(() => {
    if (isPending) return;
    if (tokens.length === 0) {
      setRevealed(0);
      return;
    }
    if (reducedMotion) {
      setRevealed(tokens.length);
      return;
    }
    setRevealed(0);

    // Bounded schedule: short replies get a natural ~100ms/word cadence, long
    // replies compress so the FULL text is always visible within the cap.
    const steps = Math.min(tokens.length, 50);
    const totalMs = Math.min(MAX_REVEAL_MS, tokens.length * 100);
    const stepMs = Math.max(1, Math.floor(totalMs / steps));
    const tokensPerStep = Math.ceil(tokens.length / steps);

    let index = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      index = Math.min(tokens.length, index + tokensPerStep);
      setRevealed(index);
      if (index < tokens.length) timer = setTimeout(tick, stepMs);
    };
    timer = setTimeout(tick, stepMs);
    return () => clearTimeout(timer);
  }, [content, isPending, reducedMotion, tokens]);

  if (isPending) {
    return (
      <p className={className} aria-live="polite" data-ai-pending-indicator>
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {PENDING_STAGES[pendingStage % PENDING_STAGES.length]}
        </span>
      </p>
    );
  }

  if (tokens.length === 0) return null;

  const visibleText = tokens.slice(0, revealed).join('');
  return (
    // The canonical full text is exposed from the first moment via the
    // accessible name; only the (aria-hidden) span animates.
    <p className={className} aria-label={content} data-ai-streaming-text={revealed >= tokens.length ? 'complete' : 'revealing'}>
      <span aria-hidden="true">{visibleText}</span>
    </p>
  );
}
