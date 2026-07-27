export const APP_BRAND_NAME = 'MALIK';
export const APP_BRAND_TAGLINE_AR = 'كل مُلكك في مكان واحد';
export const APP_BRAND_DESCRIPTION_AR =
  'منصة عربية متكاملة لإدارة العقارات والوحدات والعقود والتحصيلات والصيانة والتقارير.';

const LEGACY_DISPLAY_BRAND_NAME = 'Rentrix';

export function replaceLegacyBrandText(value: string): string {
  return value.replaceAll(LEGACY_DISPLAY_BRAND_NAME, APP_BRAND_NAME);
}

export function applyBrandText<T>(value: T): T {
  if (typeof value === 'string') return replaceLegacyBrandText(value) as T;
  if (Array.isArray(value)) return value.map((item) => applyBrandText(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, applyBrandText(item)]),
    ) as T;
  }
  return value;
}

/**
 * Technical identifiers intentionally remain stable during the display rebrand.
 * Changing persisted storage prefixes, package names, repository paths, or deployed
 * hostnames in the same release could log users out or break existing integrations.
 */
export const LEGACY_TECHNICAL_BRAND_PREFIX = 'rentrix';
