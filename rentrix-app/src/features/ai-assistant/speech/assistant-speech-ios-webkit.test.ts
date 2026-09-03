// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  disposeAssistantSpeech,
  getAssistantSpeechState,
  playAssistantMessage,
  resetAssistantSpeechForTests,
} from './assistant-speech';

type Voice = { name: string; lang: string; localService: boolean; default: boolean };
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

class IosWebKitSpeechSynthesis {
  paused = false;
  speaking = false;
  pending = false;
  onvoiceschanged: (() => void) | null = null;
  queue: Utterance[] = [];
  readonly voice: Voice = {
    name: 'Arabic Oman',
    lang: 'ar-OM',
    localService: true,
    default: true,
  };

  getVoices(): Voice[] {
    return [this.voice];
  }

  speak(utterance: Utterance): void {
    if (utterance.voice && utterance.voice !== this.voice) {
      throw new TypeError('WebKit requires the native voice instance');
    }
    // This fake intentionally rejects eager native queueing. A second speak
    // before the first utterance ends models the iOS/WKWebView failure mode.
    if (this.queue.length > 0) {
      throw new Error('WebKit native queue stalled by eager utterance batching');
    }
    this.queue.push(utterance);
    this.speaking = true;
    this.pending = false;
    utterance.onstart?.();
  }

  cancel(): void {
    this.queue = [];
    this.speaking = false;
    this.pending = false;
    this.paused = false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  completeCurrent(): void {
    const utterance = this.queue.shift();
    this.speaking = false;
    utterance?.onend?.();
  }

  interruptCurrent(): void {
    const utterance = this.queue.shift();
    this.speaking = false;
    utterance?.onerror?.({ error: 'interrupted' });
  }
}

let synthesis: IosWebKitSpeechSynthesis;
const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';

beforeEach(() => {
  Object.defineProperty(navigator, 'userAgent', { value: IOS_UA, configurable: true });
  synthesis = new IosWebKitSpeechSynthesis();
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

describe('iOS WebKit speech hardening', () => {
  it('feeds long replies one native utterance at a time and completes all chunks', () => {
    const reply = Array.from(
      { length: 40 },
      (_, index) => `جملة رقم ${index + 1} عن المتأخرات والتحصيل والصيانة.`,
    ).join(' ');

    expect(playAssistantMessage('long', reply)).toBe(true);
    expect(synthesis.queue).toHaveLength(1);
    expect(getAssistantSpeechState().status).toBe('playing');

    let safety = 0;
    while (getAssistantSpeechState().status === 'playing' && safety < 100) {
      expect(synthesis.queue).toHaveLength(1);
      synthesis.completeCurrent();
      safety += 1;
    }

    expect(safety).toBeGreaterThan(1);
    expect(getAssistantSpeechState().status).toBe('idle');
    expect(getAssistantSpeechState().completedMessageId).toBe('long');
  });

  it('replays the same message and then plays a later message', () => {
    expect(playAssistantMessage('first', 'الرسالة الأولى.')).toBe(true);
    synthesis.completeCurrent();
    expect(getAssistantSpeechState().completedMessageId).toBe('first');

    expect(playAssistantMessage('first', 'الرسالة الأولى.')).toBe(true);
    synthesis.completeCurrent();
    expect(getAssistantSpeechState().completedMessageId).toBe('first');

    expect(playAssistantMessage('second', 'الرسالة الثانية.')).toBe(true);
    expect(getAssistantSpeechState().messageId).toBe('second');
    synthesis.completeCurrent();
    expect(getAssistantSpeechState().completedMessageId).toBe('second');
  });

  it('recovers to idle when WebKit interrupts speech unexpectedly', () => {
    expect(playAssistantMessage('first', 'اختبار المقاطعة.')).toBe(true);
    synthesis.interruptCurrent();
    expect(getAssistantSpeechState().status).toBe('idle');
    expect(getAssistantSpeechState().messageId).toBeNull();

    expect(playAssistantMessage('second', 'يعمل بعد المقاطعة.')).toBe(true);
    synthesis.completeCurrent();
    expect(getAssistantSpeechState().completedMessageId).toBe('second');
  });
});
