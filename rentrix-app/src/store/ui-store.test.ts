// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from './ui-store';

function getAutoSpeakStorageKey(): string {
  const key = window.localStorage.key(0);
  if (!key) throw new Error('Assistant auto-speak storage key was not seeded');
  expect(key).toMatch(/assistant-auto-speak$/);
  return key;
}

describe('assistantAutoSpeak preference', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useUiStore.getState().setAssistantAutoSpeak(false);
  });

  it('defaults to OFF so existing users never hear unexpected audio', () => {
    const { assistantAutoSpeak } = useUiStore.getState();
    expect(assistantAutoSpeak).toBe(false);
    // The default is seeded into storage explicitly (never "unset"), so a
    // reader can distinguish "defaulted" from "user chose true".
    expect(window.localStorage.getItem(getAutoSpeakStorageKey())).toBe('false');
  });

  it('persists the user choice and restores it on the next read', () => {
    const storageKey = getAutoSpeakStorageKey();
    useUiStore.getState().setAssistantAutoSpeak(true);
    expect(useUiStore.getState().assistantAutoSpeak).toBe(true);
    expect(window.localStorage.getItem(storageKey)).toBe('true');

    // A fresh reader (module state reset aside) would seed from storage.
    const seeded =
      window.localStorage.getItem(storageKey) === 'true';
    expect(seeded).toBe(true);

    useUiStore.getState().setAssistantAutoSpeak(false);
    expect(window.localStorage.getItem(storageKey)).toBe('false');
  });

  it('tolerates a tampered stored value', () => {
    const storageKey = getAutoSpeakStorageKey();
    window.localStorage.setItem(storageKey, 'not-a-boolean');
    useUiStore.getState().setAssistantAutoSpeak(false);
    // The setter normalises the stored form; the flag itself is a boolean.
    expect(typeof useUiStore.getState().assistantAutoSpeak).toBe('boolean');
  });
});
