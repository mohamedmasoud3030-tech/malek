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

export function printCurrentView(): void {
  if (typeof window === 'undefined' || typeof window.print !== 'function') return;
  window.print();
}

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
