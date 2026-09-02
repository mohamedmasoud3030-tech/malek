import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useUiStore } from '@/store/ui-store';
import type { AiAssistantMessage } from '../types';
import {
  getAssistantSpeechState,
  pauseAssistantSpeech,
  playAssistantMessage,
  resumeAssistantSpeech,
  stopAssistantSpeech,
  subscribeAssistantSpeechState,
  type AssistantSpeechState,
} from './assistant-speech';

/**
 * Bridges the module-level speech singleton to a mounted assistant surface.
 *
 * - Every mounted surface observes the same global state, so at most one
 *   MALEK response speaks at a time across the full page and the embedded
 *   floating panel.
 * - Unmounting stops speech (user navigated away from the assistant UI).
 * - `speakCompletedMessage` is the automatic-reply path: it honours the
 *   "automatically speak bot responses" preference, which defaults OFF, so
 *   existing users never get unexpected audio.
 */
export function useAssistantSpeech() {
  const speechState = useSyncExternalStore(
    subscribeAssistantSpeechState,
    getAssistantSpeechState,
    getAssistantSpeechState,
  );
  const autoSpeak = useUiStore((state) => state.assistantAutoSpeak);
  const setAutoSpeak = useUiStore((state) => state.setAssistantAutoSpeak);
  const stop = useCallback(() => stopAssistantSpeech(), []);
  const unmountStopRef = useRef(stop);
  unmountStopRef.current = stop;

  useEffect(() => {
    return () => unmountStopRef.current();
  }, []);

  const play = useCallback((message: Pick<AiAssistantMessage, 'id' | 'content'>) => {
    return playAssistantMessage(message.id, message.content);
  }, []);

  const pause = useCallback(() => pauseAssistantSpeech(), []);
  const resume = useCallback(() => resumeAssistantSpeech(), []);

  /** Plays a newly completed response only when the auto-speak preference is ON. */
  const speakCompletedMessage = useCallback(
    (message: Pick<AiAssistantMessage, 'id' | 'content'>) => {
      if (!autoSpeak) return false;
      return play(message);
    },
    [autoSpeak, play],
  );

  return {
    state: speechState,
    supported: speechState.supported,
    autoSpeak,
    setAutoSpeak,
    isPlaying: (messageId: string) => speechState.status === 'playing' && speechState.messageId === messageId,
    isPaused: (messageId: string) => speechState.status === 'paused' && speechState.messageId === messageId,
    play,
    pause,
    resume,
    stop,
    speakCompletedMessage,
  };
}

export type AssistantSpeechUiState = AssistantSpeechState;
