import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from '@tanstack/react-router';

type BackgroundLocation = ReturnType<typeof useLocation> | null;

const BackgroundContext = createContext<BackgroundLocation>(null);

export function BackgroundLocationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const location = useLocation();
  const previousRef = useRef<BackgroundLocation>(null);
  const currentRef = useRef(location);

  // Store previous location when pathname changes (not search)
  useEffect(() => {
    if (currentRef.current.pathname !== location.pathname) {
      previousRef.current = currentRef.current;
      currentRef.current = location;
    }
  }, [location]);

  // For route masking, we consider background as previous location if current is a detail route
  // and previous was a list route. The detail route itself will decide if it should render as dialog.
  // We expose previous location as background.
  return (
    <BackgroundContext.Provider value={previousRef.current}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackgroundLocation(): BackgroundLocation {
  return useContext(BackgroundContext);
}

/**
 * Helper to determine if a detail route should render as dialog (modal) vs full page.
 * Returns true if navigated internally from a list (background exists and is different).
 */
export function useIsDialogRoute(expectedBackgroundPrefixes: readonly string[]): boolean {
  const background = useBackgroundLocation();
  const location = useLocation();
  if (!background) return false;
  // If current location is detail and background is a list, treat as dialog
  // e.g., /properties/123 with background /properties or /people
  const bgPath = background.pathname;
  return expectedBackgroundPrefixes.some((prefix) => bgPath === prefix || bgPath.startsWith(prefix + '/') || bgPath === prefix);
}
