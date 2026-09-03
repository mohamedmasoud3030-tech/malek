// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  disposeAssistantSpeech,
  getAssistantSpeechState,
  playAssistantMessage,
  resetAssistantSpeechForTests,
} from './assistant-speech';

type Voice = {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
};

type Utterance = {
  text: string;
  lang: string;
  voice: Voice | null;
  rate: number;
  pitch: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

class WebKitLikeSpeechSynthesis {
  paused = false;
  speaking = false;
  pending = false;
  onvoiceschanged: (() => void) | null = null;
  readonly voice: Voice = {
    name: 'Arabic Oman',
    lang: 'ar-OM',
    localService: true,
    default: true,
  };
  queue: Utterance[] = [];
  cancelCalls = 0;

  getVoices(): Voice[] {
    return [this.voice];
  }

  speak(utterance: Utterance): void {
    // WebKit expects the native SpeechSynthesisVoice object itself. A plain
    // cloned object can make subsequent speech silently fail on iOS.
    if (utterance.voice !== null && utterance.voice !== this.voice) {
      throw new TypeError('voice must be a native SpeechSynthesisVoice');
    }
    this.queue.push(utterance);
    this.speaking = true;
    this.pending = this.queue.length > 1;
    utterance.onstart?.();
  }

  cancel(): void {
    this.cancelCalls += 1;
    const queued = [...this.queue];
    this.queue = [];
    this.speaking = false;
    this.pending = false;
    this.paused = false;
    for (const utterance of queued) utterance.onerror?.({ error: 'canceled' });
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  completeNext(): void {
    const utterance = this.queue.shift();
    utterance?.onend?.();
    this.speaking = this.queue.length > 0;
    this.pending = this.queue.length > 1;
  }

  completeAll(): void {
    while (this.queue.length > 0) this.completeNext();
  }
}

let synthesis: WebKitLikeSpeechSynthesis;

beforeEach(() => {
  synthesis = new WebKitLikeSpeechSynthesis();
  Object.defineProperty(window, 'speechSynthesis', {
    value: synthesis,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    writable: true,
    value: class {
      text: string;
      lang = '';
      voice: Voice | null = null;
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error?: string }) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    },
  });
  resetAssistantSpeechForTests();
});

afterEach(() => {
  disposeAssistantSpeech();
  Object.defineProperty(window, 'speechSynthesis', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

describe('mobile replay regression', () => {
  it('keeps a multi-chunk response active until the final chunk ends', () => {
    const longResponse = Array.from(
      { length: 35 },
      (_, index) => `هذه جملة تشغيلية رقم ${index + 1} عن التحصيل والعقود.`,
    ).join(' ');

    expect(playAssistantMessage('first', longResponse)).toBe(true);
    expect(synthesis.queue.length).toBeGreaterThan(1);

    synthesis.completeNext();
    expect(getAssistantSpeechState().status).toBe('playing');
    expect(getAssistantSpeechState().messageId).toBe('first');

    synthesis.completeAll();
    expect(getAssistantSpeechState().status).toBe('idle');
    expect(getAssistantSpeechState().completedMessageId).toBe('first');
  });

  it('replays the first response and then plays later responses', () => {
    expect(playAssistantMessage('first', 'الرسالة الأولى.')).toBe(true);
    synthesis.completeAll();
    expect(getAssistantSpeechState().completedMessageId).toBe('first');

    expect(playAssistantMessage('first', 'الرسالة الأولى.')).toBe(true);
    expect(getAssistantSpeechState().status).toBe('playing');
    synthesis.completeAll();

    expect(playAssistantMessage('second', 'الرسالة الثانية.')).toBe(true);
    expect(getAssistantSpeechState().messageId).toBe('second');
    synthesis.completeAll();
    expect(getAssistantSpeechState().completedMessageId).toBe('second');
  });
});
