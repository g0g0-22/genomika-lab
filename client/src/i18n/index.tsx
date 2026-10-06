import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dict, type DictKey } from './dict';

export type Lang = 'mk' | 'en';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: DictKey) => string;
  /** Picks the *_mk / *_en variant off an API row. */
  f: <T extends Record<string, any>>(row: T | null | undefined, base: string) => string;
  /** Picks one side of a single "Македонски / English" string. */
  s: (value: string | null | undefined) => string;
  formatDate: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string;
};

const LangContext = createContext<Ctx | null>(null);
const STORAGE_KEY = 'genomika.lang';

function initialLang(): Lang {
  if (typeof window === 'undefined') return 'mk';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'mk' || stored === 'en') return stored;
  return navigator.language?.toLowerCase().startsWith('mk') ? 'mk' : 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch { /* private mode */ }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(() => setLangState(l => (l === 'mk' ? 'en' : 'mk')), []);

  const value = useMemo<Ctx>(() => {
    const idx = lang === 'mk' ? 0 : 1;
    const locale = lang === 'mk' ? 'mk-MK' : 'en-GB';
    return {
      lang,
      setLang,
      toggle,
      t: (key) => (dict[key]?.[idx] ?? key) as string,
      f: (row, base) => (row ? (row[`${base}_${lang}`] ?? row[`${base}_en`] ?? '') : ''),
      s: (value) => {
        if (!value) return '';
        const parts = value.split(' / ');
        return parts.length === 2 ? parts[idx].trim() : value;
      },
      formatDate: (iso, opts) => {
        const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
        if (Number.isNaN(d.getTime())) return iso;
        return new Intl.DateTimeFormat(locale, opts ?? { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
      },
      formatNumber: (n, opts) => new Intl.NumberFormat(locale, opts).format(n)
    };
  }, [lang, setLang, toggle]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>');
  return ctx;
}
