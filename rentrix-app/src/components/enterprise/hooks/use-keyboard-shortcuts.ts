/**
 * useKeyboardShortcuts — Enterprise UX Foundation (Wave 4A)
 *
 * Declarative global/section keyboard shortcuts with a single window listener.
 * Supports modifier chords (`mod` = Ctrl on Windows/Linux, ⌘ on macOS),
 * input-field safety, and per-shortcut enablement. No business logic.
 *
 * @example
 * useKeyboardShortcuts([
 *   { keys: 'mod+k', description: 'بحث سريع', onTrigger: openSearch },
 *   { keys: 'escape', onTrigger: drawer.close },
 * ]);
 */

import { useEffect, useMemo, useRef } from 'react';

export interface EnterpriseShortcut {
  /** Chord syntax: `'mod+k'`, `'ctrl+shift+p'`, `'escape'`, `'?'`. Case-insensitive. */
  keys: string;
  /** Human-readable purpose — surfaced in help UIs / shortcut legends. */
  description?: string;
  /** Set false (or omit `enabled` on the hook) to suspend without unregistering. */
  enabled?: boolean;
  /** Fire even when the event target is an editable field. Default false. */
  allowInEditable?: boolean;
  /** Prevent the browser default for matched chords. Default true. */
  preventDefault?: boolean;
  onTrigger: (event: KeyboardEvent) => void;
}

interface UseKeyboardShortcutsOptions {
  /** Master switch for every shortcut. Default true. */
  enabled?: boolean;
  /** Bind to a specific element instead of window (advanced). */
  target?: HTMLElement | null;
}

interface ParsedChord {
  key: string;
  mod: boolean;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';

function parseChord(chord: string): ParsedChord {
  const parts = chord
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const parsed: ParsedChord = { key: '', mod: false, ctrl: false, shift: false, alt: false };
  for (const part of parts) {
    if (part === 'mod' || part === 'cmd' || part === 'meta') parsed.mod = true;
    else if (part === 'ctrl' || part === 'control') parsed.ctrl = true;
    else if (part === 'shift') parsed.shift = true;
    else if (part === 'alt' || part === 'option') parsed.alt = true;
    else parsed.key = part === 'space' ? ' ' : part;
  }
  return parsed;
}

function eventMatchesChord(event: KeyboardEvent, chord: ParsedChord): boolean {
  if (chord.mod && !(event.metaKey || event.ctrlKey)) return false;
  if (chord.ctrl && !event.ctrlKey) return false;
  if (chord.shift && !event.shiftKey) return false;
  if (chord.alt && !event.altKey) return false;

  // A plain chord must not fire while modifiers are held (except shift, which
  // is implicit for printable characters like '?').
  const wantsPlain = !chord.mod && !chord.ctrl && !chord.alt;
  if (wantsPlain && (event.metaKey || event.ctrlKey || event.altKey)) return false;
  if (!chord.mod && (event.metaKey || event.ctrlKey)) return false;

  return event.key.toLowerCase() === chord.key;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.closest(EDITABLE_SELECTOR) !== null;
}

export function useKeyboardShortcuts(
  shortcuts: EnterpriseShortcut[],
  options: UseKeyboardShortcutsOptions = {},
): void {
  const { enabled = true, target = null } = options;

  // Keep the latest handlers in a ref so the listener never re-subscribes
  // when inline arrow-function shortcuts are passed on every render.
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const parsed = useMemo(() => shortcuts.map((shortcut) => parseChord(shortcut.keys)), [shortcuts]);
  const parsedRef = useRef(parsed);
  parsedRef.current = parsed;

  useEffect(() => {
    if (!enabled) return undefined;
    const surface: HTMLElement | Window = target ?? window;
    if (!surface) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      const list = shortcutsRef.current;
      const chords = parsedRef.current;
      for (let index = 0; index < list.length; index += 1) {
        const shortcut = list[index];
        if (shortcut.enabled === false) continue;
        const chord = chords[index];
        if (!chord.key) continue;
        if (!eventMatchesChord(event, chord)) continue;
        if (!shortcut.allowInEditable && isEditableTarget(event.target)) continue;
        if (shortcut.preventDefault !== false) event.preventDefault();
        shortcut.onTrigger(event);
        return; // First match wins — one chord never fires two handlers.
      }
    };

    surface.addEventListener('keydown', handleKeyDown as EventListener);
    return () => surface.removeEventListener('keydown', handleKeyDown as EventListener);
  }, [enabled, target]);
}

/** Formats a chord for display: `'mod+k'` → `'Ctrl/⌘ + K'`. */
export function formatShortcutLabel(keys: string): string {
  return keys
    .split('+')
    .map((part) => {
      const normal = part.trim().toLowerCase();
      if (normal === 'mod') return 'Ctrl/⌘';
      if (normal === 'ctrl' || normal === 'control') return 'Ctrl';
      if (normal === 'shift') return 'Shift';
      if (normal === 'alt' || normal === 'option') return 'Alt';
      return normal.length === 1 ? normal.toUpperCase() : normal;
    })
    .join(' + ');
}
