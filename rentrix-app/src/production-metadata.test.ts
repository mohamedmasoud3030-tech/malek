import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const productionUrl = 'https://malek-plus.vercel.app/';
const socialImageUrl = `${productionUrl}opengraph.jpg`;

describe('production metadata', () => {
  it('uses the current Malek production URL for canonical and social metadata', () => {
    expect(html).toContain(`<link rel="canonical" href="${productionUrl}" />`);
    expect(html).toContain(`<meta property="og:url" content="${productionUrl}" />`);
    expect(html).toContain(`<meta property="og:image" content="${socialImageUrl}" />`);
    expect(html).toContain(`<meta name="twitter:image" content="${socialImageUrl}" />`);
    expect(html).not.toContain('rentrixapp.vercel.app');
  });
});
