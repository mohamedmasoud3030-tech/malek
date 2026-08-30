/**
 * Endorsed-brand contract between MALEK and LENA Digital House.
 *
 * MALEK stays the product. LENA Digital House is the studio that developed it.
 * The login surface therefore links to the same-origin LENA namespace (/lena),
 * never to support, help, WhatsApp, email, GitHub or an internal Vercel host.
 */

/** Public LENA entry on the MALEK domain. `from=malek` is a non-sensitive referral marker. */
export const LENA_PUBLIC_ENTRY = '/lena/ar?from=malek';

/**
 * Platform production origin that MALEK reverse-proxies /lena to.
 * Must be a rewrite destination, never a browser-facing redirect.
 *
 * Update this when the Platform Vercel project production URL is confirmed.
 * vercel.json duplicates the same host so the edge rewrite does not depend on
 * runtime env interpolation (Vercel does not expand env vars in vercel.json).
 */
export const LENA_PLATFORM_REWRITE_ORIGIN = 'https://lena-digital-house.vercel.app';
