import { create } from 'zustand';
import type { SyncStatus } from '@/types/domain';
import { migrateLegacyStorageKeys } from '@/lib/legacy-storage-migration';

type Theme = 'light' | 'dark';

type UiState = {
  sidebarCollapsed: boolean;
  theme: Theme;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  /** Transient, per-session dismissal of the onboarding checklist (not persisted). */
  onboardingDismissed: boolean;
  /**
   * Automatically speak AI-assistant responses (device-level, persisted).
   * Defaults OFF so existing users never get unexpected audio; manual
   * playback via the speaker control always works regardless.
   */
  assistantAutoSpeak: boolean;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  setSyncStatus: (syncStatus: SyncStatus) => void;
  setLastSyncedAt: (lastSyncedAt: string | null) => void;
  setOnboardingDismissed: (value: boolean) => void;
  setAssistantAutoSpeak: (value: boolean) => void;
};

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  try {
    migrateLegacyStorageKeys(window.localStorage);
    return (localStorage.getItem('malek-theme') as Theme | null) ?? 'dark';
  } catch {
    return 'dark';
  }
};

export const ASSISTANT_AUTO_SPEAK_STORAGE_KEY = 'malek-assistant-auto-speak';

/** OFF by default — audio must never be enabled unexpectedly for existing users. */
const getInitialAssistantAutoSpeak = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    migrateLegacyStorageKeys(window.localStorage);
    return localStorage.getItem(ASSISTANT_AUTO_SPEAK_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  theme: getInitialTheme(),
  syncStatus: 'idle',
  lastSyncedAt: null,
  onboardingDismissed: false,
  assistantAutoSpeak: getInitialAssistantAutoSpeak(),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme: Theme) => {
    localStorage.setItem('malek-theme', theme);
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
  setSyncStatus: (syncStatus: SyncStatus) => set({ syncStatus }),
  setLastSyncedAt: (lastSyncedAt: string | null) => set({ lastSyncedAt }),
  setOnboardingDismissed: (value: boolean) => set({ onboardingDismissed: value }),
  setAssistantAutoSpeak: (value: boolean) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ASSISTANT_AUTO_SPEAK_STORAGE_KEY, String(value));
      } catch {
        // Storage unavailable — the preference still applies for this session.
      }
    }
    set({ assistantAutoSpeak: value });
  },
}));
