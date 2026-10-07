// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAssistantVoiceInputState,
  isAssistantVoiceInputSupported,
  resetAssistantVoiceInputForTests,
  setAssistantVoiceInputCallbacks,
  startAssistantVoiceInput,
  stopAssistantVoiceInput,
  subscribeAssistantVoiceInputState,
} from './assistant-voice-input';

type FakeResult = {
  0: { transcript: string };
  isFinal: boolean;
  length: number;
};

/**
 * Deterministic stand-in for Web Speech Recognition. Sessions start, emit
 * result/error batches and end exactly like the browser platform, so the
 * engine's session lifecycle is exercised through its public surface only.
 */
class FakeSpeechRecognition {
  static instances: FakeSpeechRecognition[] = [];

  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  started = 0;
  stopCalls = 0;
  abortCalls = 0;
  onstart: (() => void) | null = null;
  onresult: ((event: { resultIndex: number; results: FakeResult[] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }

  start(): void {
    this.started += 1;
    this.onstart?.();
  }

  stop(): void {
    this.stopCalls += 1;
    // The platform ends the session after an explicit stop().
    this.onend?.();
  }

  abort(): void {
    this.abortCalls += 1;
    this.onend?.();
  }

  emitResult(transcript: string, isFinal: boolean): void {
    this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript }, isFinal, length: 1 }] });
  }

  emitError(code: string): void {
    this.onerror?.({ error: code });
  }
}

function installRecognition(): void {
  FakeSpeechRecognition.instances = [];
  Object.defineProperty(window, 'SpeechRecognition', {
    value: FakeSpeechRecognition,
    configurable: true,
    writable: true,
  });
}

function uninstallRecognition(): void {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
}

function activeInstance(): FakeSpeechRecognition {
  expect(FakeSpeechRecognition.instances).toHaveLength(1);
  return FakeSpeechRecognition.instances[0];
}

beforeEach(() => {
  resetAssistantVoiceInputForTests();
});

afterEach(() => {
  uninstallRecognition();
  resetAssistantVoiceInputForTests();
});

describe('assistant voice-input engine (ar-OM dictation)', () => {
  it('reports unsupported when the platform lacks speech recognition and start fails closed', () => {
    uninstallRecognition();
    expect(isAssistantVoiceInputSupported()).toBe(false);
    expect(startAssistantVoiceInput()).toBe(false);
    expect(FakeSpeechRecognition.instances).toHaveLength(0);
    const state = getAssistantVoiceInputState();
    expect(state.supported).toBe(false);
    expect(state.status).toBe('idle');
  });

  it('opens one continuous ar-OM session with interim results enabled', () => {
    installRecognition();
    expect(startAssistantVoiceInput()).toBe(true);
    const instance = activeInstance();
    expect(instance.lang).toBe('ar-OM');
    expect(instance.continuous).toBe(true);
    expect(instance.interimResults).toBe(true);
    expect(instance.maxAlternatives).toBe(1);
    expect(instance.started).toBe(1);
    expect(getAssistantVoiceInputState().status).toBe('listening');
  });

  it('auto-commits the first finalized utterance in live-call mode', () => {
    installRecognition();
    const onFinal = vi.fn();
    setAssistantVoiceInputCallbacks({ onFinal });

    expect(startAssistantVoiceInput({ autoCommitOnFinal: true })).toBe(true);
    const instance = activeInstance();
    expect(instance.continuous).toBe(false);

    instance.emitResult('احسب الإيجار المناسب', true);

    expect(instance.stopCalls).toBe(1);
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith('احسب الإيجار المناسب');
    expect(getAssistantVoiceInputState().status).toBe('idle');
    expect(getAssistantVoiceInputState().transcript).toBe('');
  });

  it('streams the live transcript to subscribers and callbacks', () => {
    installRecognition();
    const onTranscript = vi.fn();
    setAssistantVoiceInputCallbacks({ onTranscript });
    expect(startAssistantVoiceInput()).toBe(true);

    const snapshots: string[] = [];
    const unsubscribe = subscribeAssistantVoiceInputState(() => {
      snapshots.push(getAssistantVoiceInputState().transcript);
    });

    activeInstance().emitResult('مرحبا', false);

    expect(getAssistantVoiceInputState().transcript).toBe('مرحبا');
    expect(onTranscript).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenCalledWith('مرحبا');
    expect(snapshots).toContain('مرحبا');
    unsubscribe();
  });

  it('commits finals and merges them with the next interim fragment', () => {
    installRecognition();
    expect(startAssistantVoiceInput()).toBe(true);
    const instance = activeInstance();

    instance.emitResult('مرحبا', true);
    expect(getAssistantVoiceInputState().transcript).toBe('مرحبا');

    // Interim fragment is appended AFTER the committed final.
    instance.emitResult('بالعالم', false);
    expect(getAssistantVoiceInputState().transcript).toBe('مرحبا بالعالم');

    // The same words arriving as a final must not duplicate the committed text.
    instance.emitResult('بالعالم', true);
    expect(getAssistantVoiceInputState().transcript).toBe('مرحبا بالعالم');
  });

  it('accumulates committed finals in the order they were spoken', () => {
    installRecognition();
    expect(startAssistantVoiceInput()).toBe(true);
    const instance = activeInstance();

    instance.emitResult('ما', true);
    expect(getAssistantVoiceInputState().transcript).toBe('ما');
    instance.emitResult('الوقت', true);
    expect(getAssistantVoiceInputState().transcript).toBe('ما الوقت');
    instance.emitResult('سوا', true);
    expect(getAssistantVoiceInputState().transcript).toBe('ما الوقت سوا');
  });

  it('keeps a single active session — a second start is rejected while listening', () => {
    installRecognition();
    expect(startAssistantVoiceInput()).toBe(true);
    expect(startAssistantVoiceInput()).toBe(false);
    expect(FakeSpeechRecognition.instances).toHaveLength(1);
    expect(activeInstance().started).toBe(1);
  });

  it('maps mic permission and network failures to Arabic messages', () => {
    installRecognition();

    expect(startAssistantVoiceInput()).toBe(true);
    activeInstance().emitError('not-allowed');
    let state = getAssistantVoiceInputState();
    expect(state.error).toContain('الميكروفون');
    expect(state.status).toBe('idle');
    expect(state.transcript).toBe('');

    resetAssistantVoiceInputForTests();
    installRecognition();
    expect(startAssistantVoiceInput()).toBe(true);
    activeInstance().emitError('network');
    state = getAssistantVoiceInputState();
    expect(state.error).toContain('الإنترنت');
    expect(state.status).toBe('idle');
  });

  it('stop commits the transcript once and releases the session', () => {
    installRecognition();
    const onFinal = vi.fn();
    setAssistantVoiceInputCallbacks({ onFinal });
    expect(startAssistantVoiceInput()).toBe(true);
    const instance = activeInstance();

    instance.emitResult('أهلا', true);
    instance.emitResult('بكم', false);
    expect(getAssistantVoiceInputState().transcript).toBe('أهلا بكم');

    stopAssistantVoiceInput();

    expect(instance.stopCalls).toBe(1);
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith('أهلا بكم');
    const state = getAssistantVoiceInputState();
    expect(state.status).toBe('idle');
    expect(state.transcript).toBe('');
    expect(state.error).toBeNull();
  });
});
