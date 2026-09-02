// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chunkSpeechText,
  disposeAssistantSpeech,
  getAssistantSpeechState,
  isAssistantSpeechSupported,
  pauseAssistantSpeech,
  playAssistantMessage,
  resumeAssistantSpeech,
  resetAssistantSpeechForTests,
  stopAssistantSpeech,
} from './assistant-speech';

type FakeUtterance = {
  text: string;
  lang: string;
  voice: { name: string; lang: string } | null;
  rate: number;
  pitch: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

/**
 * A deterministic stand-in for the Web Speech API. Utterances are queued like
 * a real engine and can be ended, failed or cancelled by the test, so the
 * engine's session lifecycle is exercised exactly like the browser path.
 */
class FakeSpeechSynthesis {
  paused = false;
  speaking = false;
  pending = false;
  cancelCalls = 0;
  queue: FakeUtterance[] = [];
  voices: Array<{ name: string; lang: string; localService: boolean; default?: boolean }> = [
    { name: 'Google US English', lang: 'en-US', localService: true },
    { name: 'Microsoft Hala - Arabic (Saudi Arabia)', lang: 'ar-SA', localService: true },
    { name: 'Microsoft Salem Online (Natural) - Arabic (UAE)', lang: 'ar-AE', localService: false },
  ];
  onvoiceschanged: (() => void) | null = null;

  speak(utterance: FakeUtterance): void {
    this.queue.push(utterance);
    this.speaking = true;
    this.pending = this.queue.length > 1;
  }

  cancel(): void {
    this.cancelCalls += 1;
    for (const utterance of this.queue) utterance.onerror?.({ error: 'canceled' });
    this.queue = [];
    this.speaking = false;
    this.pending = false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  getVoices(): Array<{ name: string; lang: string; localService: boolean; default?: boolean }> {
    return this.voices;
  }

  /** Let the next N queued utterances finish naturally (in queue order). */
  complete(count: number): void {
    for (let index = 0; index < count; index += 1) {
      const utterance = this.queue.shift();
      if (!utterance) break;
      utterance.onend?.();
    }
    this.speaking = this.queue.length > 0;
    this.pending = this.queue.length > 1;
  }

  /** Fail the session with a real (non-cancel) error. */
  fail(error: string): void {
    for (const utterance of this.queue) utterance.onerror?.({ error });
    this.queue = [];
    this.speaking = false;
    this.pending = false;
  }

  spokenText(): string {
    return this.queue.map((utterance) => utterance.text).join('');
  }
}

let fake: FakeSpeechSynthesis;

function installEngine(): void {
  fake = new FakeSpeechSynthesis();
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true, writable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    writable: true,
    value: class {
      text: string;
      lang = '';
      voice: { name: string; lang: string } | null = null;
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    },
  });
}

function uninstallEngine(): void {
  Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true, writable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: undefined, configurable: true, writable: true });
}

beforeEach(() => {
  vi.useRealTimers();
  installEngine();
  resetAssistantSpeechForTests();
});

afterEach(() => {
  disposeAssistantSpeech();
  resetAssistantSpeechForTests();
  uninstallEngine();
});

describe('capability detection', () => {
  it('reports supported when the platform exposes the Web Speech API', () => {
    expect(isAssistantSpeechSupported()).toBe(true);
    expect(getAssistantSpeechState().supported).toBe(true);
  });

  it('reports unsupported and play is a safe no-op without the API', () => {
    uninstallEngine();
    expect(isAssistantSpeechSupported()).toBe(false);
    expect(playAssistantMessage('m1', 'مرحباً')).toBe(false);
    const state = getAssistantSpeechState();
    expect(state.supported).toBe(false);
    expect(state.status).toBe('idle');
    expect(state.messageId).toBeNull();
  });
});

