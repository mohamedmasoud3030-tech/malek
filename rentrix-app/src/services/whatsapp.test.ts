import { describe, expect, it } from 'vitest';
import { buildWhatsAppUrl, normalizeWhatsAppPhone, renderMessageTemplate } from './whatsapp';

describe('whatsapp browser handoff helpers', () => {
  it('normalizes phone numbers and builds encoded wa.me URLs', () => {
    expect(normalizeWhatsAppPhone('+968 9000-0000')).toBe('96890000000');
    expect(buildWhatsAppUrl('+968 9000 0000', 'مرحباً بالعقد')).toBe(
      `https://wa.me/96890000000?text=${encodeURIComponent('مرحباً بالعقد')}`,
    );
  });

  it('renders template variables while preserving missing placeholders', () => {
    expect(renderMessageTemplate('مرحباً {{name}}، مبلغ {{amount}}، {{missing}}', { name: 'أحمد', amount: 25 })).toBe(
      'مرحباً أحمد، مبلغ 25، {{missing}}',
    );
  });
});
