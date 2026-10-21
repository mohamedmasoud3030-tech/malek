import { describe, expect, it } from 'vitest';
import { activeProductEdition } from '@/lib/product-edition';
import { getAllNavItems, quickCreateItems } from './app-nav-items';

describe('curated-edition navigation', () => {
  it('uses the curated Vite mode without changing the standard default', () => {
    expect(activeProductEdition).toBe(
      import.meta.env.MODE === 'property-operations' ? 'property-operations' : 'standard',
    );
  });

  it('hides excluded routes from every navigation surface in the curated mode', () => {
    if (activeProductEdition === 'standard') return;

    const paths = [...getAllNavItems(), ...quickCreateItems].map(([to]) => to);
    for (const excludedPath of ['/lands', '/leads', '/communication', '/settings/automation']) {
      expect(paths).not.toContain(excludedPath);
    }
  });
});
