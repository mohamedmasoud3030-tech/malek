/**
 * WhatsApp composer boundary — P4 Communications.
 *
 * Canonical contract (Document 6, "Printing, sharing and WhatsApp"):
 *   "WhatsApp integration initially prepares text/reference/link and opens
 *    WhatsApp/WhatsApp Web for the user to send manually. No automated
 *    messaging CRM is implied."
 *
 * This module implements exactly that:
 *   - it only builds a user-facing deep link (`wa.me` / WhatsApp Web);
 *   - it never calls a Business API, never sends a message, and never logs
 *     recipient or message content;
 *   - the caller is always the user's explicit click (human gesture), and the
 *     message body plus optional report link are placed in the URL only at
 *     that explicit action.
 *
 * The preview path (`outbound-communication-service.ts`) deliberately never
 * puts recipient/body into a URL; this module is the complementary, explicit
 * "open WhatsApp to send" path after a human review.
 */

/** Hard cap before URL-encoding to keep share links inside browser limits. */
export const WHATSAPP_TEXT_MAX_LENGTH = 2_000;
/** International phone: 8–15 digits after normalization (E.164 / wa.me). */
export const WHATSAPP_PHONE_MIN_DIGITS = 8;
export const WHATSAPP_PHONE_MAX_DIGITS = 15;

export type WhatsAppShareResult =
  | Readonly<{ ok: true; url: string; mode: 'phone' | 'message-only' }>
  | Readonly<{ ok: false; reason: 'TEXT_REQUIRED' | 'TEXT_TOO_LONG' | 'PHONE_INVALID' }>;

export type WhatsAppComposerRequest = Readonly<{
  /** Optional recipient. When absent the composer opens message-only. */
  phone?: string;
  /** Message body, prepared by a human-reviewed template or report share text. */
  text: string;
  /**
   * Defaults to `wa.me`. Use `web.whatsapp.com/send` only when the caller
   * explicitly prefers the web composer (e.g. no WhatsApp app installed).
   */
  webComposer?: boolean;
}>;

/**
 * Normalize a phone number for `wa.me`.
 *
 * Accepts international formats with or without `+` and common separators
 * (spaces, dashes, dots, parentheses). Returns the plain digit string or
 * `null` when the number cannot be a valid international number.
 */
export function normalizeWhatsAppPhone(value: string): string | null {
  const compact = value.replace(/[\s\-().]/g, '');
  if (!/^\+?\d+$/.test(compact)) return null;
  const digits = compact.replace(/^\+/, '');
  if (
    digits.length < WHATSAPP_PHONE_MIN_DIGITS ||
    digits.length > WHATSAPP_PHONE_MAX_DIGITS
  ) {
    return null;
  }
  return digits;
}

/**
 * Build a WhatsApp composer URL from a prepared message and optional phone.
 *
 * Pure and side-effect free: no window, no network, no logging. The returned
 * URL carries exactly what the user chose to send; callers must only invoke
 * this after consent/human-review artifacts have been confirmed by the UI.
 */
export function buildWhatsAppComposerUrl(
  request: WhatsAppComposerRequest,
): WhatsAppShareResult {
  const text = typeof request.text === 'string' ? request.text.trim() : '';
  if (!text) return { ok: false, reason: 'TEXT_REQUIRED' };
  if (text.length > WHATSAPP_TEXT_MAX_LENGTH) {
    return { ok: false, reason: 'TEXT_TOO_LONG' };
  }

  const encodedText = encodeURIComponent(text);
  const phoneValue = request.phone?.trim();
  const phone = phoneValue ? normalizeWhatsAppPhone(phoneValue) : null;
  if (phoneValue && !phone) return { ok: false, reason: 'PHONE_INVALID' };

  if (request.webComposer) {
    const url = phone
      ? `https://web.whatsapp.com/send?phone=${encodeURIComponent(phone)}&text=${encodedText}`
      : `https://web.whatsapp.com/send?text=${encodedText}`;
    return { ok: true, url, mode: phone ? 'phone' : 'message-only' };
  }

  const url = phone
    ? `https://wa.me/${encodeURIComponent(phone)}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
  return { ok: true, url, mode: phone ? 'phone' : 'message-only' };
}

export type WhatsAppOpenResult = Readonly<{
  opened: boolean;
  result: WhatsAppShareResult;
}>;

/** Opener abstraction so the boundary stays testable outside a browser. */
export type WhatsAppOpener = (url: string) => unknown;

const defaultOpener: WhatsAppOpener = (url) => {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return null;
  }
  return window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * Open the WhatsApp composer in a new tab/window for the user to send
 * manually. Returns `opened: false` when the environment has no window
 * (SSR/test) or the browser blocks the popup, so callers can show a neutral
 * retry message instead of failing silently.
 */
export function openWhatsAppComposer(
  request: WhatsAppComposerRequest,
  opener: WhatsAppOpener = defaultOpener,
): WhatsAppOpenResult {
  const result = buildWhatsAppComposerUrl(request);
  if (!result.ok) return { opened: false, result };

  const openedWindow = opener(result.url);
  return { opened: openedWindow !== null && openedWindow !== undefined, result };
}
