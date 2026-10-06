// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantStreamingText, splitRevealTokens } from './assistant-streaming-text';

/** A realistic multi-line-ish Arabic reply: 18 reveal tokens. */
const REPLY =
  'يوجد 2 فاتورة متأخرة بإجمالي متبقٍ 440.000 ر.ع، وأقدم تاريخ استحقاق هو 2026-07-15. ابدأ بالأقدم ثم الأعلى قيمة.';

function streamedParagraph(): HTMLElement {
  const node = document.querySelector<HTMLElement>('[data-ai-streaming-text]');
  expect(node).not.toBeNull();
  return node as HTMLElement;
}

function installReducedMotion(matches: boolean): void {
  const listeners = new Set<() => void>();
  const query = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
    addListener: (listener: () => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: () => void) => {
      listeners.delete(listener);
  },
  };
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn(() => query),
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (window as unknown as Record<string, unknown>).matchMedia;
});

describe('AssistantStreamingText', () => {
  it('reveals the reply word by word and finishes within the 800ms cap', () => {
    render(<AssistantStreamingText content={REPLY} />);
    // Nothing visible at the very first frame — the reveal has not ticked yet.
    expect(streamedParagraph().textContent).toBe('');
    expect(streamedParagraph().getAttribute('data-ai-streaming-text')).toBe('revealing');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    // Mid-reveal: a strict prefix, not the full reply.
    expect(streamedParagraph().textContent).not.toBe(REPLY);
    expect(streamedParagraph().textContent.length).toBeGreaterThan(0);

    // Well past the cap the FULL canonical text is visible.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(streamedParagraph().textContent).toBe(REPLY);
    expect(streamedParagraph().getAttribute('data-ai-streaming-text')).toBe('complete');
  });

  it('keeps the full canonical text available from the first moment', () => {
    // Tokens round-trip exactly: rejoining them reproduces the reply byte-for-byte.
    expect(splitRevealTokens(REPLY).join('')).toBe(REPLY);

    render(<AssistantStreamingText content={REPLY} />);
    const paragraph = streamedParagraph();
    // t=0: canonical already addressable; the visible span is decorative.
    expect(paragraph.getAttribute('aria-label')).toBe(REPLY);
    expect(paragraph.textContent).toBe('');
    expect(paragraph.querySelector('span[aria-hidden="true"]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(132);
    });
    // Mid-reveal: the visible part is only a prefix — the canonical label is untouched.
    expect(paragraph.textContent).not.toBe(REPLY);
    expect(paragraph.textContent.length).toBeGreaterThan(0);
    expect(paragraph.getAttribute('aria-label')).toBe(REPLY);
  });

  it('respects prefers-reduced-motion and shows the full reply immediately', () => {
    installReducedMotion(true);
    render(<AssistantStreamingText content={REPLY} />);
    expect(streamedParagraph().textContent).toBe(REPLY);
    expect(streamedParagraph().getAttribute('data-ai-streaming-text')).toBe('complete');
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(streamedParagraph().textContent).toBe(REPLY);
  });

  it('shows the progressive waiting indicator while pending, then reveals the reply', () => {
    const view = render(<AssistantStreamingText content="" isPending />);
    expect(screen.getByText('بقرأ بياناتك...')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('بحلل الوضع...')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('بجهز الإجابة...')).toBeInTheDocument();

    // The reply arrives: the indicator is replaced by the reveal.
    view.rerender(<AssistantStreamingText content="تم تجهيز الإجابة." />);
    expect(document.querySelector('[data-ai-pending-indicator]')).toBeNull();
    expect(screen.queryByText('بجهز الإجابة...')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText('تم تجهيز الإجابة.')).toBeInTheDocument();
  });
});
