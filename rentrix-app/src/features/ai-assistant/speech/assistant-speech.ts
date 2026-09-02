/**
 * Assistant speech engine — one MALEK response speaks at a time.
 *
 * A module-level singleton over the Web Speech API (browser capability
 * detection only — no polyfills, no network voices). Text handed to
 * `playAssistantMessage` is speech-normalized here; the displayed response
 * is never touched.
 *
 * Guarantees honoured by design:
 *  - starting response B cancels response A (single active session);
 *  - `stopAssistantSpeech` cancels and returns the state machine to idle, so
 *    the UI can never show a false "playing" state after stop/navigation;
 *  - utterance errors (other than our own cancel/interrupt) fail the session
 *    back to idle — the text response remains fully functional;
 *  - long responses are chunked (Chrome truncates single utterances after
 *    ~15s, so MALEK responses are queued as bounded sentence chunks);
 *  - navigation-away (page hidden) and engine disposal stop speech;
 *  - Arabic-first voice selection: ar-OM, then Gulf locales, then any
 *    Arabic voice; the utterance `lang` is set to `ar-OM` even when the
 *    engine has no explicit Arabic voice.
 */
import { buildAssistantSpeechText } from './assistant-speech-text';

export type AssistantSpeechStatus = 'idle' | 'playing' | 'paused';

export type AssistantSpeechState = Readonly<{
  status: AssistantSpeechStatus;
  /** Id of the message currently speaking, or null. */
  messageId: string | null;
  /** True when the platform exposes a usable speechSynthesis. */
  supported: boolean;
  /** Message that finished (naturally or by stop) last — drives the replay label. */
  completedMessageId: string | null;
}>;

type SpeechVoiceLike = Readonly<{ name: string; lang: string; localService: boolean; default: boolean }>;
type UtteranceLike = {
  text: string;
  lang: string;
  voice: SpeechVoiceLike | null;
  rate: number;
  pitch: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};
type SpeechSynthesisLike = {
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  paused: boolean;
  speaking: boolean;
  pending: boolean;
  getVoices(): ReadonlyArray<SpeechVoiceLike>;
};

const SPEECH_UTTERANCE_LANG = 'ar-OM';
const MAX_CHUNK_CHARS = 200;
/** Chrome drops a speak() issued immediately after cancel(); buffer the gap. */
const RESTART_DELAY_MS = 120;

const ARABIC_VOICE_LOCALE_SCORES: Readonly<Record<string, number>> = {
  'ar-om': 100,
  ar: 95,
  'ar-sa': 90,
  'ar-ae': 88,
  'ar-bh': 85,
  'ar-qa': 84,
  'ar-kw': 83,
  'ar-lb': 80,
  'ar-jo': 78,
  'ar-eg': 75,
  'ar-iq': 74,
  'ar-ma': 72,
  'ar-dz': 70,
  'ar-tn': 70,
};

function getSpeechSynthesis(): SpeechSynthesisLike | null {
  if (typeof window === 'undefined') return null;
  const candidate = (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  if (!candidate || typeof candidate !== 'object') return null;
  const synthesis = candidate as SpeechSynthesisLike;
  if (typeof synthesis.speak !== 'function' || typeof synthesis.cancel !== 'function') return null;
  return synthesis;
}

function createUtterance(text: string): UtteranceLike | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as unknown as { SpeechSynthesisUtterance?: new (text: string) => UtteranceLike })
    .SpeechSynthesisUtterance;
  if (typeof Ctor !== 'function') return null;
  return new Ctor(text);
}

export function isAssistantSpeechSupported(): boolean {
  return getSpeechSynthesis() !== null && createUtterance('') !== null;
}

function scoreArabicVoice(voice: SpeechVoiceLike): number {
  const locale = (voice.lang ?? '').trim().toLowerCase().replace('_', '-');
  let score = ARABIC_VOICE_LOCALE_SCORES[locale] ?? (locale.startsWith('ar') ? 60 : 0);
  if (score === 0) return 0;
  if (voice.localService) score += 3;
  if (/neural|natural|online/i.test(voice.name)) score += 4;
  if (voice.default) score += 1;
  return score;
}

