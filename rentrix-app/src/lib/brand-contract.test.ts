import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_BRAND_FILE_SLUG,
  APP_BRAND_NAME,
  APP_BRAND_TAGLINE_AR,
  LEGACY_TECHNICAL_BRAND_PREFIX,
} from './brand';

/**
 * MALEK brand contract.
 *
 * This is the regression net for the Rentrix -> MALEK rebrand. It scans the
 * shipped UI, document/print, and marketing surfaces and fails when the legacy
 * product name reaches a user again, or when the approved mark/wordmark system
 * is replaced with an unreviewed brand asset.
 *
 * It deliberately does NOT ban the lowercase `rentrix` technical prefix: the
 * auth session key, theme key, view-mode keys, workbox cache names, package
 * names, and the current Vercel host are stable contracts that must not change
 * in the display rebrand. Those live in the allowlist below with a reason each.
 */

const appRoot = resolve(__dirname, '..', '..');
const srcRoot = join(appRoot, 'src');

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html', '.json']);

/** Directories that hold historical evidence or generated output, not shipped UI. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'coverage', 'evidence', 'test-results', 'playwright-report']);

/**
 * Files still allowed to mention the legacy display name, each for a stated
 * reason. Keep this list small — a new entry needs a real justification.
 */
const DISPLAY_NAME_ALLOWLIST = new Map<string, string>([
  [
    'src/lib/brand.ts',
    'Defines the rebrand itself and documents which legacy technical identifiers stay.',
  ],
  [
    'src/lib/brand-contract.test.ts',
    'This contract test necessarily names the legacy brand to search for it.',
  ],
  [
    'src/lib/toolchain-contract.test.ts',
    'Reads rentrix-app/package.json by repository path to pin the Vite/Vitest pair.',
  ],
  [
    'src/features/settings/companySettingsService.test.ts',
    'Fixture tenant names ("Rentrix Oman"/"Rentrix LLC") assert string normalization, not product identity.',
  ],
  [
    'src/features/settings/settingsForm.test.ts',
    'Fixture tenant names assert trimming/validation behaviour, not product identity.',
  ],
  [
    'src/features/settings/form/sectionDrafts.test.ts',
    'Fixture tenant names in the WP-D section-draft decomposition tests assert validation/slice behaviour, not product identity.',
  ],
  [
    'src/features/settings/settings-workspace-model.test.ts',
    'Fixture company row for the settings view model.',
  ],
  [
    'src/features/settings/settings-workspace.e2e-fixture.tsx',
    'Seeded company row mirrors production data captured before the rebrand.',
  ],
  [
    'src/features/settings/phase0-settings-auth-audit.test.ts',
    'Audits files by their repository path (rentrix-app/...), which is unchanged.',
  ],
  [
    'src/features/owners/components/OwnerSettlementWorkspace.test.tsx',
    'Fixture company name for an owner settlement snapshot.',
  ],
  [
    'src/services/documents/DocumentRenderer.test.ts',
    'Fixture company name proving the renderer echoes tenant identity, not a hardcoded brand.',
  ],
  [
    'src/services/documents/DocumentTemplates.test.ts',
    'Fixture company name proving templates echo tenant identity, not a hardcoded brand.',
  ],
  [
    'src/features/financials/expenses/expense-actions.test.ts',
    'Fixture company name passed into the voucher printer.',
  ],
  [
    'src/features/financials/invoices/invoice-actions.test.ts',
    'Fixture company name passed into the invoice document model.',
  ],
  [
    'src/features/contracts/actions/contractDetailActions.test.ts',
    'Fixture company name passed into the contract document model.',
  ],

  [
    'src/features/system/release-evidence-gates.test.ts',
    'Asserts the RENTRIX_STAGING_SEED_ID CI environment variable name.',
  ],

  [
    'src/features/reports/reports-workspace.e2e-fixture.tsx',
    'Fixture email address on the reserved @rentrix.test domain.',
  ],
  [
    'src/services/mock-role-simulator.ts',
    'Persisted localStorage key rentrix_simulated_role.',
  ],

  [
    'src/hooks/use-auth.tsx',
    'Auth session storage key rentrix-auth-session — renaming would sign every user out.',
  ],
  [
    'src/services/auth-service.ts',
    'Auth session storage key rentrix-auth-session — renaming would sign every user out.',
  ],
  [
    'src/lib/supabase.ts',
    'Supabase client storageKey rentrix-auth-session — renaming would sign every user out.',
  ],
  [
    'src/lib/supabase-client-boundary.test.ts',
    'Intentionally asserts the frozen rentrix-auth-session Supabase storageKey. This is a stable technical/session compatibility contract, not display branding; renaming it would break persisted authentication and sign users out.',
  ],
  [
    'src/services/auth-service.test.ts',
    'Intentionally seeds and asserts the frozen rentrix-auth-session key to prove corrupted/stale auth-session cleanup. This is a stable technical identifier and never user-facing branding.',
  ],
  [
    'src/lib/pwa-install.ts',
    'Persisted localStorage key rentrix.pwa-install-dismissed-at.',
  ],
  [
    'src/features/landing/i18n/LanguageContext.tsx',
    'Persisted localStorage key rentrix-landing-lang — renaming would reset the visitor language choice.',
  ],
  [
    'src/components/error-boundary.tsx',
    'Internal CatchBoundary reset key rentrix-root; never rendered to users.',
  ],
  [
    'src/features/landing/landing-performance-contract.test.ts',
    'Asserts that the landing chrome no longer references the legacy icon-rentrix assets.',
  ],
  [
    'src/store/ui-store.ts',
    'Persisted theme key rentrix-theme, also read by the inline theme script in index.html.',
  ],
  [
    'src/features/landing/constants.ts',
    'Fallback canonical host rentrixapp.vercel.app — frozen until a MALEK domain is approved.',
  ],
  [
    'src/features/landing/components/Showcase.tsx',
    'Static asset path /landing/rentrix-demo.mp4.',
  ],
  [
    'src/features/ai-assistant/services/ai-assistant-edge-function.test.ts',
    'Asserts the repository path rentrix-app/src/... when reading the frontend service file.',
  ],
  [
    'src/features/automation/background-worker-contract.test.ts',
    'Asserts the rentrix-automation-hourly Supabase cron job name in the migration.',
  ],
  [
    'src/lib/pwa-safety-contract.test.ts',
    'Negative assertion that the PWA config must not contain the legacy rentrix-pages cache name.',
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
/** This file names both brands on purpose; exclude it from its own scans. */
const SELF_PATH = 'src/lib/brand-contract.test.ts';
const relativePath = (file: string) => relative(appRoot, file).split('\\').join('/');
const read = (file: string) => readFileSync(file, 'utf8');
const readApp = (relativeToApp: string) => readFileSync(join(appRoot, relativeToApp), 'utf8');

describe('MALEK brand contract — identity constants', () => {
  it('exposes MALEK as the single user-facing product name', () => {
    expect(APP_BRAND_NAME).toBe('MALEK');
  });

  it('pins the Arabic marketing line to the approved wording', () => {
    expect(APP_BRAND_TAGLINE_AR).toBe('كل أملاكك في مكان واحد');
  });

  it('keeps the legacy technical prefix available and unchanged', () => {
    expect(LEGACY_TECHNICAL_BRAND_PREFIX).toBe('rentrix');
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
      .filter((path) => !DISPLAY_NAME_ALLOWLIST.has(path));

    expect(offenders, `Replace the user-facing name with APP_BRAND_NAME:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('has no unreviewed lowercase rentrix identifier in shipped source', () => {
    const offenders = sourceFiles
      .filter((file) => /rentrix/.test(read(file)))
      .map(relativePath)
      .filter((path) => !DISPLAY_NAME_ALLOWLIST.has(path));

    expect(offenders, `Classify each as display name or stable identifier:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('documents a reason for every allowlisted file and keeps the list current', () => {
    for (const [path, reason] of DISPLAY_NAME_ALLOWLIST) {
      expect(reason.length, `${path} needs an explanation`).toBeGreaterThan(20);
      expect(existsSync(join(appRoot, path)), `${path} is allowlisted but missing`).toBe(true);
    }

    // A stale allowlist hides regressions: every entry must still match.
    const stale = [...DISPLAY_NAME_ALLOWLIST.keys()].filter(
      (path) => !/rentrix/i.test(readApp(path)),
    );
    expect(stale, `Remove these cleaned-up files from the allowlist:\n${stale.join('\n')}`).toEqual([]);
  });

  it('keeps user-facing app chrome on the brand constant', () => {
    const appShell = readApp('src/app/layout/app-shell.tsx');
    expect(appShell).toContain('APP_BRAND_NAME');
    expect(appShell).toContain('MalikBrand');
    expect(appShell).not.toContain('Rentrix');

    const routeTree = readApp('src/app/router/route-tree.ts');
    expect(routeTree).toContain('APP_BRAND_NAME');
    expect(routeTree).not.toContain('Rentrix');
  });

  it('keeps the sidebar and drawer on the MALEK lockup and login on the PWA identity', () => {
    const appShell = readApp('src/app/layout/app-shell.tsx');
    // Both the expanded sidebar and the mobile drawer render the same <Brand/>.
    expect(appShell.match(/<Brand\s/g)?.length ?? 0).toBeGreaterThanOrEqual(2);

    const loginPage = readApp('src/features/auth/login-page.tsx');
    expect(loginPage).toContain('MalikBrand');
    expect(loginPage).toContain('layout="vertical"');
    expect(loginPage).toContain('showTagline');
    // Login now shows vertical M above MALEK with tagline centered, without welcome text
    // Tagline itself lives in MalikBrand component, not hardcoded in login file
    expect(loginPage).not.toContain('Rentrix');
  });

  it('keeps landing and legal pages on the MALEK identity', () => {
    const landingAndLegal = [
      'src/features/landing/components/NavBar.tsx',
      'src/features/landing/components/Footer.tsx',
      'src/features/landing/components/FinalCta.tsx',
      'src/features/landing/components/LegalPage.tsx',
      'src/features/landing/i18n/messages.ts',
      'src/features/landing/i18n/legal.ts',
    ];

    for (const file of landingAndLegal) {
      const source = readApp(file);
      expect(source, `${file} still shows the legacy name`).not.toContain('Rentrix');
      expect(source, `${file} lost the MALEK identity`).toMatch(/MALEK|APP_BRAND_NAME/);
    }
  });

  it('serves MALEK copy from the landing i18n source without a translation shim', () => {
    // The rebrand is applied at the source, so no runtime string replacement
    // layer should exist to paper over legacy copy.
    expect(existsSync(join(appRoot, 'src/features/landing/i18n/brand-messages.ts'))).toBe(false);
    expect(existsSync(join(appRoot, 'src/features/landing/i18n/brand-legal.ts'))).toBe(false);

    const messages = readApp('src/features/landing/i18n/messages.ts');
    expect(messages).toContain(`${APP_BRAND_NAME} | ${APP_BRAND_TAGLINE_AR}`);
  });

  it('keeps document, print, and export surfaces free of the legacy name', () => {
    const documentSurfaces = sourceFiles.filter((file) => {
      const path = relativePath(file);
      return (
        (path.startsWith('src/services/documents/')
          || path.startsWith('src/features/reports/')
          || path.startsWith('src/features/financials/')
          || path.startsWith('src/features/maintenance/')
          || path.startsWith('src/features/utilities/'))
        && !DISPLAY_NAME_ALLOWLIST.has(path)
      );
    });

    expect(documentSurfaces.length).toBeGreaterThan(0);
    for (const file of documentSurfaces) {
      expect(read(file), `${relativePath(file)} still shows the legacy name`).not.toContain('Rentrix');
    }
  });

  it('names user-visible CSV exports after the MALEK slug', () => {
    expect(readApp('src/features/contracts/contractListExport.ts')).toContain('APP_BRAND_FILE_SLUG');
    expect(readApp('src/features/properties/property-list-export.ts')).toContain('APP_BRAND_FILE_SLUG');
    expect(readApp('src/features/financials/components/expenses-section.tsx')).toContain('APP_BRAND_FILE_SLUG');
  });
});

describe('MALEK brand contract — mark, wordmark, and tagline', () => {
  it('ships one approved angular mark and keeps the runtime component on it', () => {
    expect(existsSync(join(appRoot, 'public/malek-mark.svg'))).toBe(true);
    expect(existsSync(join(appRoot, 'src/components/brand/malik-mark.tsx'))).toBe(true);

    const mark = readApp('public/malek-mark.svg');
    expect(mark).toMatch(/<title id="malek-mark-title">MALEK<\/title>/);
    expect(mark).toMatch(/viewBox="0 0 256 192"/);
    expect(mark).not.toMatch(/REAL ESTATE|PLATFORM|building/i);

    const brandComponent = readApp('src/components/brand/malik-brand.tsx');
    expect(brandComponent).toContain('MalikMark');
    expect(brandComponent).toContain('APP_BRAND_NAME');
    expect(brandComponent).toContain('APP_BRAND_TAGLINE_AR');
  });

  it('uses the mark alone in the collapsed sidebar rail', () => {
    const appShell = readApp('src/app/layout/app-shell.tsx');
    const brandComponent = readApp('src/components/brand/malik-brand.tsx');

    expect(appShell).toMatch(/isSidebarExpanded \? 'px-5' : 'px-1\.5'/);
    expect(appShell).toContain('compact={!expanded}');
    expect(brandComponent).toMatch(/if \(compact\)/);
    expect(brandComponent).toContain(`<MalikMark className={cn('size-10', markClassName)} />`);
  });

  it('places the complete lockup only on the high-visibility brand surfaces', () => {
    for (const file of [
      'src/features/auth/command-center-panel.tsx',
      'src/features/landing/components/Footer.tsx',
    ]) {
      expect(readApp(file), `${file} must show the MALEK tagline`).toContain('showTagline');
    }

    const loginPage = readApp('src/features/auth/login-page.tsx');
    expect(loginPage).toContain('MalikBrand');
    expect(loginPage).toContain('showTagline');

    expect(readApp('src/features/landing/components/NavBar.tsx')).toContain('MalikBrand');
    expect(readApp('src/components/layout/pwa-install-prompt.tsx')).toContain('MalikMark');
  });

  it('stops referencing the legacy Rentrix icons from the shipped shell', () => {
    // The PNGs stay on disk (documented as deletable legacy assets) but nothing
    // in the manifest, HTML head, service worker precache, or UI may load them.
    const indexHtml = readApp('index.html');
    const manifest = readApp('public/manifest.json');
    const viteConfig = readApp('vite.config.ts');

    expect(indexHtml).not.toContain('icon-rentrix');
    expect(manifest).not.toContain('icon-rentrix');
    // The legacy icon PNGs were fully removed from public/ (only malek-* remain),
    // so the precache no longer needs a globIgnores exclusion. The stronger
    // contract is that the build config never mentions the legacy icons at all.
    expect(viteConfig).not.toMatch(/icon-rentrix/);
    expect(viteConfig).not.toMatch(/includeAssets:\s*\[[^\]]*icon-rentrix/);

    const stillReferencing = sourceFiles
      .filter((file) => relativePath(file) !== SELF_PATH)
      .filter((file) => !DISPLAY_NAME_ALLOWLIST.has(relativePath(file)))
      .filter((file) => read(file).includes('icon-rentrix'));
    expect(stillReferencing.map(relativePath)).toEqual([]);
  });

  it('uses the geometric wordmark face without breaking Cairo for Arabic', () => {
    const indexHtml = readApp('index.html');
    const fontsCss = readApp('public/fonts/fonts.css');

    expect(indexHtml).toMatch(/\.malik-wordmark\s*\{[^}]*Sora/);
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
      icons?: Array<{ src: string; sizes: string; type: string; purpose: string }>;
    };

    expect(manifest.short_name).toBe(APP_BRAND_NAME);
    expect(manifest.name).toContain(APP_BRAND_NAME);
    expect(manifest.name).toContain(APP_BRAND_TAGLINE_AR);
    expect(manifest.name).not.toContain('Rentrix');
    expect(manifest.name).not.toContain('MALIK');
    expect(manifest.description).not.toContain('Rentrix');
    expect(manifest.icons).toEqual([
      { src: '/malek-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/malek-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/malek-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/malek-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/malek-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/malek-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ]);

    // Vector icons embed the canonical MALEK identity mark in the SVG itself.
    // Raster icons are generated from those same canonical SVGs and must exist
    // on disk at the exact install sizes required by iOS/Android.
    for (const icon of manifest.icons ?? []) {
      const assetPath = `public${icon.src}`;
      expect(existsSync(join(appRoot, assetPath)), `${icon.src} must exist`).toBe(true);
      if (icon.type === 'image/svg+xml') {
        const svg = readApp(assetPath);
        expect(svg, `${icon.src} must render the canonical MALEK identity`).toMatch(
          /<title[^>]*>[^<]*MALEK<\/title>/,
        );
      }
    }
  });

  it('brands the HTML head, Open Graph, Twitter, and structured data as MALEK', () => {
    const indexHtml = readApp('index.html');

    expect(indexHtml).toContain(`<title>${APP_BRAND_NAME} — ${APP_BRAND_TAGLINE_AR}</title>`);
    expect(indexHtml).toContain(`content="${APP_BRAND_NAME}"`);
    expect(indexHtml).toContain(`og:title" content="${APP_BRAND_NAME} | ${APP_BRAND_TAGLINE_AR}"`);
    expect(indexHtml).toContain(`twitter:title" content="${APP_BRAND_NAME} | ${APP_BRAND_TAGLINE_AR}"`);
    expect(indexHtml).toContain(`"name": "${APP_BRAND_NAME}"`);
    expect(indexHtml).toContain('apple-mobile-web-app-title" content="MALEK"');
    expect(indexHtml).toContain('rel="icon" href="/malek-mark.svg"');
    expect(indexHtml).toContain('rel="apple-touch-icon" href="/malek-apple-touch-180.png"');
    expect(indexHtml).toContain('sizes="180x180"');
    expect(existsSync(join(appRoot, 'public/malek-apple-touch-180.png'))).toBe(true);
    expect(indexHtml).not.toContain('MALIK');
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
    const installPrompt = readApp('src/components/layout/pwa-install-prompt.tsx');

    expect(installPrompt).toContain('APP_BRAND_NAME');
    expect(installPrompt).not.toContain('Rentrix');
  });
});
