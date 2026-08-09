import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';

type RouterLocation = ReturnType<typeof useLocation>;

const BackgroundContext = createContext<RouterLocation | null>(null);

/**
 * BackgroundLocationProvider — tracks the location that should be rendered
 * behind a route-native dialog.
 *
 * Contract:
 * - If navigation was via `navigate({ state: { backgroundLocation } })`, that
 *   location is the background (handles nested dialogs correctly: Detail A
 *   → Detail B keeps original list as background).
 * - Otherwise, fallback to previous location (pathname + search + hash) — covers
 *   direct Link navigation without explicit state.
 * - Handles same-pathname + different search (e.g., /properties?section=units
 *   → /properties?section=lands) and preserves search/state.
 */
export function BackgroundLocationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const location = useLocation();
  const previousRef = useRef<RouterLocation | null>(null);
  const currentRef = useRef<RouterLocation>(location);

  useEffect(() => {
    const prev = currentRef.current;
    // Update previous when pathname, search, or hash changes (not just pathname)
    const changed =
      prev.pathname !== location.pathname ||
      JSON.stringify(prev.search) !== JSON.stringify(location.search) ||
      prev.hash !== location.hash;
    if (changed) {
      previousRef.current = prev;
      currentRef.current = location;
    }
  }, [location]);

  // Prefer explicit background from state (set by useDialogNavigate), fallback to previous
  const explicitBackground = (location.state as { backgroundLocation?: RouterLocation } | undefined)
    ?.backgroundLocation;
  const background = explicitBackground ?? previousRef.current;

  return (
    <BackgroundContext.Provider value={background ?? null}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackgroundLocation(): RouterLocation | null {
  return useContext(BackgroundContext);
}

/**
 * Returns true if current route should render as dialog over background.
 * Call inside a detail/create/edit route with the list prefixes that are
 * valid backgrounds (e.g., ['/properties'] for /properties/:id).
 */
export function useIsDialogRoute(expectedBackgroundPrefixes: readonly string[]): boolean {
  const background = useBackgroundLocation();
  if (!background) return false;
  const bgPath = background.pathname;
  return expectedBackgroundPrefixes.some(
    (prefix) => bgPath === prefix || bgPath.startsWith(`${prefix}/`) || bgPath === prefix,
  );
}

/**
 * Navigate while preserving the correct background for nested dialogs.
 * If current is already a dialog (has background), keep that background;
 * otherwise use current location as background.
 */
export function useDialogNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  const background = useBackgroundLocation();

  return (
    to:
      | string
      | {
          to: string;
          params?: Record<string, string>;
          search?: Record<string, unknown>;
        },
  ) => {
    // Resolve background to preserve: if already in dialog, keep original background
    const nextBackground = background ?? location;
    if (typeof to === 'string') {
      return (navigate as unknown as (opts: unknown) => void)({
        to,
        state: { backgroundLocation: nextBackground } as unknown as Record<string, unknown>,
      });
    }
    return (navigate as unknown as (opts: unknown) => void)({
      ...to,
      state: { backgroundLocation: nextBackground } as unknown as Record<string, unknown>,
    });
  };
}

