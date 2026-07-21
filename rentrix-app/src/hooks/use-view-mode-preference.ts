import { useEffect, useState } from "react";
import type { ViewMode } from "@/components/ui/view-mode-toggle";

function readViewMode(storageKey: string, fallback: ViewMode): ViewMode {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === "grid" || stored === "list" ? stored : fallback;
  } catch {
    return fallback;
  }
}

/** Persists a page-specific list/card preference without making storage availability a runtime requirement. */
export function useViewModePreference(
  storageKey: string,
  fallback: ViewMode = "list",
  enabled = true,
) {
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    enabled ? readViewMode(storageKey, fallback) : fallback,
  );

  useEffect(() => {
    if (!enabled) return;
    try {
      window.localStorage.setItem(storageKey, viewMode);
    } catch {
      // Browsing modes that deny storage still keep the preference for this mounted session.
    }
  }, [enabled, storageKey, viewMode]);

  return [viewMode, setViewMode] as const;
}
