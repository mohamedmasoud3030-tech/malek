/**
 * Assistant voice-input engine — ar-OM dictation over Web Speech Recognition.
 *
 * Mirrors the speech (TTS) engine architecture: a module-level state machine
 * with subscribe/getState, so every mounted assistant surface (full route and
 * embedded floating panel) observes the SAME single active session — the user
 * can never hold two open microphones at once.
 *
 * Transcript merging: final results are committed in order and the current
 * interim fragment is appended after them, so the live text the user sees in
 * the compose box is always "everything said so far + what is being said".
 *
 * Failure modes are surfaced as Arabic, actionable messages (mic permission,
 * network, missing device) instead of raw browser error codes.
 */

export type AssistantVoiceInputStatus = 'idle' | 'listening';

export type AssistantVoiceInputState = Readonly<{
  supported: boolean;
  status: AssistantVoiceInputStatus;
  /** Live merged transcript: committed finals + current interim fragment. */
  transcript: string;
  /** Arabic error message for the latest failure, if any. */
  error: string | null;
}>;

export type AssistantVoiceInputCallbacks = Readonly<{
  /** Fired on every transcript change while listening (live dictation). */
  onTranscript?: (transcript: string) => void;
  /** Fired once with the final transcript when the user explicitly stops. */
  onFinal?: (transcript: string) => void;
}>;

type RecognitionResultLike = Readonly<{
  readonly 0: Readonly<{ readonly transcript: string }>;
  readonly isFinal: boolean;
}>;

type RecognitionEventLike = Readonly<{
  readonly resultIndex: number;
  readonly results: ReadonlyArray<RecognitionResultLike | undefined>;
}>;

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type RecognitionCtor = new () => RecognitionLike;

const VOICE_INPUT_LANG = 'ar-OM';

const MIC_PERMISSION_ERROR =
  'لا يمكن الوصول إلى الميكروفون. اسمح للموقع باستخدامه من إعدادات المتصفح ثم أعد المحاولة.';
const NETWORK_ERROR =
  'تعذر الاتصال بخدمة التعرّف على الكلام. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.';
const NO_SPEECH_HINT = 'لم أسمع شيئاً بعد. تحدث وأعد المحاولة.';

/** Terminal failures map to Arabic, actionable messages; no-speech is a hint. */
const ARABIC_RECOGNITION_ERRORS: Readonly<Record<string, string>> = {
  'not-allowed': MIC_PERMISSION_ERROR,
  'service-not-allowed': MIC_PERMISSION_ERROR,
  network: NETWORK_ERROR,
  'audio-capture': 'لم يتم العثور على ميكروفون متوافق. تأكد من توصيله ثم أعد المحاولة.',
  'no-speech': NO_SPEECH_HINT,
  'bad-grammar': 'تعذر فهم ما قلته. حاول بصياغة أبسط.',
  'language-not-supported': 'التعريف الصوتي بالعربية غير مدعوم في هذا المتصفح.',
};

const UNKNOWN_RECOGNITION_ERROR = 'تعذر التعرف على الكلام. أعد المحاولة.';

/** Pure mapping from a Web Speech error code to its user-facing Arabic message. */
export function getAssistantVoiceInputErrorMessage(code: string): string {
  return ARABIC_RECOGNITION_ERRORS[code] ?? UNKNOWN_RECOGNITION_ERROR;
}

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const candidate = (
    window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    }
  ).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  return typeof candidate === 'function' ? (candidate as RecognitionCtor) : null;
}

export function isAssistantVoiceInputSupported(): boolean {
  return getRecognitionCtor() !== null;
}

let state: AssistantVoiceInputState = {
  supported: typeof window !== 'undefined',
  status: 'idle',
  transcript: '',
  error: null,
};
let recognition: RecognitionLike | null = null;
let finalText = '';
let interimText = '';
let stopRequested = false;
/** Terminal error already reported — end handlers must not clobber it. */
let terminalError = false;
let callbacks: AssistantVoiceInputCallbacks = {};
const listeners = new Set<() => void>();

