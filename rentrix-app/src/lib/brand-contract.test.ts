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
 * MALIK brand contract.
 *
 * This is the regression net for the Rentrix -> MALIK rebrand. It scans the
 * shipped UI, document/print, and marketing surfaces and fails when the legacy
 * product name reaches a user again, or when a visual logo is reintroduced.
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
    'src/features/settings/companySettingsService.test.ts',
    'Fixture tenant names ("Rentrix Oman"/"Rentrix LLC") assert string normalization, not product identity.',
  ],
  [
    'src/features/settings/settingsForm.test.ts',
    'Fixture tenant names assert trimming/validation behaviour, not product identity.',
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
    'src/features/financials/financial-readiness-gates.test.ts',
    'Reads source files by their repository path (rentrix-app/...), which is unchanged.',
  ],
  [
    'src/release/single-office-launch-contract.test.ts',
    'Reads source files by their repository path (rentrix-app/...), which is unchanged.',
  ],
  [
    'src/p3/phase3a1b-inventory-catalog.test.ts',
    'Walks the rentrix-app source directory by path.',
  ],
  [
    'src/features/system/release-evidence-gates.test.ts',
    'Asserts the RENTRIX_STAGING_SEED_ID CI environment variable name.',
  ],
  [
    'src/features/automation/automation-service-real.test.ts',
    'Asserts the rentrix-automation-hourly Supabase cron job name.',
  ],
  [
    'src/features/contracts/unit-contract-write-migrations.test.ts',
    'Asserts the rentrix-unit-status-hourly Supabase cron job name.',
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
    'src/features/onboarding/useOnboarding.ts',
    'Persisted localStorage keys rentrix_onboarding_* — renaming would reset onboarding for existing users.',
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
    'src/components/ui/entity-table.tsx',
    'Persisted view-mode key prefix rentrix:view-mode:*.',
  ],
  [
    'src/features/landing/constants.ts',
    'Fallback canonical host rentrixapp.vercel.app — frozen until a MALIK domain is approved.',
  ],
  [
    'src/features/landing/components/Showcase.tsx',
    'Static asset path /landing/rentrix-demo.mp4.',
  ],
  [
    'src/styles/globals.css',
    'Historical design-contract heading; not rendered to users.',
  ],
  [
    'src/styles/tokens.css',
    'Historical design-contract heading; not rendered to users.',
  ],
  [
    'src/styles/page-polish.css',
    'Historical design-contract heading; not rendered to users.',
  ],
  [
    'src/styles/product-palette.css',
    'Historical design-contract heading; not rendered to users.',
  ],
  [
    'src/styles/ux-foundation.css',
    'Historical design-contract heading; not rendered to users.',
  ],
]);

/** Persisted view-mode keys keep the legacy prefix; listing them keeps the scan honest. */
const VIEW_MODE_KEY_FILES = [
  'src/features/commissions/components/commissions-view.tsx',
  'src/features/communication/components/communication-hub-view.tsx',
  'src/features/contracts/components/ContractTable.tsx',
  'src/features/lands/components/lands-view.tsx',
  'src/features/leads/components/leads-view.tsx',
  'src/features/maintenance/components/maintenance-list.tsx',
  'src/features/owners/components/owner-workspace-table.tsx',
  'src/features/people/people-list-page.tsx',
  'src/features/properties/properties-list-page.tsx',
  'src/features/units/units-list.tsx',
  'src/features/units/units-page.tsx',
];
for (const file of VIEW_MODE_KEY_FILES) {
  DISPLAY_NAME_ALLOWLIST.set(file, 'Persisted view-mode key rentrix:view-mode:* kept stable for existing users.');
}

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

