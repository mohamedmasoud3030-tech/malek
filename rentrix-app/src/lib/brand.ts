/**
 * MALEK brand identity — the single source of truth for every user-facing
 * product name and the fixed Arabic marketing line.
 *
 * The visible English identity is MALEK. Historical repository paths,
 * persisted keys, database objects, and deployment compatibility identifiers
 * may retain their legacy spelling until they can be migrated safely.
 */
export const APP_BRAND_NAME = 'MALEK';

/** Fixed Arabic marketing line. Must stay byte-identical wherever it appears. */
export const APP_BRAND_TAGLINE_AR = 'كل أملاكك في مكان واحد';

export const APP_BRAND_DESCRIPTION_AR =
  'منصة عربية متكاملة لإدارة العقارات والوحدات والعقود والتحصيلات والصيانة والتقارير.';

/** Lowercase slug for user-visible artifacts such as exported file names. */
export const APP_BRAND_FILE_SLUG = 'malek';

/** Canonical runtime assets. Every visible brand surface must use these. */
export const APP_BRAND_MARK_ASSET = '/malek-mark.svg';
export const APP_BRAND_LOCKUP_ASSET = '/malek-lockup.svg';
export const APP_BRAND_MASKABLE_ASSET = '/malek-maskable.svg';

/**
 * Technical identifiers intentionally keep the legacy `rentrix` prefix during
 * the display rebrand. Persisted storage keys, auth/session keys, package
 * names, repository paths, and Supabase objects are stable contracts.
 */
export const LEGACY_TECHNICAL_BRAND_PREFIX = 'rentrix';

/**
 * Historical assets retained only as compatibility inputs and for migration
 * evidence. They must never be referenced by a visible runtime surface.
 */
export const LEGACY_UNUSED_BRAND_ASSETS = [
  'public/icon-rentrix-192.png',
  'public/icon-rentrix-512.png',
  'public/icon-malik-192.png',
  'public/icon-malik-512.png',
  'public/icon-maskable-192.png',
  'public/icon-maskable-512.png',
  'public/malik-mark.svg',
] as const;
