import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANGUAGE,
  getLanguageDirection,
  getLanguageLocale,
  isSupportedLanguage,
  normalizeLanguage,
  supportedLanguages,
} from './companySettings';
import { applyDocumentLanguageDirection, getAppLanguageState, i18nResources, translateSharedLabel, type DocumentLanguageTarget } from './i18n';

const ARABIC_LANGUAGE = 'ar';
const ENGLISH_LANGUAGE = 'en';
const UNSUPPORTED_LANGUAGE = 'fr';
const UNKNOWN_LANGUAGE = 'unsupported';
const RTL_DIRECTION = 'rtl';
const LTR_DIRECTION = 'ltr';
const HOME_KEY = 'home';
const UNKNOWN_TRANSLATION_KEY = 'missing.key';
const ARABIC_HOME_LABEL = 'الرئيسية';
const ENGLISH_HOME_LABEL = 'Home';
const sharedCoreLabelCases = [
  { key: 'retry', arabicLabel: 'إعادة المحاولة', englishLabel: 'Retry' },
  { key: 'dashboard', arabicLabel: 'لوحة التحكم', englishLabel: 'Dashboard' },
  { key: 'routeLoadingAria', arabicLabel: 'جار التحميل', englishLabel: 'Loading' },
] as const;

const ARABIC_LANGUAGE_STATE = { language: ARABIC_LANGUAGE, locale: ARABIC_LANGUAGE, direction: RTL_DIRECTION };
const ENGLISH_LANGUAGE_STATE = { language: ENGLISH_LANGUAGE, locale: ENGLISH_LANGUAGE, direction: LTR_DIRECTION };

describe('lightweight i18n and direction foundation', () => {
  it('keeps Arabic as the default language', () => {
    expect(DEFAULT_LANGUAGE).toBe(ARABIC_LANGUAGE);
    expect(getAppLanguageState()).toEqual(ARABIC_LANGUAGE_STATE);
  });

  it('supports only Arabic and English', () => {
    expect(supportedLanguages).toEqual([ARABIC_LANGUAGE, ENGLISH_LANGUAGE]);
    expect(isSupportedLanguage(ARABIC_LANGUAGE)).toBe(true);
    expect(isSupportedLanguage(ENGLISH_LANGUAGE)).toBe(true);
    expect(isSupportedLanguage(UNSUPPORTED_LANGUAGE)).toBe(false);
  });

  it('falls unsupported languages back to Arabic', () => {
    expect(normalizeLanguage(UNSUPPORTED_LANGUAGE)).toBe(ARABIC_LANGUAGE);
    expect(normalizeLanguage(undefined)).toBe(ARABIC_LANGUAGE);
    expect(getAppLanguageState(UNSUPPORTED_LANGUAGE)).toEqual(ARABIC_LANGUAGE_STATE);
  });

  it('maps languages to text direction', () => {
    expect(getLanguageDirection(ARABIC_LANGUAGE)).toBe(RTL_DIRECTION);
    expect(getLanguageDirection(ENGLISH_LANGUAGE)).toBe(LTR_DIRECTION);
    expect(getLanguageDirection(UNKNOWN_LANGUAGE)).toBe(RTL_DIRECTION);
  });

  it('maps languages to locale identifiers', () => {
    expect(getLanguageLocale(ARABIC_LANGUAGE)).toBe(ARABIC_LANGUAGE);
    expect(getLanguageLocale(ENGLISH_LANGUAGE)).toBe(ENGLISH_LANGUAGE);
    expect(getLanguageLocale(UNKNOWN_LANGUAGE)).toBe(ARABIC_LANGUAGE);
  });

  it('looks up shared translations with Arabic fallback', () => {
    expect(i18nResources[ARABIC_LANGUAGE].common[HOME_KEY]).toBe(ARABIC_HOME_LABEL);
    expect(translateSharedLabel(HOME_KEY, ENGLISH_LANGUAGE)).toBe(ENGLISH_HOME_LABEL);
    expect(translateSharedLabel(HOME_KEY, UNKNOWN_LANGUAGE)).toBe(ARABIC_HOME_LABEL);
    expect(translateSharedLabel(UNKNOWN_TRANSLATION_KEY, ENGLISH_LANGUAGE)).toBe(UNKNOWN_TRANSLATION_KEY);
  });

  it('provides shared core labels in Arabic and English', () => {
    for (const { key, arabicLabel, englishLabel } of sharedCoreLabelCases) {
      expect(translateSharedLabel(key)).toBe(arabicLabel);
      expect(translateSharedLabel(key, ENGLISH_LANGUAGE)).toBe(englishLabel);
    }
  });

  it('can apply the default language and direction to a document root', () => {
    const documentElement = { lang: '', dir: '' };
    const testDocument = { documentElement } satisfies DocumentLanguageTarget;

    expect(applyDocumentLanguageDirection(undefined, testDocument)).toEqual(ARABIC_LANGUAGE_STATE);
    expect(documentElement.lang).toBe(ARABIC_LANGUAGE);
    expect(documentElement.dir).toBe(RTL_DIRECTION);

    expect(applyDocumentLanguageDirection(ENGLISH_LANGUAGE, testDocument)).toEqual(ENGLISH_LANGUAGE_STATE);
    expect(documentElement.lang).toBe(ENGLISH_LANGUAGE);
    expect(documentElement.dir).toBe(LTR_DIRECTION);
  });
});

