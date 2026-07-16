// Central place for environment-driven outbound links.
// Configure via .env (see .env.example) before deploying.

const fallbackAppUrl = 'https://app.rentrix.example/login';
const fallbackWhatsApp = '96890000000';
const fallbackEmail = 'hello@rentrix.example';

export const APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined)?.trim() || fallbackAppUrl;

export const WHATSAPP_NUMBER =
  (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.replace(/[^\d]/g, '') ||
  fallbackWhatsApp;

export const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || fallbackEmail;

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
