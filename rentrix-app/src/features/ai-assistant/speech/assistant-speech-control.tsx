import { Square, Volume2 } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import {
  getAssistantSpeechState,
  playAssistantMessage,
  resumeAssistantSpeech,
  stopAssistantSpeech,
  subscribeAssistantSpeechState,
} from './assistant-speech';

type AssistantSpeechControlProps = Readonly<{
  messageId: string;
  /** Full displayed response text — only ever normalized in memory for speech. */
  content: string;
}>;

/**
 * Compact speaker control for one assistant response.
 *
 * Hidden entirely when the platform has no usable speech engine, so a
 * TTS-less browser never sees a dead control and the text response is
 * untouched. One circular 44px ghost button — same size family as the
 * assistant's send control — with shape+label (not color) state changes:
 *
 *   idle     → speaker icon, "تشغيل الرد" (or "إعادة تشغيل الرد" once spoken)
 *   playing  → stop icon,     "إيقاف الرد"
 *   paused   → speaker icon,  "متابعة الرد"
 */
export function AssistantSpeechControl({ messageId, content }: AssistantSpeechControlProps) {
  const speechState = useSyncExternalStore(
    subscribeAssistantSpeechState,
    getAssistantSpeechState,
    getAssistantSpeechState,
  );

  if (!speechState.supported) return null;

  const isActive = speechState.status !== 'idle' && speechState.messageId === messageId;
  const isOwnPaused = speechState.status === 'paused' && speechState.messageId === messageId;
  const isOwnPlaying = speechState.status === 'playing' && speechState.messageId === messageId;

  const label = isOwnPlaying
    ? 'إيقاف الرد'
    : isOwnPaused
      ? 'متابعة الرد'
      : speechState.completedMessageId === messageId
        ? 'إعادة تشغيل الرد'
        : 'تشغيل الرد';

  const handleClick = () => {
    if (isOwnPlaying) {
      stopAssistantSpeech();
      return;
    }
    if (isOwnPaused) {
      // Resuming goes through the engine directly; it validates the state.
      resumeAssistantSpeech();
      return;
    }
    void playAssistantMessage(messageId, content);
  };

  return (
    <div className="mt-1 flex items-center gap-1" data-ai-speech-control data-ai-speech-state={speechState.status} data-ai-speech-message-id={messageId}>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="size-11 min-h-11 min-w-11 rounded-full p-0"
        aria-label={label}
        title={label}
        data-ai-speech-action={isOwnPlaying ? 'stop' : isOwnPaused ? 'resume' : 'play'}
        onClick={handleClick}
      >
        {isOwnPlaying ? (
          <Square className="size-4 fill-current" aria-hidden="true" />
        ) : (
          <Volume2 className="size-4" aria-hidden="true" />
        )}
      </Button>
      <span className="sr-only" aria-live="polite">
        {isOwnPlaying ? 'جارٍ تشغيل الرد صوتياً' : isOwnPaused ? 'رد متوقف مؤقتاً' : ''}
      </span>
    </div>
  );
}
