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

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem('malik-theme') as Theme | null) ?? 'light';
};

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  theme: getInitialTheme(),
  syncStatus: 'idle',
  lastSyncedAt: null,
  onboardingDismissed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => {
    localStorage.setItem('malik-theme', theme);
    document.documentElement.dataset.theme = theme;
    set({ theme });
  },
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setOnboardingDismissed: (value) => set({ onboardingDismissed: value }),
}));