function pickArabicVoice(voices: ReadonlyArray<SpeechVoiceLike>): SpeechVoiceLike | null {
  let best: SpeechVoiceLike | null = null;
  let bestScore = 0;
  for (const voice of voices) {
    const score = scoreArabicVoice(voice);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

/** Splits speech text into bounded chunks on sentence boundaries. */
export function chunkSpeechText(text: string, maxChunkChars: number = MAX_CHUNK_CHARS): string[] {
  const sentences = text
    .split(/(?<=[.!?؟…؛])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';
  const flush = () => {
    if (current) chunks.push(current);
    current = '';
  };

  for (const sentence of sentences) {
    if (sentence.length > maxChunkChars) {
      flush();
      // Oversized sentence: split by words without dropping any content.
      let fragment = '';
      for (const word of sentence.split(' ')) {
        if (word.length > maxChunkChars) {
          // Pathological single word (e.g. a token without spaces): hard-split.
          if (fragment) {
            chunks.push(fragment);
            fragment = '';
          }
          for (let offset = 0; offset < word.length; offset += maxChunkChars) {
            chunks.push(word.slice(offset, offset + maxChunkChars));
          }
          continue;
        }
        if (fragment && fragment.length + word.length + 1 > maxChunkChars) {
          chunks.push(fragment);
          fragment = word;
        } else {
          fragment = fragment ? `${fragment} ${word}` : word;
        }
      }
      if (fragment) chunks.push(fragment);
      continue;
    }
    if (current && current.length + sentence.length + 1 > maxChunkChars) flush();
    current = current ? `${current} ${sentence}` : sentence;
  }
  flush();
  return chunks.length > 0 ? chunks : [text.trim()];
}

type Session = {
  token: number;
  messageId: string;
  totalChunks: number;
  finishedChunks: number;
  failed: boolean;
};

let state: AssistantSpeechState = {
  status: 'idle',
  messageId: null,
  supported: typeof window !== 'undefined',
  completedMessageId: null,
};
let activeSession: Session | null = null;
let sessionToken = 0;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let voiceschangeListener: (() => void) | null = null;
let visibilityListener: (() => void) | null = null;
const listeners = new Set<() => void>();

function computeSupported(): boolean {
  return isAssistantSpeechSupported();
}

function setState(patch: Partial<AssistantSpeechState>): void {
  let changed = false;
  for (const [key, value] of Object.entries(patch) as Array<[keyof AssistantSpeechState, AssistantSpeechState[keyof AssistantSpeechState]]>) {
    if (state[key] !== value) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  state = { ...state, ...patch };
  for (const listener of [...listeners]) listener();
}

function registerBrowserCleanup(): void {
  if (typeof document === 'undefined') return;
  if (!voiceschangeListener) {
    const synthesis = getSpeechSynthesis();
    if (synthesis && 'onvoiceschanged' in synthesis) {
      voiceschangeListener = () => {
        // Voices arrive asynchronously in most engines; nothing to cache here,
        // selection happens at session start — the listener keeps the
        // supported flag honest if the engine appears late.
        setState({ supported: computeSupported() });
      };
      synthesis.onvoiceschanged = voiceschangeListener;
    }
  }
  if (!visibilityListener) {
    visibilityListener = () => {
      if (document.visibilityState === 'hidden') stopAssistantSpeech();
    };
    document.addEventListener('visibilitychange', visibilityListener);
  }
}

function endSession(session: Session, naturally: boolean): void {
  if (activeSession?.token !== session.token) return;
  activeSession = null;
  setState({
    status: 'idle',
    messageId: null,
    completedMessageId: naturally ? session.messageId : state.completedMessageId,
  });
}

function startChunkedSpeech(synthesis: SpeechSynthesisLike, session: Session, text: string): void {
  const chunks = chunkSpeechText(text);
  const voice = pickArabicVoice(synthesis.getVoices());

  for (let index = 0; index < chunks.length; index += 1) {
    const utterance = createUtterance(chunks[index]);
    if (!utterance) {
      endSession(session, false);
      return;
    }
    utterance.lang = SPEECH_UTTERANCE_LANG;
    utterance.voice = voice ? { ...voice } : null;
    utterance.rate = 1;
    utterance.pitch = 1;

    const isLast = index === chunks.length - 1;
    utterance.onstart = () => {
      if (activeSession?.token === session.token && state.status !== 'playing') {
        setState({ status: 'playing' });
      }
    };
    utterance.onend = () => {
      if (activeSession?.token !== session.token) return;
      session.finishedChunks += 1;
      if (isLast || session.finishedChunks >= session.totalChunks) {
        endSession(session, true);
      }
    };
    utterance.onerror = (event) => {
      if (activeSession?.token !== session.token) return;
      const error = event?.error ?? 'unknown';
      if (error === 'canceled' || error === 'interrupted') return; // our own stop/new-play
      if (typeof console !== 'undefined') {
        console.debug('[malek-assistant-speech] speech failed', error);
      }
      endSession(session, false);
    };

    try {
      synthesis.speak(utterance);
    } catch {
      endSession(session, false);
      return;
    }
  }
}

function cancelActive(synthesis: SpeechSynthesisLike | null): boolean {
  if (activeSession) {
    activeSession = null;
    return true;
  }
  if (synthesis && (synthesis.speaking || synthesis.pending)) {
    return true;
  }
  return false;
}

/**
 * Plays an assistant message aloud, normalizing its text first.
 * Any currently-speaking MALEK response is stopped automatically.
 * Returns false (no state change) when speech is unsupported or the
 * message has no speakable content.
 */
export function playAssistantMessage(messageId: string, rawText: string): boolean {
  registerBrowserCleanup();
  const synthesis = getSpeechSynthesis();
  if (!synthesis || !createUtterance('')) {
    setState({ supported: false });
    return false;
  }

  const speechText = buildAssistantSpeechText(rawText);
  if (!speechText.trim()) return false;

  const hadActive = activeSession !== null;
  if (hadActive) synthesis.cancel();

  sessionToken += 1;
  const session: Session = { token: sessionToken, messageId, totalChunks: 0, finishedChunks: 0, failed: false };
  activeSession = session;
  setState({ status: 'playing', messageId, supported: true });

  const launch = () => {
    restartTimer = null;
    if (activeSession?.token !== session.token) return;
    startChunkedSpeech(synthesis, session, speechText);
  };

  if (hadActive) {
    // Chrome needs a beat between cancel() and the next speak().
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(launch, RESTART_DELAY_MS);
  } else {
    launch();
  }
  return true;
}

/** Stops the current response. Always returns the engine to idle. */
export function stopAssistantSpeech(): void {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  const synthesis = getSpeechSynthesis();
  const hadActive = cancelActive(synthesis);
  if (synthesis) {
    try {
      synthesis.cancel();
    } catch {
      // Engine already gone — state cleanup below still applies.
    }
  }
  if (hadActive) {
    setState({ status: 'idle', messageId: null, completedMessageId: state.messageId ?? state.completedMessageId });
  } else {
    setState({ status: 'idle', messageId: null });
  }
}

/**
 * Pauses the current response. The state flips to 'paused' only when the
 * engine actually reports a paused state — platforms whose pause() is a
 * no-op keep reporting 'playing' instead of a false state.
 */
export function pauseAssistantSpeech(): boolean {
  const synthesis = getSpeechSynthesis();
  if (!activeSession || !synthesis || typeof synthesis.pause !== 'function') return false;
  try {
    synthesis.pause();
  } catch {
    return false;
  }
  if (synthesis.paused) {
    setState({ status: 'paused' });
    return true;
  }
  return false;
}

/** Resumes a paused response. */
export function resumeAssistantSpeech(): boolean {
  const synthesis = getSpeechSynthesis();
  if (!activeSession || !synthesis || typeof synthesis.resume !== 'function') return false;
  try {
    synthesis.resume();
  } catch {
    return false;
  }
  if (!synthesis.paused) {
    setState({ status: 'playing' });
    return true;
  }
  return false;
}

/** Unsubscribes all listeners and stops speech. */
export function disposeAssistantSpeech(): void {
  stopAssistantSpeech();
  listeners.clear();
  const synthesis = getSpeechSynthesis();
  if (synthesis && voiceschangeListener && 'onvoiceschanged' in synthesis) {
    synthesis.onvoiceschanged = null;
  }
  voiceschangeListener = null;
  if (visibilityListener && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityListener);
  }
  visibilityListener = null;
}

let liveSupportedCache: { state: AssistantSpeechState; supported: boolean; snapshot: AssistantSpeechState } | null = null;

/**
 * Snapshot for React's useSyncExternalStore. The `supported` flag is
 * re-checked live so a component rendered before the engine became
 * available (or after it vanished) never shows a dead play control. The
 * derived snapshot is cached per (state, supported) pair so the getter
 * stays referentially stable, as useSyncExternalStore requires.
 */
export function getAssistantSpeechState(): AssistantSpeechState {
  const supported = isAssistantSpeechSupported();
  if (supported !== state.supported) {
    if (!liveSupportedCache || liveSupportedCache.state !== state || liveSupportedCache.supported !== supported) {
      liveSupportedCache = { state, supported, snapshot: { ...state, supported } };
    }
    return liveSupportedCache.snapshot;
  }
  return state;
}

export function subscribeAssistantSpeechState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test hook: reset the module state machine between suites. */
export function resetAssistantSpeechForTests(): void {
  disposeAssistantSpeech();
  activeSession = null;
  sessionToken = 0;
  state = { status: 'idle', messageId: null, supported: typeof window !== 'undefined', completedMessageId: null };
}
