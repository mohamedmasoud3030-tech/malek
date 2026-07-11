import { describe, expect, it } from 'vitest';
import {
  listNotificationTemplates,
  sendOutboundMessage,
} from './outbound-communication-service';

describe('outbound communication service boundary', () => {
  it('lists notification templates without embedding provider SDKs', () => {
    const templates = listNotificationTemplates('whatsapp');
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((template) => template.channel === 'whatsapp')).toBe(true);
  });

  it('builds a WhatsApp preview without sending automatically', async () => {
    const result = await sendOutboundMessage({
      channel: 'whatsapp',
      to: '+96891234567',
      body: 'مرحباً',
    });

    expect(result.accepted).toBe(true);
    expect(result.provider).toBe('local-preview');
    expect(result.previewUrl).toContain('wa.me/');
    expect(result.message).toContain('لم يتم الإرسال التلقائي');
  });

  it('requires a recipient for email drafts', async () => {
    const result = await sendOutboundMessage({
      channel: 'email',
      to: '',
      body: 'نص',
      subject: 'عنوان',
    });

    expect(result.accepted).toBe(false);
  });
});
