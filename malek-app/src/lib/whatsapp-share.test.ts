import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  WHATSAPP_PHONE_MAX_DIGITS,
  WHATSAPP_PHONE_MIN_DIGITS,
  WHATSAPP_TEXT_MAX_LENGTH,
  buildWhatsAppComposerUrl,
  normalizeWhatsAppPhone,
  openWhatsAppComposer,
} from './whatsapp-share';

describe('normalizeWhatsAppPhone', () => {
  it('accepts plain international digits with a leading plus', () => {
    expect(normalizeWhatsAppPhone('+96891234567')).toBe('96891234567');
    expect(normalizeWhatsAppPhone('96891234567')).toBe('96891234567');
  });

  it('accepts common separators used in Omani/mobile contacts', () => {
    expect(normalizeWhatsAppPhone('+968 9123-4567')).toBe('96891234567');
    expect(normalizeWhatsAppPhone('(+968) 9123 4567')).toBe('96891234567');
    expect(normalizeWhatsAppPhone('968.9123.4567')).toBe('96891234567');
  });

  it('rejects non-numeric, short, and over-long inputs fail closed', () => {
    expect(normalizeWhatsAppPhone('abc')).toBeNull();
    expect(normalizeWhatsAppPhone('+968')).toBeNull();
    expect(normalizeWhatsAppPhone('1'.repeat(WHATSAPP_PHONE_MIN_DIGITS - 1))).toBeNull();
    expect(normalizeWhatsAppPhone('1'.repeat(WHATSAPP_PHONE_MAX_DIGITS + 1))).toBeNull();
    expect(normalizeWhatsAppPhone('')).toBeNull();
  });
});

describe('buildWhatsAppComposerUrl', () => {
  it('builds a message-only wa.me link when no recipient is known', () => {
    const result = buildWhatsAppComposerUrl({ text: 'مرحباً' });
    expect(result).toEqual({
      ok: true,
      url: 'https://wa.me/?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B',
      mode: 'message-only',
    });
  });

  it('builds a phone-targeted wa.me link and keeps the number normalized', () => {
    const result = buildWhatsAppComposerUrl({
      phone: '+968 9123-4567',
      text: 'بيان الإيجار',
    });
    expect(result).toMatchObject({ ok: true, mode: 'phone' });
    if (result.ok) {
      expect(result.url).toBe(
        'https://wa.me/96891234567?text=%D8%A8%D9%8A%D8%A7%D9%86%20%D8%A7%D9%84%D8%A5%D9%8A%D8%AC%D8%A7%D8%B1',
      );
    }
  });

  it('supports the explicit WhatsApp Web composer', () => {
    const result = buildWhatsAppComposerUrl({
      phone: '96891234567',
      text: 'تقرير',
      webComposer: true,
    });
    expect(result).toMatchObject({ ok: true, mode: 'phone' });
    if (result.ok) expect(result.url).toContain('https://web.whatsapp.com/send?phone=96891234567');
  });

  it('rejects an empty message and over-long messages before any URL is built', () => {
    expect(buildWhatsAppComposerUrl({ text: '   ' })).toEqual({
      ok: false,
      reason: 'TEXT_REQUIRED',
    });
    expect(
      buildWhatsAppComposerUrl({ text: 'x'.repeat(WHATSAPP_TEXT_MAX_LENGTH + 1) }),
    ).toEqual({ ok: false, reason: 'TEXT_TOO_LONG' });
  });

  it('rejects an invalid recipient fail closed', () => {
    expect(buildWhatsAppComposerUrl({ phone: 'not-a-phone', text: 'مرحباً' })).toEqual({
      ok: false,
      reason: 'PHONE_INVALID',
    });
  });

  it('never logs or stores the prepared payload (pure function, no side effects)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const result = buildWhatsAppComposerUrl({ text: 'رسالة خاصة 96891234567' });
    expect(result.ok).toBe(true);
    expect(console.log).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openWhatsAppComposer', () => {
  it('returns opened=false when no opener exists (SSR/test safety)', () => {
    const outcome = openWhatsAppComposer({ text: 'مرحباً' });
    expect(outcome.opened).toBe(false);
    expect(outcome.result.ok).toBe(true);
  });

  it('opens the composer URL and lets callers detect a blocked popup', () => {
    const openedUrl: string[] = [];
    const outcome = openWhatsAppComposer({ text: 'مرحباً' }, (url) => {
      openedUrl.push(url);
      return null;
    });
    expect(openedUrl).toHaveLength(1);
    expect(openedUrl[0]).toContain('https://wa.me/?text=');
    expect(outcome.opened).toBe(false);
    expect(outcome.result.ok).toBe(true);
  });

  it('reports opened=true only when the browser returns a window', () => {
    const outcome = openWhatsAppComposer({ text: 'مرحباً' }, () => ({}) as Window);
    expect(outcome.opened).toBe(true);
  });

  it('does not open anything when the payload is invalid', () => {
    const opener = vi.fn(() => ({}) as Window);
    const outcome = openWhatsAppComposer({ text: '' }, opener);
    expect(outcome.opened).toBe(false);
    expect(outcome.result).toEqual({ ok: false, reason: 'TEXT_REQUIRED' });
    expect(opener).not.toHaveBeenCalled();
  });
});