describe('play', () => {
  it('speaks the normalized text with an Arabic utterance and an Arabic voice', () => {
    const started = playAssistantMessage('m1', 'الإجمالي 12.345 ر.ع.');
    expect(started).toBe(true);

    const state = getAssistantSpeechState();
    expect(state.status).toBe('playing');
    expect(state.messageId).toBe('m1');

    expect(fake.queue.length).toBeGreaterThan(0);
    for (const utterance of fake.queue) {
      expect(utterance.lang).toBe('ar-OM');
      expect(utterance.voice?.lang).toMatch(/^ar/);
    }
    const spoken = fake.spokenText();
    expect(spoken).toContain('اثنا عشر ريال عماني');
    expect(spoken).toContain('ثلاثمائة وخمسة وأربعون بيسة');
    expect(spoken).not.toContain('ر.ع');
  });

  it('prefers ar-OM voices, then Gulf locales, over non-Arabic voices', () => {
    fake.voices = [
      { name: 'Google US English', lang: 'en-US', localService: true },
      { name: 'Omani Arabic (Local)', lang: 'ar-OM', localService: true },
    ];
    playAssistantMessage('m1', 'اختبار');
    expect(fake.queue[0].voice?.lang).toBe('ar-OM');

    fake.voices = [
      { name: 'Google US English', lang: 'en-US', localService: true },
      { name: 'Salem - Arabic (UAE)', lang: 'ar-AE', localService: false },
      { name: 'Maged - Arabic (Egypt)', lang: 'ar-EG', localService: true },
    ];
    stopAssistantSpeech();
    playAssistantMessage('m2', 'اختبار');
    expect(fake.queue[0].voice?.lang).toBe('ar-AE');
  });

  it('does not start when the message has no speakable content', () => {
    expect(playAssistantMessage('m1', '   ')).toBe(false);
    expect(playAssistantMessage('m1', '***')).toBe(false);
    expect(getAssistantSpeechState().status).toBe('idle');
    expect(fake.queue).toHaveLength(0);
  });

  it('chunks long responses so the browser never truncates them', () => {
    const longReply = Array.from({ length: 30 }, (_, index) => `جملة رقم ${index + 1} بخصوص الفواتير. `).join('');
    playAssistantMessage('m1', longReply);
    expect(fake.queue.length).toBeGreaterThan(1);
    for (const utterance of fake.queue) {
      expect(utterance.text.length).toBeLessThanOrEqual(200);
    }
    // No content is dropped by chunking.
    expect(fake.spokenText().replace(/\s+/g, '')).toBe(longReply.trim().replace(/\s+/g, ''));
  });
});

describe('session lifecycle', () => {
  it('returns to idle when the response finishes naturally and remembers replay', () => {
    playAssistantMessage('m1', 'اثنان. ثلاثة.');
    fake.complete(fake.queue.length);
    const state = getAssistantSpeechState();
    expect(state.status).toBe('idle');
    expect(state.messageId).toBeNull();
    expect(state.completedMessageId).toBe('m1');
  });

  it('stop cancels the engine and clears the playing state (no false state)', () => {
    playAssistantMessage('m1', 'نص طويل بعض الشىء.');
    expect(getAssistantSpeechState().status).toBe('playing');

    stopAssistantSpeech();

    expect(fake.cancelCalls).toBeGreaterThan(0);
    expect(fake.queue).toHaveLength(0);
    const state = getAssistantSpeechState();
    expect(state.status).toBe('idle');
    expect(state.messageId).toBeNull();
    expect(state.completedMessageId).toBe('m1');
  });

  it('a TTS failure fails the session back to idle without a false playing state', () => {
    playAssistantMessage('m1', 'رد تجريبي.');
    const warn = vi.spyOn(console, 'debug').mockImplementation(() => {});
    fake.fail('synthesis-failed');
    const state = getAssistantSpeechState();
    expect(state.status).toBe('idle');
    expect(state.messageId).toBeNull();
    expect(fake.queue).toHaveLength(0);
    warn.mockRestore();
  });

  it('treats cancel/interrupt errors as expected (our own stop) not as failures', () => {
    playAssistantMessage('m1', 'رد تجريبي.');
    stopAssistantSpeech();
    expect(getAssistantSpeechState().status).toBe('idle');
  });

  it('pause flips to paused only when the engine actually pauses; resume returns to playing', () => {
    playAssistantMessage('m1', 'رد تجريبي.');
    expect(pauseAssistantSpeech()).toBe(true);
    expect(getAssistantSpeechState().status).toBe('paused');

    expect(resumeAssistantSpeech()).toBe(true);
    expect(getAssistantSpeechState().status).toBe('playing');

    stopAssistantSpeech();
    expect(pauseAssistantSpeech()).toBe(false);
  });

  it('does not report a false paused state when the platform ignores pause()', () => {
    fake.pause = () => {
      // Platform no-op: paused stays false.
    };
    playAssistantMessage('m1', 'رد تجريبي.');
    expect(pauseAssistantSpeech()).toBe(false);
    expect(getAssistantSpeechState().status).toBe('playing');
    stopAssistantSpeech();
  });
});

