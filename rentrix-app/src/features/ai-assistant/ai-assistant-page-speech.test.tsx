// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUiStore } from '@/store/ui-store';
import { AiAssistantPage } from './ai-assistant-page';

/**
 * Integration surface for the TTS upgrade: the REAL assistant page (real
 * message flow, real service, real speech engine) with only the two external
 * boundaries stubbed — the Supabase HTTP client and the speech platform.
 * The displayed text must stay byte-exact; only the speech variant changes.
 */

type FakeUtterance = { text: string; lang: string; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };

class FakeSpeechSynthesis {
  paused = false;
  speaking = false;
  pending = false;
  queue: FakeUtterance[] = [];
  voices = [{ name: 'Salem - Arabic (UAE)', lang: 'ar-AE', localService: true }];
  onvoiceschanged: (() => void) | null = null;
  speak(utterance: FakeUtterance): void {
    this.queue.push(utterance);
    this.speaking = true;
  }
  cancel(): void {
    for (const utterance of this.queue) utterance.onerror?.({ error: 'canceled' });
    this.queue = [];
    this.speaking = false;
    this.pending = false;
  }
  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
  }
  getVoices() {
    return this.voices;
  }
  completeAll(): void {
    for (const utterance of this.queue) utterance.onend?.();
    this.queue = [];
    this.speaking = false;
  }
  spokenText(): string {
    return this.queue.map((utterance) => utterance.text).join('');
  }
}

let fake: FakeSpeechSynthesis;

/** Seeded rows for the assistant's read-only context queries. */
const TABLES: Record<string, Record<string, unknown>[]> = {
  invoices: [
    { id: 'inv-1', contract_id: 'con-1', due_date: '2026-07-15', amount: 219.5, paid_amount: 0, status: 'OPEN', deleted_at: null },
    { id: 'inv-2', contract_id: 'con-1', due_date: '2026-08-01', amount: 420.5, paid_amount: 200, status: 'UNPAID', deleted_at: null },
  ],
  contracts: [
    { id: 'con-1', property_id: 'prop-1', tenant_id: 't-1', unit_id: 'u-1', end_date: '2026-09-30', rent_amount: 420, status: 'active', deleted_at: null },
  ],
  properties: [
    { id: 'prop-1', status: 'active', deleted_at: null },
    { id: 'prop-2', status: 'inactive', deleted_at: null },
  ],
  units: [
    { id: 'u-1', status: 'occupied', deleted_at: null },
    { id: 'u-2', status: 'occupied', deleted_at: null },
    { id: 'u-3', status: 'occupied', deleted_at: null },
    { id: 'u-4', status: 'available', deleted_at: null },
  ],
  payments: [
    { id: 'pay-1', amount: 512.25, payment_date: '2026-08-20', status: 'POSTED', deleted_at: null },
  ],
  expenses: [
    { id: 'exp-1', amount: 88.5, expense_date: '2026-08-18', deleted_at: null },
  ],
};

const REPLIES: Record<string, string> = {
  summarize_overdue_invoices:
    'يوجد 2 فاتورة متأخرة بإجمالي متبقٍ 440.000 ر.ع، وأقدم تاريخ استحقاق هو 2026-07-15. ابدأ بالأقدم ثم الأعلى قيمة، وتحقق من حالة التحصيل قبل أي تواصل.',
  summarize_month:
    'خلال آخر 30 يوماً تم تسجيل 1 دفعة بإجمالي 512.250 ر.ع، و1 مصروفاً بإجمالي 88.500 ر.ع. هذا ملخص تشغيلي سريع وليس إقفالاً أو تقريراً محاسبياً معتمداً.',
};

function makeTable(rows: Record<string, unknown>[]) {
  const chain = {
    select: () => chain,
    is: () => chain,
    not: () => chain,
    lte: () => chain,
    gte: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    returns: () => chain,
    range: async (_from: number, _to: number) => ({ data: rows, error: null }),
    // Direct awaits (non-paginated queries) resolve to the same shape.
    then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) =>
      resolve({ data: rows, error: null }),
  };
  return chain;
}

