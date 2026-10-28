import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dict, type DictKey } from './dict';
import { recallPreference, rememberPreference } from '../lib/cookies';

export type Lang = 'mk' | 'en';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: DictKey) => string;
  /**
   * The label for a value that comes from data — a status, a tag, a type:
   * tv('news.tag', item.tag). A value with no entry shows as itself rather
   * than as a raw dictionary key.
   */
  tv: (prefix: string, value: string | null | undefined) => string;
  /** Picks the *_mk / *_en variant off an API row. */
  f: (row: object | null | undefined, base: string) => string;
  /** Picks one side of a single "Македонски / English" string. */
  s: (value: string | null | undefined) => string;
  formatDate: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string;
};

/*
 * Not every browser ships Macedonian locale data: some embedded and headless
 * Chromium builds carry a reduced ICU, and Intl then falls back to English
 * month names inside a Macedonian page. When that happens dates keep the
 * en-GB layout with Macedonian month and weekday names swapped in, and numbers
 * borrow German formatting, which uses the same separators as Macedonian.
 */
const HAS_MK = Intl.DateTimeFormat.supportedLocalesOf(['mk']).length > 0;
const MK_MONTHS = ['јануари', 'февруари', 'март', 'април', 'мај', 'јуни', 'јули', 'август', 'септември', 'октомври', 'ноември', 'декември'];
const MK_MONTHS_SHORT = ['јан.', 'фев.', 'мар.', 'апр.', 'мај', 'јун.', 'јул.', 'авг.', 'сеп.', 'окт.', 'ное.', 'дек.'];
const MK_WEEKDAYS = ['недела', 'понеделник', 'вторник', 'среда', 'четврток', 'петок', 'сабота'];

function formatMkWithoutLocaleData(d: Date, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-GB', opts).formatToParts(d).map(part =>
    part.type === 'month' && opts.month === 'long' ? MK_MONTHS[d.getMonth()]
      : part.type === 'month' && opts.month === 'short' ? MK_MONTHS_SHORT[d.getMonth()]
      : part.type === 'weekday' ? MK_WEEKDAYS[d.getDay()]
      : part.value
  ).join('');
}

const LangContext = createContext<Ctx | null>(null);
const STORAGE_KEY = 'genomika_lang';

function initialLang(): Lang {
  if (typeof window === 'undefined') return 'mk';
  const stored = recallPreference(STORAGE_KEY);
  if (stored === 'mk' || stored === 'en') return stored;
  return navigator.language?.toLowerCase().startsWith('mk') ? 'mk' : 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    rememberPreference(STORAGE_KEY, lang);
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
      tv: (prefix, value) => {
        const entry = (dict as Record<string, readonly [string, string]>)[`${prefix}.${value}`];
        return entry ? entry[idx] : String(value ?? '');
      },
      f: (row, base) => {
        if (!row) return '';
        const fields = row as Record<string, unknown>;
        return String(fields[`${base}_${lang}`] ?? fields[`${base}_en`] ?? '');
      },
      s: (value) => {
        if (!value) return '';
        const parts = value.split(' / ');
        return parts.length === 2 ? parts[idx].trim() : value;
      },
      formatDate: (iso, opts) => {
        const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
        if (Number.isNaN(d.getTime())) return iso;
        const options = opts ?? { day: 'numeric', month: 'long', year: 'numeric' };
        return lang === 'mk' && !HAS_MK
          ? formatMkWithoutLocaleData(d, options)
          : new Intl.DateTimeFormat(locale, options).format(d);
      },
      formatNumber: (n, opts) =>
        new Intl.NumberFormat(lang === 'mk' && !HAS_MK ? 'de-DE' : locale, opts).format(n)
    };
  }, [lang, setLang, toggle]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>');
  return ctx;
}
