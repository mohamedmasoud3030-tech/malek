// Central place for environment-driven outbound links.
// Configure via .env (see .env.example) before deploying.

const fallbackAppUrl = 'https://rentrix-alpha.vercel.app/login';
const fallbackWhatsApp = '96891928186';
const fallbackEmail = 'Mohamedms.oud@outlook.com';

export const APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined)?.trim() || fallbackAppUrl;

export const WHATSAPP_NUMBER =
  (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.replace(/[^\d]/g, '') ||
  fallbackWhatsApp;

export const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || fallbackEmail;

/** Hostname of the app URL — used for decorative browser-address bars in device frames. */
export const APP_HOST = (() => {
  try {
    return new URL(APP_URL).hostname;
  } catch {
    return 'app.rentrix';
  }
})();

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
