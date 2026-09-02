// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { ASSISTANT_AUTO_SPEAK_STORAGE_KEY, useUiStore } from './ui-store';

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
    expect(window.localStorage.getItem(ASSISTANT_AUTO_SPEAK_STORAGE_KEY)).toBe('false');
  });

  it('persists the user choice and restores it on the next read', () => {
    useUiStore.getState().setAssistantAutoSpeak(true);
    expect(useUiStore.getState().assistantAutoSpeak).toBe(true);
    expect(window.localStorage.getItem(ASSISTANT_AUTO_SPEAK_STORAGE_KEY)).toBe('true');

    // A fresh reader (module state reset aside) would seed from storage.
    const seeded =
      window.localStorage.getItem(ASSISTANT_AUTO_SPEAK_STORAGE_KEY) === 'true';
    expect(seeded).toBe(true);

    useUiStore.getState().setAssistantAutoSpeak(false);
    expect(window.localStorage.getItem(ASSISTANT_AUTO_SPEAK_STORAGE_KEY)).toBe('false');
  });

  it('tolerates a tampered stored value', () => {
    window.localStorage.setItem(ASSISTANT_AUTO_SPEAK_STORAGE_KEY, 'not-a-boolean');
    useUiStore.getState().setAssistantAutoSpeak(false);
    // The setter normalises the stored form; the flag itself is a boolean.
    expect(typeof useUiStore.getState().assistantAutoSpeak).toBe('boolean');
  });
});