function setState(patch: Partial<AssistantVoiceInputState>): void {
  let changed = false;
  for (const [key, value] of Object.entries(patch) as Array<
    [keyof AssistantVoiceInputState, AssistantVoiceInputState[keyof AssistantVoiceInputState]]
  >) {
    if (state[key] !== value) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  state = { ...state, ...patch };
  for (const listener of [...listeners]) listener();
}

/** Installs the latest React closures without recreating the recognition object. */
export function setAssistantVoiceInputCallbacks(next: AssistantVoiceInputCallbacks): void {
  callbacks = next;
}

function mergeTranscript(): string {
  return [finalText, interimText]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
}

function handleResult(instance: RecognitionLike, event: RecognitionEventLike): void {
  if (recognition !== instance) return;
  let currentInterim = '';
  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    const alternative = result?.[0];
    if (!alternative) continue;
    const text = (alternative.transcript ?? '').trim();
    if (!text) continue;
    if (result.isFinal) {
      finalText = finalText ? `${finalText} ${text}` : text;
    } else {
      // A fresh interim batch replaces the previous fragment.
      currentInterim = text;
    }
  }
  interimText = currentInterim;
  const transcript = mergeTranscript();
  // Any new speech clears a non-terminal hint (e.g. "I heard nothing yet").
  setState({
    transcript,
    ...(terminalError || !state.error ? {} : { error: null }),
  });
  callbacks.onTranscript?.(transcript);
}

function handleError(instance: RecognitionLike, code: string | undefined): void {
  if (recognition !== instance) return;
  const error = code ?? 'unknown';
  if (error === 'aborted') return; // stop() path owns the state transition
  setState({ error: getAssistantVoiceInputErrorMessage(error) });
  if (error === 'no-speech') {
    // Non-terminal: the engine keeps listening, the hint stays until next input.
    return;
  }
  terminalError = true;
  setState({ status: 'idle', transcript: '' });
  try {
    instance.abort();
  } catch {
    // Engine already gone — cleanup still runs from the onend path or reset.
  }
}

function handleEnd(instance: RecognitionLike): void {
  if (recognition !== instance) return;
  const transcript = mergeTranscript();
  recognition = null;
  if (stopRequested) {
    // Explicit stop commits the transcript exactly once.
    callbacks.onFinal?.(transcript);
    setState({ status: 'idle', transcript: '', error: null });
    return;
  }
  // Natural end (engine timeout) — keep any terminal error already reported.
  if (state.status !== 'idle' || state.transcript !== '') {
    setState({ status: 'idle', transcript: '' });
  }
}

/**
 * Opens the microphone and streams dictation into the live transcript.
 * Returns false when a session is already active or the platform lacks
 * Web Speech Recognition — at most ONE session is ever active.
 */
export function startAssistantVoiceInput(): boolean {
  if (recognition && state.status === 'listening') return false;
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    setState({ supported: false, status: 'idle', error: null });
    return false;
  }

  finalText = '';
  interimText = '';
  stopRequested = false;
  terminalError = false;

  const instance: RecognitionLike = new Ctor();
  instance.lang = VOICE_INPUT_LANG;
  instance.continuous = true;
  instance.interimResults = true;
  instance.maxAlternatives = 1;
  instance.onresult = (event) => handleResult(instance, event);
  instance.onerror = (event) => handleError(instance, event.error);
  instance.onend = () => handleEnd(instance);

  recognition = instance;
  try {
    instance.start();
  } catch {
    recognition = null;
    setState({ status: 'idle', error: UNKNOWN_RECOGNITION_ERROR });
    return false;
  }
  setState({ supported: true, status: 'listening', transcript: '', error: null });
  return true;
}

/**
 * Stops the active session. The platform fires onend, which commits the
 * final transcript through `onFinal` exactly once and releases the mic.
 * Idempotent when no session is active.
 */
export function stopAssistantVoiceInput(): void {
  const instance = recognition;
  if (!instance) {
    if (state.status !== 'idle' || state.transcript !== '' || state.error !== null) {
      setState({ status: 'idle', transcript: '', error: null });
    }
    return;
  }
  stopRequested = true;
  try {
    instance.stop();
  } catch {
    try {
      instance.abort();
    } catch {
      // Engine already gone; fall through to deterministic cleanup.
    }
    handleEnd(instance);
  }
}

let liveSupportedCache: {
  state: AssistantVoiceInputState;
  supported: boolean;
  snapshot: AssistantVoiceInputState;
} | null = null;

export function getAssistantVoiceInputState(): AssistantVoiceInputState {
  const supported = isAssistantVoiceInputSupported();
  if (supported === state.supported) return state;
  if (!liveSupportedCache || liveSupportedCache.state !== state || liveSupportedCache.supported !== supported) {
    liveSupportedCache = {
      state,
      supported,
      snapshot: { ...state, supported },
    };
  }
  return liveSupportedCache.snapshot;
}

export function subscribeAssistantVoiceInputState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test hook: drop the session, callbacks and module state between suites. */
export function resetAssistantVoiceInputForTests(): void {
  recognition = null;
  finalText = '';
  interimText = '';
  stopRequested = false;
  terminalError = false;
  callbacks = {};
  listeners.clear();
  liveSupportedCache = null;
  state = {
    supported: typeof window !== 'undefined',
    status: 'idle',
    transcript: '',
    error: null,
  };
}