vi.mock('@/lib/env', () => ({
  env: {
    supabaseUrl: 'https://mock.supabase.test',
    supabaseAnonKey: 'mock-anon-key',
    isConfigured: true,
  },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children?: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => makeTable(TABLES[table] ?? []),
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'mock-token' } },
        error: null,
      }),
    },
  },
}));

function installSpeechEngine(): void {
  fake = new FakeSpeechSynthesis();
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true, writable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    writable: true,
    value: class {
      text: string;
      lang = '';
      voice: unknown = null;
      rate = 1;
      pitch = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    },
  });
}

beforeEach(() => {
  window.localStorage.clear();
  // Deterministic preference state for every test in this file.
  useUiStore.getState().setAssistantAutoSpeak(false);
  installSpeechEngine();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/functions/v1/ai-assistant')) {
      const body = {
        reply: null,
        grounded: true,
        caveats: ['قراءة فقط'],
        meta: { source: 'deterministic' },
      };
      try {
        const raw = init?.body ? JSON.parse(String(init.body)) as { action?: unknown } : null;
        if (raw && typeof raw.action === 'string' && REPLIES[raw.action]) body.reply = REPLIES[raw.action];
      } catch {
        // No body — answer below.
      }
      if (!body.reply) {
        body.reply = REPLIES.summarize_overdue_invoices;
      }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AiAssistantPage />
    </QueryClientProvider>,
  );
}

async function askQuickAction(clicks: ReturnType<typeof userEvent.setup>, title: string): Promise<void> {
  const action = screen.getByRole('button', { name: title });
  await clicks.click(action);
}

function assistantReplyBubbles(): HTMLElement[] {
  return [...document.querySelectorAll('[data-ai-speech-message-id]')];
}

/**
 * The speech control renders directly under the message <p> in the same
 * bubble, so locate the reply by its (exact) text and take the sibling
 * control wrapper.
 */
function replyControlFor(text: string): HTMLElement {
  const paragraph = [...document.querySelectorAll('p')].find((node) => node.textContent?.includes(text));
  expect(paragraph).not.toBeNull();
  const control = paragraph?.nextElementSibling;
  expect(control).not.toBeNull();
  return control as HTMLElement;
}

