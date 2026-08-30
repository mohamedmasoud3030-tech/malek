/**
 * Parent-brand contract between MALEK and LENA Digital House.
 *
 * MALEK is an independent product. LENA Digital House is the parent company
 * that developed it. The login surface therefore endorses the company and
 * links to LENA's own website — never to support, help, WhatsApp, email,
 * GitHub, a MALEK `/lena` path, or a hardcoded preview host.
 *
 * Set `VITE_LENA_HOUSE_ORIGIN` on the MALEK Vercel project to the independent
 * LENA production origin (custom domain preferred). MALEK must not reverse-proxy
 * LENA; the two products keep separate deployments.
 */

export type LenaLocale = 'ar' | 'en';

function readConfiguredOrigin(): string {
  try {
    const raw = import.meta.env?.VITE_LENA_HOUSE_ORIGIN;
    return typeof raw === 'string' ? raw : '';
  } catch {
    return '';
  }
}

/** True when a candidate must never be used as the public LENA destination. */
export function isForbiddenLenaDestination(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return true;
  if (trimmed.includes('github.com')) return true;
  if (trimmed.includes('whatsapp')) return true;
  if (/(^|[^a-z])support([^a-z]|$)/.test(trimmed)) return true;
  if (/(^|[^a-z])help([^a-z]|$)/.test(trimmed)) return true;
  if (trimmed.includes('powered by')) return true;
  try {
    const url = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? new URL(trimmed)
      : new URL(trimmed, 'https://malek.invalid');
    if (url.pathname === '/lena' || url.pathname.startsWith('/lena/')) return true;
    if (url.pathname.includes('/products')) return true;
    if (url.pathname.includes('/support') || url.pathname.includes('/help')) return true;
  } catch {
    return true;
  }
  return false;
}

/**
 * Independent LENA Digital House origin with no trailing slash.
 * Empty string means the operator has not configured the public company site yet.
 */
export function resolveLenaHouseOrigin(raw: string | undefined | null = readConfiguredOrigin()): string {
  const origin = String(raw ?? '').trim().replace(/\/+$/, '');
  if (!origin) return '';
  if (!/^https:\/\//i.test(origin)) return '';
  if (isForbiddenLenaDestination(origin)) return '';
  return origin;
}

/**
 * LENA's normal homepage for a locale.
 * Lands on the company site root (`/ar` or `/en`), never `/products/malek`,
 * never support. `from=malek` is a non-PII referral marker for analytics only;
 * LENA must not change the homepage into a support or app-chooser flow.
 */
export function lenaHousePublicEntry(
  origin: string | undefined | null = readConfiguredOrigin(),
  locale: LenaLocale = 'ar',
): string {
  const resolved = resolveLenaHouseOrigin(origin);
  if (!resolved) return '';
  const url = new URL(`/${locale}`, `${resolved}/`);
  url.searchParams.set('from', 'malek');
  if (url.pathname.includes('/products') || url.pathname.includes('/support')) return '';
  return url.toString();
}

/** Login endorsement target. Empty when `VITE_LENA_HOUSE_ORIGIN` is unset. */
export const LENA_PUBLIC_ENTRY = lenaHousePublicEntry();
