import { create } from 'zustand';
import type { SyncStatus } from '@/types/domain';

type Theme = 'light' | 'dark';

type UiState = {
  sidebarCollapsed: boolean;
  theme: Theme;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  /** Transient, per-session dismissal of the onboarding checklist (not persisted). */
  onboardingDismissed: boolean;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  setSyncStatus: (syncStatus: SyncStatus) => void;
  setLastSyncedAt: (lastSyncedAt: string | null) => void;
  setOnboardingDismissed: (value: boolean) => void;
};

const SIDEBAR_COLLAPSED_KEY = 'malek-sidebar-collapsed';

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  return (localStorage.getItem('rentrix-theme') as Theme | null) ?? 'dark';
};

const getInitialSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: getInitialSidebarCollapsed(),
  theme: getInitialTheme(),
  syncStatus: 'idle',
  lastSyncedAt: null,
  onboardingDismissed: false,
  toggleSidebar: () => set((state) => {
    const sidebarCollapsed = !state.sidebarCollapsed;
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {
      // Session-only collapse is still useful when storage is unavailable.
    }
    return { sidebarCollapsed };
  }),
  setTheme: (theme) => {
    localStorage.setItem('rentrix-theme', theme);
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setOnboardingDismissed: (value) => set({ onboardingDismissed: value }),
}));