describe('AiAssistantPage + TTS integration', () => {
  it('shows the reply exactly as received and offers a subtle speaker control', async () => {
    const clicks = userEvent.setup();
    renderPage();

    await askQuickAction(clicks, 'مين متأخر؟');

    // The canonical text answer appears, financially exact (3dp OMR intact).
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('440.000 ر.ع'))).toBeInTheDocument();
    }, { timeout: 5000 });

    // A compact play control now exists on the assistant reply (not just the
    // welcome message): find the control inside the bubble with the answer.
    const replyControl = replyControlFor('440.000 ر.ع');
    const play = within(replyControl).getByRole('button');
    expect(play).toHaveAccessibleName('تشغيل الرد');
  });

  it('does not speak automatically by default (preference OFF)', async () => {
    const clicks = userEvent.setup();
    renderPage();

    await askQuickAction(clicks, 'مين متأخر؟');
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('440.000 ر.ع'))).toBeInTheDocument();
    }, { timeout: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fake.queue).toHaveLength(0);
    const autoToggle = document.querySelector('input[aria-label="التحدث تلقائياً بردود المساعد"]');
    expect(autoToggle).not.toBeNull();
    expect(autoToggle).not.toBeChecked();
  });

  it('manual playback speaks the normalized Arabic text while the display stays exact', async () => {
    const clicks = userEvent.setup();
    renderPage();

    await askQuickAction(clicks, 'مين متأخر؟');
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('440.000 ر.ع'))).toBeInTheDocument();
    }, { timeout: 5000 });

    const replyControl = replyControlFor('440.000 ر.ع');
    await clicks.click(within(replyControl).getByRole('button'));

    await waitFor(() => {
      expect(fake.queue.length).toBeGreaterThan(0);
    });
    const spoken = fake.spokenText();
    // 440.000 ر.ع → words with OMR precision; the raw symbol never reaches TTS.
    expect(spoken).toContain('أربعمائة وأربعون ريال عماني');
    expect(spoken).not.toContain('ر.ع');
    expect(spoken).not.toContain('440');
    // ISO date is spoken with the Arabic month name.
    expect(spoken).toContain('15 يوليو 2026');
    // The visible answer is untouched.
    expect(screen.getByText((content) => content.includes('440.000 ر.ع'))).toBeInTheDocument();

    // Stop returns the control to a replayable state.
    const stop = within(replyControl).getByRole('button', { name: 'إيقاف الرد' });
    await clicks.click(stop);
    await waitFor(() => {
      expect(within(replyControl).getByRole('button', { name: 'إعادة تشغيل الرد' })).toBeInTheDocument();
    });
  });

  it('with the preference ON, newly completed responses speak automatically', async () => {
    const clicks = userEvent.setup();
    renderPage();

    // Enable the preference through the same UI the user sees.
    const autoToggle = document.querySelector('input[aria-label="التحدث تلقائياً بردود المساعد"]') as HTMLInputElement;
    await clicks.click(autoToggle);
    expect(autoToggle).toBeChecked();

    await askQuickAction(clicks, 'ملخص الشهر');
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('512.250 ر.ع'))).toBeInTheDocument();
    }, { timeout: 5000 });

    // No manual click: the reply speaks on its own.
    await waitFor(() => {
      expect(fake.spokenText()).toContain('خمسمائة واثنا عشر ريال عماني ومائتان وخمسون بيسة');
    }, { timeout: 5000 });
    expect(fake.spokenText()).not.toContain('ر.ع');
  });

  it('playing a new response stops the previous one (B stops A) at the page level', async () => {
    const clicks = userEvent.setup();
    renderPage();

    await askQuickAction(clicks, 'مين متأخر؟');
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('440.000 ر.ع'))).toBeInTheDocument();
    }, { timeout: 5000 });

    // Play the first reply (A).
    const firstReplyControl = replyControlFor('440.000 ر.ع');
    await clicks.click(within(firstReplyControl).getByRole('button'));
    await waitFor(() => {
      expect(fake.spokenText()).toContain('أربعمائة وأربعون ريال عماني');
    });

    // Ask a second question; its reply (B) auto-stops A — but autoplay is OFF,
    // so play B manually to prove the engine-side guarantee.
    await askQuickAction(clicks, 'ملخص الشهر');
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('512.250 ر.ع'))).toBeInTheDocument();
    }, { timeout: 5000 });

    const secondReplyControl = replyControlFor('512.250 ر.ع');
    await clicks.click(within(secondReplyControl).getByRole('button'));

    await waitFor(() => {
      expect(fake.spokenText()).toContain('خمسمائة واثنا عشر ريال عماني');
    }, { timeout: 5000 });
    expect(fake.spokenText()).not.toContain('أربعمائة وأربعون ريال عماني');

    // The first control is back to a play (replay) affordance.
    await waitFor(() => {
      const buttons = within(firstReplyControl as HTMLElement).getAllByRole('button');
      expect(buttons.some((button) => button.getAttribute('aria-label') === 'إعادة تشغيل الرد' || button.getAttribute('aria-label') === 'تشغيل الرد')).toBe(true);
      expect(buttons.every((button) => button.getAttribute('aria-label') !== 'إيقاف الرد')).toBe(true);
    });
  });

  it('unmounting the assistant surface stops speech', async () => {
    const clicks = userEvent.setup();
    const view = renderPage();

    await askQuickAction(clicks, 'مين متأخر؟');
    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('440.000 ر.ع'))).toBeInTheDocument();
    }, { timeout: 5000 });

    const replyControl = replyControlFor('440.000 ر.ع');
    await clicks.click(within(replyControl).getByRole('button'));
    await waitFor(() => {
      expect(fake.queue.length).toBeGreaterThan(0);
    });

    view.unmount();
    await waitFor(() => {
      expect(fake.queue).toHaveLength(0);
    });
  });
});
