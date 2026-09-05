// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetAssistantSpeechForTests, stopAssistantSpeech } from './assistant-speech';
import { AssistantSpeechControl } from './assistant-speech-control';

type FakeUtterance = {
  text: string;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

class FakeSpeechSynthesis {
  paused = false;
  speaking = false;
  pending = false;
  queue: FakeUtterance[] = [];
  voices = [{ name: 'Salem - Arabic (UAE)', lang: 'ar-AE', localService: true }];
  onvoiceschanged: (() => void) | null = null;

  speak(utterance: FakeUtterance): void {
    this.queue.push(utterance);
    this.speaking = true;
  }
  cancel(): void {
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
  getVoices() {
    return this.voices;
  }
  completeAll(): void {
    for (const utterance of this.queue) utterance.onend?.();
    this.queue = [];
    this.speaking = false;
  }
  fail(error: string): void {
    for (const utterance of this.queue) utterance.onerror?.({ error });
    this.queue = [];
    this.speaking = false;
  }
}

let fake: FakeSpeechSynthesis;

beforeEach(() => {
  fake = new FakeSpeechSynthesis();
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true, writable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    writable: true,
    value: class {
      text: string;
      lang = '';
      voice: unknown = null;
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
  resetAssistantSpeechForTests();
});

afterEach(() => {
  cleanup();
  stopAssistantSpeech();
  resetAssistantSpeechForTests();
  Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true, writable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: undefined, configurable: true, writable: true });
});

function renderControls() {
  return render(
    <div>
      <div data-testid="msg-a">
        <AssistantSpeechControl messageId="a" content="أول رد تجريبي 10.000 ر.ع." />
      </div>
      <div data-testid="msg-b">
        <AssistantSpeechControl messageId="b" content="ثاني رد تجريبي" />
      </div>
    </div>,
  );
}

function wrapperFor(messageId: string): HTMLElement {
  const wrapper = document.querySelector(`[data-ai-speech-message-id="${messageId}"]`);
  expect(wrapper).not.toBeNull();
  return wrapper as HTMLElement;
}

function buttonFor(messageId: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(
    `[data-ai-speech-message-id="${messageId}"] [data-ai-speech-action]`,
  );
  expect(button).not.toBeNull();
  return button as HTMLButtonElement;
}

/**
 * External-store notifications reach React through the scheduler's message
 * loop, so assertions on derived UI state wait for the re-render to settle.
 */
async function expectSpeechState(messageId: string, expected: string): Promise<void> {
  await waitFor(() => {
    expect(wrapperFor(messageId).getAttribute('data-ai-speech-state')).toBe(expected);
  }, { timeout: 3000 });
}

describe('AssistantSpeechControl', () => {
  it('is hidden entirely when speech is unsupported (no dead controls)', () => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true, writable: true });
    renderControls();
    expect(document.querySelector('[data-ai-speech-control]')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders one compact accessible play control per assistant message', () => {
    renderControls();
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toHaveAccessibleName('تشغيل الرد');
      expect(button.getAttribute('data-ai-speech-action')).toBe('play');
      // 44px touch floor (WCAG 2.5.5 / iOS HIG) — the same contract the
      // design-system touch-target guard enforces statically: size-11 with
      // no sub-44px override in the local className.
      expect(button.className).toContain('size-11');
      expect(button.className).toContain('min-h-11');
      expect(button.className).toContain('min-w-11');
    }
  });

  it('plays the message: normalized text reaches the engine with an Arabic utterance', async () => {
    const clicks = userEvent.setup();
    renderControls();

    await clicks.click(screen.getAllByRole('button')[0]);

    expect(fake.queue.length).toBeGreaterThan(0);
    for (const utterance of fake.queue) expect(utterance.lang).toBe('ar-OM');
    const spoken = fake.queue.map((utterance) => utterance.text).join('');
    expect(spoken).toContain('عشرة ريال عماني');
    expect(spoken).not.toContain('ر.ع');

    await expectSpeechState('a', 'playing');
    const stopButton = screen.getAllByRole('button')[0];
    expect(stopButton).toHaveAccessibleName('إيقاف الرد');
    expect(stopButton.getAttribute('data-ai-speech-action')).toBe('stop');
  });

  it('stop returns to a replayable idle state and replay speaks again', async () => {
    const clicks = userEvent.setup();
    renderControls();

    const play = screen.getAllByRole('button')[0];
    await clicks.click(play);
    await expectSpeechState('a', 'playing');
    await clicks.click(play); // the control now offers stop

    await expectSpeechState('a', 'idle');
    expect(fake.queue).toHaveLength(0);

    const replay = screen.getAllByRole('button')[0];
    expect(replay).toHaveAccessibleName('إعادة تشغيل الرد');

    await clicks.click(replay);
    expect(fake.queue.length).toBeGreaterThan(0);
    expect(fake.queue.map((utterance) => utterance.text).join('')).toContain('عشرة ريال عماني');
  });

  it('starting another response stops the previous one (B stops A)', async () => {
    const clicks = userEvent.setup();
    renderControls();

    const [playA, playB] = screen.getAllByRole('button');
    await clicks.click(playA);
    await expectSpeechState('a', 'playing');
    // Per-message affordance: A offers stop, B still offers play.
    expect(buttonFor('a').getAttribute('data-ai-speech-action')).toBe('stop');
    expect(buttonFor('b').getAttribute('data-ai-speech-action')).toBe('play');

    await clicks.click(playB);
    // B's utterances are enqueued after the engine's short restart gap.
    await waitFor(() => {
      expect(fake.queue.map((utterance) => utterance.text).join('')).toContain('ثاني رد تجريبي');
    }, { timeout: 3000 });
    await expectSpeechState('b', 'playing');

    // B took over the single active session; A is back to play.
    expect(buttonFor('a').getAttribute('data-ai-speech-action')).toBe('play');
    expect(buttonFor('b').getAttribute('data-ai-speech-action')).toBe('stop');

    const spoken = fake.queue.map((utterance) => utterance.text).join('');
    expect(spoken).not.toContain('أول رد تجريبي');
    expect(spoken).toContain('ثاني رد تجريبي');
  });

  it('does not leave a false playing state when the engine fails mid-speech', async () => {
    const clicks = userEvent.setup();
    renderControls();

    await clicks.click(screen.getAllByRole('button')[0]);
    await expectSpeechState('a', 'playing');

    act(() => {
      fake.fail('synthesis-failed');
    });

    await expectSpeechState('a', 'idle');
    const button = screen.getAllByRole('button')[0];
    expect(button.getAttribute('data-ai-speech-action')).toBe('play');
    expect(button).not.toHaveAccessibleName('إيقاف الرد');
  });

  it('returns to idle with a replay label when the response finishes naturally', async () => {
    const clicks = userEvent.setup();
    renderControls();

    await clicks.click(screen.getAllByRole('button')[0]);
    await expectSpeechState('a', 'playing');
    act(() => {
      fake.completeAll();
    });

    await expectSpeechState('a', 'idle');
    expect(screen.getAllByRole('button')[0]).toHaveAccessibleName('إعادة تشغيل الرد');
  });

  it('is keyboard operable (focus + Enter)', async () => {
    const clicks = userEvent.setup();
    renderControls();

    const play = screen.getAllByRole('button')[0];
    play.focus();
    await clicks.keyboard('{Enter}');

    expect(fake.queue.length).toBeGreaterThan(0);
    await expectSpeechState('a', 'playing');
  });

  it('unmounting a control removes its UI while the global session keeps playing', async () => {
    // Speech is a single global session (one MALEK response at a time);
    // stopping it on navigation is owned by the mounted assistant surface
    // (useAssistantSpeech), not by an individual message control.
    const clicks = userEvent.setup();
    const view = renderControls();

    await clicks.click(screen.getAllByRole('button')[0]);
    await expectSpeechState('a', 'playing');

    view.unmount();

    expect(document.querySelector('[data-ai-speech-control]')).toBeNull();
    expect(fake.queue.length).toBeGreaterThan(0);
  });
});
