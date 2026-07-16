import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { messages } from './messages';
import type { Lang, Messages } from './messages';

type LanguageContextValue = {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  isArabic: boolean;
  t: Messages;
  setLang: (lang: Lang) => void;
  toggle: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'rentrix-landing-lang';

function detectInitialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* storage unavailable — fall through */
  }
  return 'ar'; // Target market default: Arabic
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  // Landing pages control <html> dir/lang/title and scroll padding while mounted;
  // the app's own chrome values are restored on unmount.
  useEffect(() => {
    const root = document.documentElement;
    const original = {
      lang: root.lang,
      dir: root.dir,
      title: document.title,
      scrollBehavior: root.style.scrollBehavior,
      scrollPaddingTop: root.style.scrollPaddingTop,
    };
    root.style.scrollBehavior = 'smooth';
    root.style.scrollPaddingTop = '96px';
    return () => {
      root.lang = original.lang;
      root.dir = original.dir;
      document.title = original.title;
      root.style.scrollBehavior = original.scrollBehavior;
      root.style.scrollPaddingTop = original.scrollPaddingTop;
    };
  }, []);

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.title = messages[lang].meta.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', messages[lang].meta.description);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      isArabic: lang === 'ar',
      t: messages[lang],
      setLang: (next: Lang) => setLangState(next),
      toggle: () => setLangState((prev) => (prev === 'ar' ? 'en' : 'ar')),
    }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
