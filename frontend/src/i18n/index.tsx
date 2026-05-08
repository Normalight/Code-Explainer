import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import zhCN, { type TranslationKey } from './zh-CN';
import enUS from './en-US';

type Locale = 'zh-CN' | 'en-US';

const translations: Record<Locale, Record<TranslationKey, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

interface I18nContextValue {
  locale: Locale;
  t: (key: TranslationKey) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh-CN',
  t: (key) => zhCN[key],
  setLocale: () => {},
});

const STORAGE_KEY = 'code-explainer-locale';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en-US' || saved === 'zh-CN') return saved;
    return navigator.language.startsWith('zh') ? 'zh-CN' : 'en-US';
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback((key: TranslationKey) => translations[locale][key] ?? key, [locale]);

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export type { TranslationKey, Locale };
