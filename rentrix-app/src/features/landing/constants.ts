// Public contact channels for the landing site — same domain as the app.

export const WHATSAPP_NUMBER = '96891928186';

export const CONTACT_EMAIL = 'Mohamedms.oud@outlook.com';

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Host shown in decorative browser frames and the footer. Same-origin by definition. */
export const APP_HOST =
  typeof window !== 'undefined' && window.location.host
    ? window.location.host
    : 'rentrixapp.vercel.app';
