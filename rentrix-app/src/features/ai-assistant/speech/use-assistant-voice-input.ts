import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  getAssistantVoiceInputState,
  setAssistantVoiceInputCallbacks,
  startAssistantVoiceInput,
  stopAssistantVoiceInput,
  subscribeAssistantVoiceInputState,
} from './assistant-voice-input';

export type AssistantVoiceInputHandlers = Readonly<{
  /** Live dictation: the merged transcript lands in the compose box as it forms. */
  onTranscript?: (transcript: string) => void;
  /** Fired once when the user explicitly stops, with the committed transcript. */
  onFinal?: (transcript: string) => void;
}>;

export type AssistantVoiceInputUi = Readonly<{
  /** The platform exposes Web Speech Recognition — the mic button renders only when true. */
  supported: boolean;
  listening: boolean;
  /** Live merged transcript (finals + interim fragment). */
  transcript: string;
  /** Latest Arabic error message, if any. */
  error: string | null;
  start: () => boolean;
  stop: () => void;
}>;

/**
 * Bridges the module-level voice-input engine to a mounted assistant surface.
 *
 * - `onTranscript` keeps the compose box in sync with live dictation; the
 *   latest closure is always reached through a ref, so typing state never
 *   goes stale mid-session.
 * - Unmounting ABORTS any active session and detaches the callbacks: the
 *   microphone must never stay open after the user leaves the surface, and
 *   no unmounted component can receive transcripts.
 */
export function useAssistantVoiceInput(handlers: AssistantVoiceInputHandlers): AssistantVoiceInputUi {
  const state = useSyncExternalStore(
    subscribeAssistantVoiceInputState,
    getAssistantVoiceInputState,
    getAssistantVoiceInputState,
  );
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    setAssistantVoiceInputCallbacks({
      onTranscript: (transcript) => handlersRef.current.onTranscript?.(transcript),
      onFinal: (transcript) => handlersRef.current.onFinal?.(transcript),
    });
    return () => {
      // Detach first so the abort commit below can never reach a stale
      // (unmounted) closure, then abort any active session.
      setAssistantVoiceInputCallbacks({});
      stopAssistantVoiceInput();
    };
  }, []);

  const start = useCallback(() => startAssistantVoiceInput(), []);
  const stop = useCallback(() => stopAssistantVoiceInput(), []);

  return {
    supported: state.supported,
    listening: state.status === 'listening',
    transcript: state.transcript,
    error: state.error,
    start,
    stop,
  };
}
