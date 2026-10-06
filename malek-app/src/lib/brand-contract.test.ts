import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_BRAND_FILE_SLUG,
  APP_BRAND_LOCKUP_ASSET,
  APP_BRAND_MARK_ASSET,
  APP_BRAND_NAME,
  APP_BRAND_TAGLINE_AR,
} from './brand';

/**
 * MALEK brand contract.
 *
 * This contract scans shipped UI, document/print, and marketing surfaces to
 * keep the retired product name out of rendered content and pin the approved
 * MALEK mark/wordmark system.
 */

const appRoot = resolve(__dirname, '..', '..');
const srcRoot = join(appRoot, 'src');

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html', '.json']);

/** Directories that hold historical evidence or generated output, not shipped UI. */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'coverage',
  'evidence',
  'test-results',
  'playwright-report',
]);

/**
 * Source files may retain a former identifier only in a negative assertion or
 * the one-time persisted-storage migration boundary.
 */
const LEGACY_REFERENCE_ALLOWLIST = new Map<string, string>([
  [
    'src/lib/brand-contract.test.ts',
    'The negative UI scan asserts the retired display identity is not shipped.',
  ],
  [
    'src/lib/legacy-storage-migration.ts',
    'Isolated one-time aliases preserve saved auth and preferences while moving to MALEK keys.',
  ],
  [
    'src/lib/legacy-storage-migration.test.ts',
    'Regression coverage proves old persisted values migrate and are removed.',
  ],
  [
    'src/features/auth/session-storage.test.ts',
    'Regression coverage seeds and verifies cleanup of a pre-migration auth session.',
  ],
]);

function collectFiles(root: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      found.push(...collectFiles(full));
      continue;
    }
    if (SCANNED_EXTENSIONS.has(extname(entry.name))) found.push(full);
  }
  return found;
}

const sourceFiles = collectFiles(srcRoot);
const relativePath = (file: string) =>
  relative(appRoot, file).split('\\').join('/');
const read = (file: string) => readFileSync(file, 'utf8');
const readApp = (relativeToApp: string) =>
  readFileSync(join(appRoot, relativeToApp), 'utf8');

