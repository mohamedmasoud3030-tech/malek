export const PRODUCT_EDITION_IDS = ['standard', 'property-operations'] as const;
export type ProductEditionId = (typeof PRODUCT_EDITION_IDS)[number];

const editionRouteExclusions: Readonly<Record<Exclude<ProductEditionId, 'standard'>, readonly string[]>> = {
  'property-operations': [
    '/lands',
    '/leads',
    '/communication',
    '/ai-assistant',
    '/owner-portal',
    '/tenant-portal',
    '/settings/automation',
  ],
};

/**
 * The Vite mode is the product-edition selector. The default mode preserves the
 * existing all-features experience; a curated profile never changes auth/RLS
 * permissions and only controls which product surfaces are available.
 */
export const activeProductEdition: ProductEditionId =
  import.meta.env.MODE === 'property-operations' ? 'property-operations' : 'standard';

function pathIsWithin(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPathAvailableInEdition(
  pathname: string,
  edition: ProductEditionId = activeProductEdition,
): boolean {
  if (edition === 'standard') return true;
  return !editionRouteExclusions[edition].some((prefix) => pathIsWithin(pathname, prefix));
}
