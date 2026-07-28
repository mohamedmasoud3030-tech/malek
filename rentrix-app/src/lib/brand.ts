/**
 * MALIK brand identity — the single source of truth for every user-facing
 * product name and the fixed Arabic marketing line.
 *
 * The identity is a text-only wordmark. There is deliberately no logo asset,
 * no drawn `M` glyph, and no building/property icon: the product name is set
 * in the geometric wordmark face (Sora) while all Arabic body copy stays on
 * Cairo. Never render the Arabic transliteration «مالك» as the product name.
 */
export const APP_BRAND_NAME = 'MALIK';

/** Fixed Arabic marketing line. Must stay byte-identical wherever it appears. */
export const APP_BRAND_TAGLINE_AR = 'كل مُلكك في مكان واحد';

export const APP_BRAND_DESCRIPTION_AR =
  'منصة عربية متكاملة لإدارة العقارات والوحدات والعقود والتحصيلات والصيانة والتقارير.';

/** Lowercase slug for user-visible artifacts such as exported file names. */
export const APP_BRAND_FILE_SLUG = 'malik';

/**
 * Technical identifiers intentionally keep the legacy `rentrix` prefix during
 * the display rebrand. Persisted storage keys, the auth session key, package
 * names, repository paths, Supabase objects, and the deployed hostname are
 * stable contracts — renaming them in the same release would sign users out,
 * drop cached view preferences, or break existing integrations. They are
 * invisible to users and are tracked as a separate follow-up.
 */
export const LEGACY_TECHNICAL_BRAND_PREFIX = 'rentrix';

/**
 * Legacy visual assets kept on disk for git history and bundle-budget tests,
 * but no longer referenced by the manifest, the HTML head, or any component.
 * Safe to delete once the MALIK icon set is approved.
 */
export const LEGACY_UNUSED_BRAND_ASSETS = [
  'public/icon-rentrix-192.png',
  'public/icon-rentrix-512.png',
] as const;