describe('single-active-response guarantee', () => {
  it('starting response B stops response A and speaks only B', async () => {
    vi.useFakeTimers();
    try {
      const baselineCancels = fake.cancelCalls;
      playAssistantMessage('A', 'الرد الأول.');
      expect(fake.queue.map((utterance) => utterance.text)).toEqual(['الرد الأول.']);

      playAssistantMessage('B', 'الرد الثاني 10.000 ر.ع.');
      // The restart gap keeps the first session's cancel events from racing.
      await vi.advanceTimersByTimeAsync(150);

      expect(fake.cancelCalls).toBe(baselineCancels + 1);
      const spoken = fake.spokenText();
      expect(spoken).not.toContain('الرد الأول');
      expect(spoken).toContain('عشرة ريال عماني');

      const state = getAssistantSpeechState();
      expect(state.status).toBe('playing');
      expect(state.messageId).toBe('B');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a late natural end of a replaced session cannot end the newer session', async () => {
    playAssistantMessage('A', 'أول.');
    const lateUtterance = fake.queue[0];
    playAssistantMessage('B', 'ثاني.');
    await new Promise((resolve) => setTimeout(resolve, 150));

    // A's old utterance "finishes" late — its session token is stale.
    lateUtterance.onend?.();
    expect(getAssistantSpeechState().messageId).toBe('B');
    expect(getAssistantSpeechState().status).toBe('playing');

    // B still completes normally on its own.
    fake.complete(fake.queue.length);
    const state = getAssistantSpeechState();
    expect(state.status).toBe('idle');
    expect(state.completedMessageId).toBe('B');
  });
});

describe('chunkSpeechText', () => {
  it('splits on sentence boundaries and keeps every word', () => {
    const text = 'أول جملة. ثانية جملة!؟ لا ثالث؟ رابعة.';
    const chunks = chunkSpeechText(text, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 20)).toBe(true);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text);
  });

  it('splits oversized sentences by words without losing content', () => {
    const text = `كلمة ${'طويلة'.repeat(60)}`;
    const chunks = chunkSpeechText(text, 30);
    expect(chunks.every((chunk) => chunk.length <= 30)).toBe(true);
    // Fragments are joined with spaces (a reading unit for the engine) —
    // compare content with whitespace ignored.
    expect(chunks.join('').replace(/\s+/g, '')).toBe(text.replace(/\s+/g, ''));
  });
});

describe('navigation-away cleanup', () => {
  it('stops speech when the page becomes hidden', () => {
    playAssistantMessage('m1', 'رد تجريبي.');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const state = getAssistantSpeechState();
    expect(state.status).toBe('idle');
    expect(state.messageId).toBeNull();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('disposeAssistantSpeech stops and clears listeners', () => {
    playAssistantMessage('m1', 'رد تجريبي.');
    disposeAssistantSpeech();
    expect(getAssistantSpeechState().status).toBe('idle');
    expect(fake.cancelCalls).toBeGreaterThan(0);
  });
});
