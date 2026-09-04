import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { stopAssistantSpeech } from './assistant-speech';

/**
 * Live "phone call" conversation mode — a hands-free voice loop.
 *
 * The user speaks, the transcript is committed and sent to the assistant, and
 * the reply is read aloud (feminine-first voice via assistant-speech.ts). The
 * mic re-arms automatically once a reply lands, so the conversation keeps
 * flowing without extra taps. This is a UX layer over the existing Web Speech
 * engine — it never changes the canonical text response or the server contract.
 *
 * Disabled on platforms without a speech-recognition engine.
 */
type LiveCallProps = Readonly<{
  /** True while a reply is being generated. */
  pending: boolean;
  /** Canonical microphone/speech state from the shared engines. */
  supported: boolean;
  listening: boolean;
  speaking: boolean;
  /** Starts one utterance and commits it automatically when finalized. */
  onStart: () => boolean;
  onStop: () => void;
  /** Called when the live-call control is dismissed. */
  onClose?: () => void;
}>;

export function AssistantLiveCall({
  pending,
  supported,
  listening,
  speaking,
  onStart,
  onStop,
  onClose,
}: LiveCallProps) {
  const [active, setActive] = useState(false);
  const blocked = pending || speaking;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const prevBlockedRef = useRef(blocked);
  const startMicRef = useRef<() => void>(() => {});

  // Re-open only after BOTH reply generation and text-to-speech finish. This
  // prevents the microphone from hearing (or cutting off) the assistant.
  useEffect(() => {
    const wasBlocked = prevBlockedRef.current;
    prevBlockedRef.current = blocked;
    if (active && wasBlocked && !blocked && !listening) startMicRef.current();
  }, [blocked, active, listening]);

  const openMic = useCallback(() => {
    if (blockedRef.current) return;
    stopAssistantSpeech();
    onStart();
  }, [onStart]);
  startMicRef.current = openMic;

  const closeMic = useCallback(() => {
    onStop();
  }, [onStop]);

  const begin = useCallback(() => {
    if (!supported) return;
    setActive(true);
    openMic();
  }, [supported, openMic]);

  const stop = useCallback(() => {
    setActive(false);
    onStop();
    stopAssistantSpeech();
    onClose?.();
  }, [onClose, onStop]);

  if (!supported) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-xs text-muted-foreground">
        <Volume2 className="size-3.5" />
        مكالمة الصوت متاحة على متصفحات تدعم تعرّف الكلام (Chrome/Android الحديث). استخدم الكتابة بدلاً منها.
      </div>
    );
  }

  return (
    <div
      data-ai-live-call={active ? 'active' : 'idle'}
      className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2"
    >
      <Button
        type="button"
        size="icon"
        aria-label={listening ? 'إيقاف الاستماع' : 'ابدأ المكالمة / افتح الميكروفون'}
        onClick={listening ? closeMic : begin}
        className={cn('size-9 rounded-full', listening && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
      >
        {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </Button>

      <div className="min-w-0 flex-1 text-[11px] leading-4 text-muted-foreground">
        {listening ? (
          <span className="font-medium text-foreground">🎙️ أسمعك… تحدث، وسيُرسَل الرد وتُقرَأ الإجابة صوتياً.</span>
        ) : pending ? (
          <span className="font-medium text-foreground">الرد يُجهَّز…</span>
        ) : speaking ? (
          <span className="font-medium text-foreground">🔊 لينا بترد عليك… الميكروفون هيفتح بعد انتهاء الصوت.</span>
        ) : (
          <span>اضغط الميكروفون لتتحدث مباشرة (حوار صوتي لايف).</span>
        )}
      </div>

      <Button
        type="button"
        size="icon"
        aria-label="إنهاء المكالمة الصوتية"
        variant="ghost"
        onClick={stop}
        className="size-9 rounded-full text-muted-foreground hover:text-destructive"
      >
        <PhoneOff className="size-4" />
      </Button>
    </div>
  );
}
