// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { buildWhatsAppUrl, downloadTextFile, shareOrCopy } from './action-service';

describe('browser action service', () => {
  it('builds a safe WhatsApp hand-off URL', () => {
    expect(buildWhatsAppUrl('+968 9000 0000', 'مرحباً بالعقد')).toBe(
      `https://wa.me/96890000000?text=${encodeURIComponent('مرحباً بالعقد')}`,
    );
  });

  it('uses native share when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });

    await expect(shareOrCopy({ title: 'العقد', url: 'https://example.test/contracts/1' })).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'العقد', url: 'https://example.test/contracts/1' });
  });

  it('falls back to copying a URL when native share is unavailable', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    await expect(shareOrCopy({ title: 'العقد', url: 'https://example.test/contracts/1' })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://example.test/contracts/1');
  });

  it('keeps file download at the browser boundary without ever printing the app view', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadTextFile('test.txt', 'content');

    expect(click).toHaveBeenCalledOnce();
    // This module must never print the application shell: printing belongs to
    // the document platform (DocumentRenderer's scoped A4 popup) only.
    expect(print).not.toHaveBeenCalled();
    print.mockRestore();
    click.mockRestore();
  });

  it('exposes no whole-view print helper (UX-008 print bypass stays removed)', async () => {
    const actionService = await import('./action-service');
    expect(Object.keys(actionService)).not.toContain('printCurrentView');
  });
});
