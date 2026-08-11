import { buildWhatsAppUrl, openWhatsApp } from './whatsapp';

/**
 * Browser action boundary for release-candidate surfaces.
 *
 * Pages call these small adapters instead of duplicating browser-specific
 * print/share/WhatsApp behavior. Provider integrations remain outside the UI;
 * these helpers only open native/browser hand-offs and never mutate domain data.
 */

export type SharePayload = Readonly<{
  title: string;
  text?: string;
  url?: string;
}>;

/*
 * `printCurrentView()` (a bare `window.print()`) used to live here. It is
 * removed deliberately and must not come back: printing the current view
 * prints the whole application shell — navigation, sidebar, toasts and all —
 * instead of the intended document, and it bypasses the canonical document
 * platform entirely (no company-readiness guard, no A4 page policy, no RTL
 * document model, no truthful company identity).
 *
 * Every Print/PDF action must go through `documentService` →
 * `DocumentEngine` → `DocumentRenderer`, which renders the document alone in
 * a scoped A4 RTL popup. See UX-008 and the "Printing and documents"
 * contract; the boundary is enforced by
 * `services/documents/documentPlatform.boundaries.test.ts`.
 */

export async function shareOrCopy(payload: SharePayload): Promise<'shared' | 'copied' | 'unavailable'> {
  if (typeof window === 'undefined') return 'unavailable';

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share(payload);
    return 'shared';
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard && payload.url) {
    await navigator.clipboard.writeText(payload.url);
    return 'copied';
  }

  return 'unavailable';
}

export { buildWhatsAppUrl, openWhatsApp };

export function downloadTextFile(filename: string, contents: string, mimeType = 'text/plain;charset=utf-8'): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;

  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  URL.revokeObjectURL(url);
}