describe('MALIK brand contract — identity constants', () => {
  it('exposes MALIK as the single user-facing product name', () => {
    expect(APP_BRAND_NAME).toBe('MALIK');
  });

  it('pins the Arabic marketing line to the approved wording', () => {
    expect(APP_BRAND_TAGLINE_AR).toBe('كل مُلكك في مكان واحد');
  });

  it('keeps the legacy technical prefix available and unchanged', () => {
    expect(LEGACY_TECHNICAL_BRAND_PREFIX).toBe('rentrix');
    expect(APP_BRAND_FILE_SLUG).toBe('malik');
  });

  it('never presents the Arabic transliteration as the product name', () => {
    // «مالك» on its own is the Arabic word for "owner" and is used in domain
    // copy (owner statements, owner hub). It must never be the product name.
    expect(APP_BRAND_NAME).not.toContain('مالك');
    const brandSource = readApp('src/lib/brand.ts');
    expect(brandSource).not.toMatch(/APP_BRAND_NAME\s*=\s*['"`]مالك['"`]/);
  });
});

describe('MALIK brand contract — no legacy name reaches a user', () => {
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

  it('keeps the sidebar, drawer, and login surfaces on the MALIK wordmark', () => {
    const appShell = readApp('src/app/layout/app-shell.tsx');
    // Both the expanded sidebar and the mobile drawer render the same <Brand/>.
    expect(appShell.match(/<Brand\s/g)?.length ?? 0).toBeGreaterThanOrEqual(2);

    const loginPage = readApp('src/features/auth/login-page.tsx');
    expect(loginPage).toContain('APP_BRAND_NAME');
    expect(loginPage).toContain('malik-wordmark');
    expect(loginPage).not.toContain('Rentrix');
  });

  it('keeps landing and legal pages on the MALIK identity', () => {
    const landingAndLegal = [
      'src/features/landing/components/NavBar.tsx',
      'src/features/landing/components/Footer.tsx',
      'src/features/landing/components/Hero.tsx',
      'src/features/landing/components/FinalCta.tsx',
      'src/features/landing/components/LegalPage.tsx',
      'src/features/landing/i18n/messages.ts',
      'src/features/landing/i18n/legal.ts',
    ];

    for (const file of landingAndLegal) {
      const source = readApp(file);
      expect(source, `${file} still shows the legacy name`).not.toContain('Rentrix');
      expect(source, `${file} lost the MALIK identity`).toMatch(/MALIK|APP_BRAND_NAME/);
    }
  });

  it('serves MALIK copy from the landing i18n source without a translation shim', () => {
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

  it('names user-visible CSV exports after the MALIK slug', () => {
    expect(readApp('src/features/contracts/contractListExport.ts')).toContain('APP_BRAND_FILE_SLUG');
    expect(readApp('src/features/properties/property-list-export.ts')).toContain('APP_BRAND_FILE_SLUG');
    expect(readApp('src/features/financials/components/expenses-section.tsx')).toContain('APP_BRAND_FILE_SLUG');
  });
});

describe('MALIK brand contract — text-only wordmark, no visual mark', () => {
  it('ships no malik-mark asset or similar visual mark', () => {
    const forbidden = [
      'public/malik-mark.svg',
      'public/malik-logo.svg',
      'public/icon-malik-192.png',
      'public/icon-malik-512.png',
      'src/components/brand/malik-mark.tsx',
      'src/components/brand/malik-logo.tsx',
    ];

    for (const asset of forbidden) {
      expect(existsSync(join(appRoot, asset)), `${asset} must not exist — the identity is text-only`).toBe(false);
    }

    const referencingMark = sourceFiles
      .filter((file) => relativePath(file) !== SELF_PATH)
      .filter((file) => /malik-mark|malik-logo|MalikMark|MalikLogo/.test(read(file)));
    expect(referencingMark.map(relativePath)).toEqual([]);
  });

  it('keeps the collapsed sidebar rail able to show the whole wordmark', () => {
    // The rail is 4.5rem (72px). At px-5 the 5-letter wordmark overflows, so the
    // shell tightens the inline padding and the compact variant tightens tracking.
    const appShell = readApp('src/app/layout/app-shell.tsx');
    const brandComponent = readApp('src/components/brand/malik-brand.tsx');

    expect(appShell).toMatch(/isSidebarExpanded \? 'px-5' : 'px-1\.5'/);
    expect(brandComponent).toContain("compact ? 'text-[0.6875rem] tracking-[0.06em]'");
    // A truncating wordmark in the collapsed rail would clip MALIK to "MALI…".
    expect(brandComponent).not.toMatch(/compact \? '[^']*truncate/);
  });

  it('keeps MalikBrand a pure text wordmark', () => {
    const brandComponent = readApp('src/components/brand/malik-brand.tsx');

    expect(brandComponent).not.toMatch(/<svg/i);
    expect(brandComponent).not.toMatch(/<img/i);
    expect(brandComponent).not.toMatch(/<path/i);
    expect(brandComponent).not.toMatch(/backgroundImage|url\(/);
    expect(brandComponent).toContain('APP_BRAND_NAME');
    expect(brandComponent).toContain('malik-wordmark');
  });

  it('renders no brand image anywhere in the shell, login, or landing chrome', () => {
    const chrome = [
      'src/app/layout/app-shell.tsx',
      'src/features/auth/login-page.tsx',
      'src/features/landing/components/NavBar.tsx',
      'src/features/landing/components/Footer.tsx',
    ];

    for (const file of chrome) {
      const source = readApp(file);
      expect(source, `${file} must not reference a logo image`).not.toMatch(/icon-rentrix|icon-malik|logo\.(svg|png)/);
    }
  });

  it('stops referencing the legacy Rentrix icons from the shipped shell', () => {
    // The PNGs stay on disk (documented as deletable legacy assets) but nothing
    // in the manifest, HTML head, service worker precache, or UI may load them.
    const indexHtml = readApp('index.html');
    const manifest = readApp('public/manifest.json');
    const viteConfig = readApp('vite.config.ts');

    expect(indexHtml).not.toContain('icon-rentrix');
    expect(manifest).not.toContain('icon-rentrix');
    // The only allowed mention in the build config is the precache exclusion.
    expect(viteConfig).toMatch(/globIgnores:\s*\[[^\]]*icon-rentrix-\*\.png/);
    expect(viteConfig).not.toMatch(/includeAssets:\s*\[[^\]]*icon-rentrix/);

    const stillReferencing = sourceFiles
      .filter((file) => relativePath(file) !== SELF_PATH)
      .filter((file) => !DISPLAY_NAME_ALLOWLIST.has(relativePath(file)))
      .filter((file) => read(file).includes('icon-rentrix'));
    expect(stillReferencing.map(relativePath)).toEqual([]);
  });

  it('uses the geometric wordmark face without breaking Cairo for Arabic', () => {
    const indexHtml = readApp('index.html');

    expect(indexHtml).toMatch(/\.malik-wordmark\s*\{[^}]*Sora/);
    expect(indexHtml).toMatch(/body\s*\{[^}]*'Cairo'/);
    expect(indexHtml).toContain('family=Sora');
    expect(indexHtml).toContain('family=Cairo');
  });
});

describe('MALIK brand contract — PWA and document metadata', () => {
  it('brands the PWA manifest as MALIK with no icon entries', () => {
    const manifest = JSON.parse(readApp('public/manifest.json')) as {
      name: string;
      short_name: string;
      description: string;
      icons?: unknown[];
    };

    expect(manifest.short_name).toBe(APP_BRAND_NAME);
    expect(manifest.name).toContain(APP_BRAND_NAME);
    expect(manifest.name).toContain(APP_BRAND_TAGLINE_AR);
    expect(manifest.name).not.toContain('Rentrix');
    expect(manifest.description).not.toContain('Rentrix');
    expect(manifest.icons ?? []).toEqual([]);
  });

  it('brands the HTML head, Open Graph, Twitter, and structured data as MALIK', () => {
    const indexHtml = readApp('index.html');

    expect(indexHtml).toContain(`<title>${APP_BRAND_NAME} — ${APP_BRAND_TAGLINE_AR}</title>`);
    expect(indexHtml).toContain(`content="${APP_BRAND_NAME}"`);
    expect(indexHtml).toContain(`og:title" content="${APP_BRAND_NAME} | ${APP_BRAND_TAGLINE_AR}"`);
    expect(indexHtml).toContain(`twitter:title" content="${APP_BRAND_NAME} | ${APP_BRAND_TAGLINE_AR}"`);
    expect(indexHtml).toContain(`"name": "${APP_BRAND_NAME}"`);
    expect(indexHtml).toContain('apple-mobile-web-app-title" content="MALIK"');
    expect(indexHtml).not.toContain('Rentrix');
  });

  it('brands the offline shell as a MALIK wordmark', () => {
    const offline = readApp('public/offline.html');

    expect(offline).toContain(APP_BRAND_NAME);
    expect(offline).not.toContain('Rentrix');
    expect(offline).not.toMatch(/<svg/i);
    expect(offline).not.toMatch(/<img/i);
  });

  it('brands the install prompt as MALIK', () => {
    const installPrompt = readApp('src/components/layout/pwa-install-prompt.tsx');

    expect(installPrompt).toContain('APP_BRAND_NAME');
    expect(installPrompt).not.toContain('Rentrix');
  });
});