describe('MALEK brand contract — identity constants', () => {
  it('exposes MALEK as the single user-facing product name', () => {
    expect(APP_BRAND_NAME).toBe('MALEK');
  });

  it('routes brand mark and lockup through canonical MALEK assets', () => {
    expect(APP_BRAND_MARK_ASSET).toBe('/malek-mark.svg');
    expect(APP_BRAND_LOCKUP_ASSET).toBe('/malek-lockup.svg');
  });

  it('pins the Arabic marketing line to the approved wording', () => {
    expect(APP_BRAND_TAGLINE_AR).toBe('كل أملاكك في مكان واحد');
  });

  it('uses the MALEK slug for user-visible artifacts', () => {
    expect(APP_BRAND_FILE_SLUG).toBe('malek');
  });

  it('never presents the Arabic transliteration as the product name', () => {
    // «مالك» on its own is the Arabic word for "owner" and is used in domain
    // copy (owner statements, owner hub). It must never be the product name.
    expect(APP_BRAND_NAME).not.toContain('مالك');
    const brandSource = readApp('src/lib/brand.ts');
    expect(brandSource).not.toMatch(/APP_BRAND_NAME\s*=\s*['"`]مالك['"`]/);
  });
});

describe('MALEK brand contract — no legacy name reaches a user', () => {
  it('has no unreviewed Rentrix occurrence in shipped source', () => {
    const offenders = sourceFiles
      .filter((file) => read(file).includes('Rentrix'))
      .map(relativePath)
      .filter((path) => !LEGACY_REFERENCE_ALLOWLIST.has(path));

    expect(
      offenders,
      `Replace the user-facing name with APP_BRAND_NAME:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('has no unreviewed lowercase rentrix identifier in shipped source', () => {
    const offenders = sourceFiles
      .filter((file) => /rentrix/.test(read(file)))
      .map(relativePath)
      .filter((path) => !LEGACY_REFERENCE_ALLOWLIST.has(path));

    expect(
      offenders,
      `Classify each as display name or stable identifier:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('documents a reason for every allowlisted file and keeps the list current', () => {
    for (const [path, reason] of LEGACY_REFERENCE_ALLOWLIST) {
      expect(reason.length, `${path} needs an explanation`).toBeGreaterThan(20);
      expect(
        existsSync(join(appRoot, path)),
        `${path} is allowlisted but missing`,
      ).toBe(true);
    }

    // A stale allowlist hides regressions: every entry must still match.
    const stale = [...LEGACY_REFERENCE_ALLOWLIST.keys()].filter(
      (path) => !/rentrix/i.test(readApp(path)),
    );
    expect(
      stale,
      `Remove these cleaned-up files from the allowlist:\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps user-facing app chrome on the brand constant', () => {
    const appShell = readApp('src/app/layout/app-shell.tsx');
    expect(appShell).toContain('APP_BRAND_NAME');
    // The unified shell chrome renders the shared MALEK wordmark lockup.
    expect(appShell).toContain('MalekBrandWordmark');
    expect(appShell).not.toContain('Rentrix');

    const routeTree = readApp('src/app/router/route-tree.ts');
    expect(routeTree).toContain('APP_BRAND_NAME');
    expect(routeTree).not.toContain('Rentrix');
  });

  it('keeps the sidebar and header on the MALEK lockup and login on the PWA identity', () => {
    const appShell = readApp('src/app/layout/app-shell.tsx');
    // The desktop sidebar and the header brand render the same shared
    // wordmark lockup. The header brand is identity, not a menu trigger.
    expect(appShell).toContain('<Brand expanded />');
    expect(appShell).toContain('data-malek-brand-lockup');
    expect(appShell).toContain('<MalekBrandWordmark size="sidebar" />');
    expect(appShell).toContain('<MalekBrandWordmark size="header" />');
    expect(appShell).toContain('data-header-brand-identity');

    const loginPage = readApp('src/features/auth/login-page.tsx');
    expect(loginPage).toContain('MalekBrand');
    expect(loginPage).toContain('layout="vertical"');
    expect(loginPage).toContain('showTagline');
    expect(loginPage).toContain('placeholder="name@malek.com"');
    // Login now shows vertical M above MALEK with tagline centered, without welcome text
    // Tagline itself lives in MalekBrand component, not hardcoded in login file
    expect(loginPage).not.toContain('Rentrix');
  });

  it('keeps landing and legal pages on the MALEK identity', () => {
    const landingAndLegal = [
      'src/features/landing/components/NavBar.tsx',
      'src/features/landing/components/Footer.tsx',
      'src/features/landing/components/LegalPage.tsx',
      'src/features/landing/i18n/messages.ts',
      'src/features/landing/i18n/legal.ts',
    ];

    for (const file of landingAndLegal) {
      const source = readApp(file);
      expect(source, `${file} still shows the legacy name`).not.toContain(
        'Rentrix',
      );
      expect(source, `${file} lost the MALEK identity`).toMatch(
        /MALEK|APP_BRAND_NAME/,
      );
    }
  });

  it('serves MALEK copy from the landing i18n source without a translation shim', () => {
    // The rebrand is applied at the source, so no runtime string replacement
    // layer should exist to paper over legacy copy.
    expect(
      existsSync(join(appRoot, 'src/features/landing/i18n/brand-messages.ts')),
    ).toBe(false);
    expect(
      existsSync(join(appRoot, 'src/features/landing/i18n/brand-legal.ts')),
    ).toBe(false);

    const messages = readApp('src/features/landing/i18n/messages.ts');
    expect(messages).toContain(`${APP_BRAND_NAME} | ${APP_BRAND_TAGLINE_AR}`);
  });

  it('keeps document, print, and export surfaces free of the legacy name', () => {
    const documentSurfaces = sourceFiles.filter((file) => {
      const path = relativePath(file);
      return (
        (path.startsWith('src/services/documents/') ||
          path.startsWith('src/features/reports/') ||
          path.startsWith('src/features/financials/') ||
          path.startsWith('src/features/maintenance/') ||
          path.startsWith('src/features/utilities/')) &&
        !LEGACY_REFERENCE_ALLOWLIST.has(path)
      );
    });

    expect(documentSurfaces.length).toBeGreaterThan(0);
    for (const file of documentSurfaces) {
      expect(
        read(file),
        `${relativePath(file)} still shows the legacy name`,
      ).not.toContain('Rentrix');
    }
  });

  it('names user-visible CSV exports after the MALEK slug', () => {
    expect(readApp('src/features/contracts/contractListExport.ts')).toContain(
      'APP_BRAND_FILE_SLUG',
    );
    expect(
      readApp('src/features/properties/property-list-export.ts'),
    ).toContain('APP_BRAND_FILE_SLUG');
    expect(
      readApp('src/features/financials/components/expenses-section.tsx'),
    ).toContain('APP_BRAND_FILE_SLUG');
  });
});

describe('MALEK brand contract — mark, wordmark, and tagline', () => {
  it('ships one approved angular mark and keeps the runtime component on it', () => {
    expect(existsSync(join(appRoot, 'public/malek-mark.svg'))).toBe(true);
    expect(
      existsSync(join(appRoot, 'src/components/brand/malek-mark.tsx')),
    ).toBe(true);

    const mark = readApp('public/malek-mark.svg');
    expect(mark).toMatch(/<title id="malek-mark-title">MALEK<\/title>/);
    expect(mark).toMatch(/viewBox="0 0 256 192"/);
    expect(mark).not.toMatch(/REAL ESTATE|PLATFORM|building/i);
    const lockup = readApp('public/malek-lockup.svg');
    expect(lockup).toContain('<title id="malek-mark-title">MALEK</title>');

    const brandComponent = readApp('src/components/brand/malek-brand.tsx');
    expect(brandComponent).toContain('MalekMark');
    expect(brandComponent).toContain('APP_BRAND_NAME');
    expect(brandComponent).toContain('APP_BRAND_TAGLINE_AR');
  });

  it('keeps the desktop sidebar brand stable, named, and never mark-only', () => {
    const appShell = readApp('src/app/layout/app-shell.tsx');
    const brandComponent = readApp('src/components/brand/malek-brand.tsx');

    // The desktop sidebar is a fixed, named workspace rail; it no longer
    // collapses into a mark-only strip. The compact mark stays reserved for
    // the header monogram and other tight brand surfaces.
    expect(appShell).toContain('data-sidebar');
    expect(appShell).toContain('<Brand expanded />');
    expect(appShell).not.toMatch(/isSidebarExpanded/);
    expect(brandComponent).toMatch(/if \(compact\)/);
    expect(brandComponent).toContain(
      `<MalekMark className={cn('size-10', markClassName)} />`,
    );
  });

  it('places the complete lockup only on the high-visibility brand surfaces', () => {
    for (const file of ['src/features/landing/components/Footer.tsx']) {
      expect(readApp(file), `${file} must show the MALEK tagline`).toContain(
        'showTagline',
      );
    }

    const loginPage = readApp('src/features/auth/login-page.tsx');
    expect(loginPage).toContain('MalekBrand');
    expect(loginPage).toContain('showTagline');

    expect(readApp('src/features/landing/components/NavBar.tsx')).toContain(
      'MalekBrand',
    );
    expect(readApp('src/components/layout/pwa-install-prompt.tsx')).toContain(
      'MalekMark',
    );
  });

  it('uses the canonical MALEK mark throughout shell and install configuration', () => {
    const indexHtml = readApp('index.html');
    const manifest = JSON.parse(readApp('public/manifest.json')) as {
      icons?: Array<{ src: string }>;
    };
    const viteConfig = readApp('vite.config.ts');

    expect(indexHtml).toContain(APP_BRAND_MARK_ASSET);
    expect(
      manifest.icons?.some((icon) => icon.src === APP_BRAND_MARK_ASSET),
    ).toBe(true);
    expect(viteConfig).toContain('includeAssets');
  });

  it('uses the geometric wordmark face without breaking Cairo for Arabic', () => {
    const indexHtml = readApp('index.html');
    const fontsCss = readApp('public/fonts/fonts.css');

    expect(indexHtml).toMatch(/\.malek-wordmark\s*\{[^}]*Sora/);
    expect(indexHtml).toMatch(/body\s*\{[^}]*'Cairo'/);
    // Self-hosted faces (OD-12) replace the old Google Fonts css2?family= URL.
    expect(indexHtml).not.toContain('family=Sora');
    expect(fontsCss).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Sora'/);
    expect(fontsCss).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Cairo'/);
  });
});

describe('MALEK brand contract — PWA and document metadata', () => {
  it('brands the PWA manifest with the approved full MALEK logo icon', () => {
    const manifest = JSON.parse(readApp('public/manifest.json')) as {
      name: string;
      short_name: string;
      description: string;
      icons?: Array<{
        src: string;
        sizes: string;
        type: string;
        purpose: string;
      }>;
    };

    expect(manifest.short_name).toBe(APP_BRAND_NAME);
    expect(manifest.name).toContain(APP_BRAND_NAME);
    expect(manifest.name).toContain(APP_BRAND_TAGLINE_AR);
    expect(manifest.name).not.toContain('Rentrix');
    expect(manifest.description).not.toContain('Rentrix');
    expect(manifest.icons).toEqual([
      {
        src: '/malek-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/malek-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/malek-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/malek-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/malek-mark.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/malek-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ]);

    // Vector icons embed the canonical MALEK identity mark in the SVG itself.
    // Raster icons are generated from those same canonical SVGs and must exist
    // on disk at the exact install sizes required by iOS/Android.
    for (const icon of manifest.icons ?? []) {
      const assetPath = `public${icon.src}`;
      expect(
        existsSync(join(appRoot, assetPath)),
        `${icon.src} must exist`,
      ).toBe(true);
      if (icon.type === 'image/svg+xml') {
        const svg = readApp(assetPath);
        expect(
          svg,
          `${icon.src} must render the canonical MALEK identity`,
        ).toMatch(/<title[^>]*>[^<]*MALEK<\/title>/);
      }
    }
  });

  it('brands the HTML head, Open Graph, Twitter, and structured data as MALEK', () => {
    const indexHtml = readApp('index.html');

    expect(indexHtml).toContain(
      `<title>${APP_BRAND_NAME} — ${APP_BRAND_TAGLINE_AR}</title>`,
    );
    expect(indexHtml).toContain(`content="${APP_BRAND_NAME}"`);
    expect(indexHtml).toContain(
      `og:title" content="${APP_BRAND_NAME} | ${APP_BRAND_TAGLINE_AR}"`,
    );
    expect(indexHtml).toContain(
      `twitter:title" content="${APP_BRAND_NAME} | ${APP_BRAND_TAGLINE_AR}"`,
    );
    expect(indexHtml).toContain(`"name": "${APP_BRAND_NAME}"`);
    expect(indexHtml).toContain('apple-mobile-web-app-title" content="MALEK"');
    expect(indexHtml).toContain('rel="icon" href="/malek-mark.svg"');
    expect(indexHtml).toContain(
      'rel="apple-touch-icon" href="/malek-apple-touch-180.png"',
    );
    expect(indexHtml).toContain('sizes="180x180"');
    expect(existsSync(join(appRoot, 'public/malek-apple-touch-180.png'))).toBe(
      true,
    );
    expect(indexHtml).not.toContain('Rentrix');
  });

  it('brands the offline shell with the complete MALEK lockup', () => {
    const offline = readApp('public/offline.html');

    expect(offline).toContain(APP_BRAND_NAME);
    expect(offline).not.toContain('Rentrix');
    expect(offline).toContain('/malek-mark.svg');
    expect(offline).toContain(APP_BRAND_TAGLINE_AR);
  });

  it('brands the install prompt as MALEK', () => {
    const installPrompt = readApp(
      'src/components/layout/pwa-install-prompt.tsx',
    );

    expect(installPrompt).toContain('APP_BRAND_NAME');
    expect(installPrompt).not.toContain('Rentrix');
  });
});
