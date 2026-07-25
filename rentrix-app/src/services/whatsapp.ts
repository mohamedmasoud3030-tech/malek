export type WhatsAppTemplateVariables = Record<string, string | number | null | undefined>;

export function normalizeWhatsAppPhone(to: string | null | undefined): string {
  const normalized = (to ?? '').replace(/[^\d+]/g, '');
  return normalized.startsWith('+') ? normalized.slice(1) : normalized;
}

export function renderMessageTemplate(template: string, variables: WhatsAppTemplateVariables = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value === null || value === undefined || value === '' ? `{{${key}}}` : String(value);
  });
}

export function buildWhatsAppUrl(to: string | null | undefined, message: string): string {
  const phone = normalizeWhatsAppPhone(to);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(to: string | null | undefined, message: string): void {
  if (typeof window === 'undefined') return;
  window.open(buildWhatsAppUrl(to, message), '_blank', 'noopener,noreferrer');
}