// Contract test introduced with ADR-0008. Locks the bilingual descriptions and
// titles added for the /financials and /reports UX clarity work. If a future
// change drops or renames any of these keys, the page header on one of the two
// routes will silently fall back to the raw key string — this test fails first
// so the regression is caught at CI time, not in production.
describe('ADR-0008 — /financials and /reports UX-clarity i18n keys', () => {
  const uxClarityKeys = [
    'financialsSectionSummary',
    'financialsSectionReports',
    'financialsPageDescription',
    'reportsPageDescription',
    'financialsPageHint',
    'reportsPageHint',
  ] as const;

  it.each(uxClarityKeys)('"%s" has a non-empty Arabic translation', (key) => {
    const value = i18nResources.ar.common[key];
    expect(value).toBeDefined();
    expect(value?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it.each(uxClarityKeys)('"%s" has a non-empty English translation', (key) => {
    const value = i18nResources.en.common[key];
    expect(value).toBeDefined();
    expect(value?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it('"financialsSectionSummary" and "financialsSectionReports" are intentionally different', () => {
    // These two keys are the contrast pair. If they ever collapse to the same
    // string, the sidebar will read "X ... X" instead of "Quick ... Detailed".
    expect(translateSharedLabel('financialsSectionSummary')).not.toBe(
      translateSharedLabel('financialsSectionReports'),
    );
  });

  it('"financialsPageDescription" and "reportsPageDescription" describe different jobs', () => {
    const financialsDescription = translateSharedLabel('financialsPageDescription');
    const reportsDescription = translateSharedLabel('reportsPageDescription');
    expect(financialsDescription).not.toBe(reportsDescription);
    expect(financialsDescription.length).toBeGreaterThan(20);
    expect(reportsDescription.length).toBeGreaterThan(20);
  });
});

// Dead-key detector introduced with ADR-0008. Lists every shared translation
// key, then for each one looks across src/ for at least one consumer (a
// `translateSharedLabel('<key>'` call, or a `'<key>'` literal in a known
// consumer file). A key with no consumer is either dead code or a typo, and
// this test reports it. Keep this allow-list minimal: every entry is a
// deliberate decision, not a workaround.
//
// Scope: this detector targets the six UX-clarity keys added by ADR-0008.
// Broader key-by-key auditing is intentionally out of scope here; the
// pre-existing labels in i18n.ts (some of which are still referenced via
// indirect lookups or constants) are not flagged. A wider audit would
// belong in its own PR.
describe('ADR-0008 — UX-clarity keys have at least one code consumer', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { readFileSync, readdirSync } = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { join, relative, resolve } = require('node:path') as typeof import('node:path');

  const sourceRoot = resolve(__dirname, '..');
  const knownConsumerFiles: string[] = [];
  const collect = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        collect(fullPath);
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry.name)) knownConsumerFiles.push(fullPath);
    }
  };
  collect(sourceRoot);

  const uxClarityKeys = [
    'financialsSectionSummary',
    'financialsSectionReports',
    'financialsPageDescription',
    'reportsPageDescription',
  ] as const;

  // The two hint keys are introduced before the banner that consumes them
  // (the banner lands in the next commit on this branch). They are
  // excluded from the consumer check until the banner lands, then
  // re-included.
  const parkedHintKeys = ['financialsPageHint', 'reportsPageHint'] as const;

  it.each(uxClarityKeys)('"%s" is referenced from at least one non-i18n source file', (key) => {
    const consumers: string[] = [];
    for (const file of knownConsumerFiles) {
      const displayPath = relative(sourceRoot, file);
      if (displayPath.endsWith('i18n.ts') || displayPath.endsWith('i18n.test.ts')) continue;
      const content = readFileSync(file, 'utf8');
      if (content.includes(`'${key}'`) || content.includes(`"${key}"`)) {
        consumers.push(displayPath);
      }
    }
    expect(consumers).not.toEqual([]);
  });
});
