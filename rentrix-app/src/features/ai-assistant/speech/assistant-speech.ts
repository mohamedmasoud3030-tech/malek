/**
 * Assistant speech engine — one MALEK response speaks at a time.
 *
 * Web Speech is deliberately kept behind a small state machine. The engine
 * owns native queue cleanup, keeps utterances strongly referenced for mobile
 * Safari, and treats browser-reported pending/speaking state as active even
 * if an earlier callback already moved React state back to idle.
 *
 * WebKit gets one utterance at a time. Safari/WKWebView can stall when several
 * SpeechSynthesisUtterance objects are queued eagerly; the next chunk is
 * therefore submitted only from the previous chunk's onend callback.
 */
import { buildAssistantSpeechText } from './assistant-speech-text';

export type AssistantSpeechStatus = 'idle' | 'playing' | 'paused';

export type AssistantSpeechState = Readonly<{
  status: AssistantSpeechStatus;
  messageId: string | null;
  supported: boolean;
  completedMessageId: string | null;
}>;

type SpeechVoiceLike = Readonly<{
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}>;

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
  onvoiceschanged?: (() => void) | null;
};

const SPEECH_UTTERANCE_LANG = 'ar-OM';
const MAX_CHUNK_CHARS = 200;
/** Some engines drop speak() when it follows cancel() in the same tick. */
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

/**
 * MALEK speaks with a feminine voice. Web Speech voices expose no gender
 * field, so gender is inferred from the well-known first names used by the
 * Microsoft (Azure/Edge), Apple and Google Arabic voice catalogues.
 *
 * Gender outweighs locale on purpose: a feminine ar-EG voice must beat a
 * masculine ar-OM voice, otherwise devices that only ship a male Omani voice
 * would silently fall back to a man speaking.
 */
const FEMALE_ARABIC_VOICE_NAMES: ReadonlyArray<string> = [
  // Microsoft / Azure neural voices (Edge & Windows)
  'aysha', 'ayesha', 'zariyah', 'hala', 'hoda', 'salma', 'fatima', 'laila', 'layla',
  'leila', 'amina', 'rana', 'sana', 'sanaa', 'noura', 'nora', 'iman', 'mouna',
  'amal', 'amany', 'reem', 'maryam', 'mariam', 'zeina', 'dalia',
  // Arabic-script equivalents some engines report
  'عائشة', 'زارية', 'هالة', 'هدى', 'سلمى', 'فاطمة', 'ليلى', 'أمينة', 'رنا', 'سناء',
  'نورة', 'إيمان', 'منى', 'أمل', 'أماني', 'ريم', 'مريم', 'زينة', 'داليا',
];

const MALE_ARABIC_VOICE_NAMES: ReadonlyArray<string> = [
  'abdullah', 'hamdan', 'hamed', 'hamid', 'shakir', 'bassel', 'taim', 'fahed',
  'rami', 'omar', 'jamal', 'moaz', 'naayf', 'laith', 'hedi', 'saleh', 'majed',
  'maged', 'salem', 'tarik', 'tariq', 'kareem', 'karim', 'ali', 'ismael',
  'عبدالله', 'عبد الله', 'حمدان', 'حامد', 'شاكر', 'باسل', 'تيم', 'فهد', 'رامي',
  'عمر', 'جمال', 'معاذ', 'نايف', 'ليث', 'صالح', 'ماجد', 'سالم', 'طارق', 'كريم',
];

function buildNamePattern(names: ReadonlyArray<string>): RegExp {
  return new RegExp(`(?:^|[^\\p{L}])(?:${names.join('|')})(?:[^\\p{L}]|$)`, 'iu');
}

const FEMALE_VOICE_PATTERN = buildNamePattern(FEMALE_ARABIC_VOICE_NAMES);
const MALE_VOICE_PATTERN = buildNamePattern(MALE_ARABIC_VOICE_NAMES);

const FEMALE_VOICE_BONUS = 40;
const MALE_VOICE_PENALTY = 30;

/** Classifies a voice as feminine, masculine, or unknown from its display name. */
export function classifyArabicVoiceGender(name: string): 'female' | 'male' | 'unknown' {
  const candidate = (name ?? '').trim();
  if (!candidate) return 'unknown';
  // "female" contains "male", so the feminine keyword must win first.
  if (/female|feminine|أنثى|امرأة/i.test(candidate) || FEMALE_VOICE_PATTERN.test(candidate)) {
    return 'female';
  }
  if (/\bmale\b|masculine|ذكر|رجل/i.test(candidate) || MALE_VOICE_PATTERN.test(candidate)) {
    return 'male';
  }
  return 'unknown';
}

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
  const Ctor = (window as unknown as {
    SpeechSynthesisUtterance?: new (text: string) => UtteranceLike;
  }).SpeechSynthesisUtterance;
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
  const gender = classifyArabicVoiceGender(voice.name);
  if (gender === 'female') score += FEMALE_VOICE_BONUS;
  else if (gender === 'male') score -= MALE_VOICE_PENALTY;
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

function shouldSequenceNativeQueue(): boolean {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent ?? '';
  if (!/AppleWebKit/i.test(userAgent)) return false;

  // Every browser on iPhone/iPad/iPod is WebKit, including CriOS/FxiOS/EdgiOS,
  // and WKWebView often omits the Safari token entirely. iPadOS can also
  // advertise itself as Macintosh when desktop-site mode is enabled.
  const isIOSDevice =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && (navigator.maxTouchPoints ?? 0) > 1);
  if (isIOSDevice) return true;

  // Android and desktop Chromium-based browsers also expose AppleWebKit in
  // their UA, but their speech engine should keep the normal eager native
  // queue. Misclassifying them is what collapses long-response tests to one
  // queued utterance.
  if (/Android/i.test(userAgent)) return false;
  if (/(?:Chrome|Chromium|Edg|OPR|SamsungBrowser)\//i.test(userAgent)) return false;

  // Real desktop Safari and Apple-hosted WebKit wrappers on macOS get the
  // conservative one-at-a-time path. Generic test/Chromium UAs do not.
  return /Safari\//i.test(userAgent) || /Macintosh|Mac OS X/i.test(userAgent);
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
      let fragment = '';
      for (const word of sentence.split(' ')) {
        if (word.length > maxChunkChars) {
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
  chunks: string[];
  totalChunks: number;
  finishedChunks: number;
  nextChunkIndex: number;
  sequential: boolean;
  /** Strong refs are required by Safari/iOS while native synthesis owns them. */
  utterances: UtteranceLike[];
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
  for (const [key, value] of Object.entries(patch) as Array<[
    keyof AssistantSpeechState,
    AssistantSpeechState[keyof AssistantSpeechState],
  ]>) {
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
      voiceschangeListener = () => setState({ supported: computeSupported() });
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

function releaseSession(session: Session): void {
  for (const utterance of session.utterances) {
    utterance.onstart = null;
    utterance.onend = null;
    utterance.onerror = null;
  }
  session.utterances.length = 0;
}

function endSession(session: Session, naturally: boolean): void {
  if (activeSession?.token !== session.token) return;
  releaseSession(session);
  activeSession = null;
  setState({
    status: 'idle',
    messageId: null,
    completedMessageId: naturally ? session.messageId : state.completedMessageId,
  });
}

/** Pitch used to feminize a device that only ships masculine Arabic voices. */
const MALE_VOICE_FALLBACK_PITCH = 1.35;

function configureUtterance(
  utterance: UtteranceLike,
  session: Session,
  voice: SpeechVoiceLike | null,
): void {
  utterance.lang = SPEECH_UTTERANCE_LANG;
  // SpeechSynthesisUtterance.voice must receive the native voice object,
  // not a cloned POJO. WebKit is particularly strict about this.
  utterance.voice = voice;
  utterance.rate = 1;
  // Devices with no feminine Arabic voice fall back to a known-masculine one;
  // a raised pitch keeps MALEK's persona feminine even there.
  utterance.pitch =
    voice && classifyArabicVoiceGender(voice.name) === 'male' ? MALE_VOICE_FALLBACK_PITCH : 1;
  utterance.onstart = () => {
    if (activeSession?.token === session.token && state.status !== 'playing') {
      setState({ status: 'playing' });
    }
  };
  utterance.onerror = (event) => {
    if (activeSession?.token !== session.token) return;
    const error = event?.error ?? 'unknown';
    if (typeof console !== 'undefined') {
      console.debug('[malek-assistant-speech] speech failed', error);
    }
    // Our own cancel path detaches callbacks before calling cancel(). If a
    // cancel/interruption reaches this handler it came from the platform, so
    // fail closed to idle instead of leaving a permanently stuck session.
    endSession(session, false);
  };
}

function speakSequentialChunk(
  synthesis: SpeechSynthesisLike,
  session: Session,
  voice: SpeechVoiceLike | null,
): void {
  if (activeSession?.token !== session.token) return;
  const index = session.nextChunkIndex;
  const chunk = session.chunks[index];
  if (chunk === undefined) {
    endSession(session, true);
    return;
  }

  const utterance = createUtterance(chunk);
  if (!utterance) {
    endSession(session, false);
    return;
  }
  session.nextChunkIndex += 1;
  session.utterances.push(utterance);
  configureUtterance(utterance, session, voice);
  utterance.onend = () => {
    if (activeSession?.token !== session.token) return;
    session.finishedChunks += 1;
    if (session.finishedChunks >= session.totalChunks) {
      endSession(session, true);
      return;
    }
    // Crucial for Safari/WKWebView: do not preload the native queue. Feed the
    // next chunk only after WebKit has fully ended the previous utterance.
    speakSequentialChunk(synthesis, session, voice);
  };

  try {
    synthesis.speak(utterance);
  } catch {
    endSession(session, false);
  }
}

function startChunkedSpeech(synthesis: SpeechSynthesisLike, session: Session, text: string): void {
  const chunks = chunkSpeechText(text);
  const voice = pickArabicVoice(synthesis.getVoices());
  session.chunks = chunks;
  session.totalChunks = chunks.length;
  session.finishedChunks = 0;
  session.nextChunkIndex = 0;
  session.utterances.length = 0;

  if (session.sequential) {
    speakSequentialChunk(synthesis, session, voice);
    return;
  }

  for (let index = 0; index < chunks.length; index += 1) {
    const utterance = createUtterance(chunks[index]);
    if (!utterance) {
      endSession(session, false);
      return;
    }
    session.utterances.push(utterance);
    configureUtterance(utterance, session, voice);

    const isLast = index === chunks.length - 1;
    utterance.onend = () => {
      if (activeSession?.token !== session.token) return;
      session.finishedChunks += 1;
      if (isLast || session.finishedChunks >= session.totalChunks) {
        endSession(session, true);
      }
    };

    try {
      synthesis.speak(utterance);
    } catch {
      endSession(session, false);
      return;
    }
  }
}

function nativeEngineBusy(synthesis: SpeechSynthesisLike): boolean {
  return Boolean(activeSession || restartTimer || synthesis.speaking || synthesis.pending || synthesis.paused);
}

/**
 * Plays an assistant message aloud, normalizing its text first.
 * Any current MALEK response — including a stale native browser queue — is
 * cancelled before the new response is launched.
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

  const hadNativeActivity = nativeEngineBusy(synthesis);
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (activeSession) {
    releaseSession(activeSession);
    activeSession = null;
  }
  if (hadNativeActivity) {
    try {
      synthesis.cancel();
    } catch {
      // Continue: a new session may still be accepted by the platform.
    }
  }

  sessionToken += 1;
  const session: Session = {
    token: sessionToken,
    messageId,
    chunks: [],
    totalChunks: 0,
    finishedChunks: 0,
    nextChunkIndex: 0,
    sequential: shouldSequenceNativeQueue(),
    utterances: [],
  };
  activeSession = session;
  setState({ status: 'playing', messageId, supported: true });

  const launch = () => {
    restartTimer = null;
    if (activeSession?.token !== session.token) return;
    if (synthesis.paused && typeof synthesis.resume === 'function') {
      try {
        synthesis.resume();
      } catch {
        // Best effort only; speak() below remains the source of truth.
      }
    }
    startChunkedSpeech(synthesis, session, speechText);
  };

  if (hadNativeActivity) {
    restartTimer = setTimeout(launch, RESTART_DELAY_MS);
  } else {
    launch();
  }
  return true;
}

/** Stops the current response and clears any native queue residue. */
export function stopAssistantSpeech(): void {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  const synthesis = getSpeechSynthesis();
  const stoppedMessageId = activeSession?.messageId ?? state.messageId;
  if (activeSession) {
    releaseSession(activeSession);
    activeSession = null;
  }
  if (synthesis) {
    try {
      synthesis.cancel();
    } catch {
      // Engine already gone — state cleanup still applies.
    }
  }
  setState({
    status: 'idle',
    messageId: null,
    completedMessageId: stoppedMessageId ?? state.completedMessageId,
  });
}

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

let liveSupportedCache: {
  state: AssistantSpeechState;
  supported: boolean;
  snapshot: AssistantSpeechState;
} | null = null;

export function getAssistantSpeechState(): AssistantSpeechState {
  const supported = isAssistantSpeechSupported();
  if (supported !== state.supported) {
    if (
      !liveSupportedCache ||
      liveSupportedCache.state !== state ||
      liveSupportedCache.supported !== supported
    ) {
      liveSupportedCache = {
        state,
        supported,
        snapshot: { ...state, supported },
      };
    }
    return liveSupportedCache.snapshot;
  }
  return state;
}

export function subscribeAssistantSpeechState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test hook: reset the module state machine between suites. */
export function resetAssistantSpeechForTests(): void {
  disposeAssistantSpeech();
  activeSession = null;
  sessionToken = 0;
  state = {
    status: 'idle',
    messageId: null,
    supported: typeof window !== 'undefined',
    completedMessageId: null,
  };
  liveSupportedCache = null;
}