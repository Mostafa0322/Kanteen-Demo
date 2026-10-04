import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type LocalizedName } from '@/mock-api';
import { useApi } from '@/lib/useApi';
import { en, type MessageKey } from './en';
import { ar } from './ar';

export type Lang = 'en' | 'ar';
type Params = Record<string, string | number | undefined | null>;

const dictionaries: Record<Lang, Record<MessageKey, string>> = { en, ar };
const LANG_KEY = 'kanteen.lang';

export interface I18n {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: MessageKey, params?: Params) => string;
  /** Pick the localized name of an entity. */
  n: (obj: LocalizedName | null | undefined) => string;
  currency: string;
  money: (amount: number, opts?: { signed?: boolean; compact?: boolean }) => string;
  num: (n: number, opts?: Intl.NumberFormatOptions) => string;
  date: (iso: string | Date, opts?: Intl.DateTimeFormatOptions) => string;
  time: (iso: string | Date) => string;
  dateTime: (iso: string | Date) => string;
  relative: (iso: string | Date) => string;
  list: (items: string[]) => string;
}

const I18nContext = createContext<I18n | null>(null);

function initialLang(): Lang {
  try {
    const url = new URLSearchParams(window.location.search).get('lang');
    if (url === 'ar' || url === 'en') return url;
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const settings = useApi(() => api.getSettings(), []);
  const currency = settings.data?.currency ?? 'EGP';

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  // Follow language changes made in other tabs/iframes.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_KEY && (e.newValue === 'ar' || e.newValue === 'en')) setLangState(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang]);

  const value = useMemo<I18n>(() => {
    const locale = lang === 'ar' ? 'ar-EG' : 'en-GB';
    const dict = dictionaries[lang];
    const t = (key: MessageKey, params?: Params) => {
      let s = dict[key] ?? en[key] ?? key;
      if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, v == null ? '' : String(v));
      return s;
    };
    const nf = new Intl.NumberFormat(locale);
    let mf: Intl.NumberFormat;
    try {
      mf = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 0 });
    } catch {
      mf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    }
    const compactF = new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
    const toDate = (d: string | Date) => (typeof d === 'string' ? new Date(d) : d);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    return {
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      isRTL: lang === 'ar',
      setLang,
      toggleLang: () => setLang(lang === 'ar' ? 'en' : 'ar'),
      t,
      n: (obj) => (obj ? (lang === 'ar' ? obj.nameAr || obj.name : obj.name) : '—'),
      currency,
      money: (amount, opts) => {
        const s = (opts?.compact ? compactF : mf).format(Math.abs(amount));
        if (opts?.signed) return (amount < 0 ? '−' : '+') + s;
        return amount < 0 ? '−' + s : s;
      },
      num: (n, opts) => (opts ? new Intl.NumberFormat(locale, opts).format(n) : nf.format(n)),
      date: (d, opts) => toDate(d).toLocaleDateString(locale, opts ?? { day: 'numeric', month: 'short', year: 'numeric' }),
      time: (d) => toDate(d).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }),
      dateTime: (d) => toDate(d).toLocaleString(locale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
      list: (items) => new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' }).format(items),
      relative: (d) => {
        const diff = (toDate(d).getTime() - Date.now()) / 1000;
        const abs = Math.abs(diff);
        if (abs < 45) return t('time.justNow');
        if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
        if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
        if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
        return toDate(d).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
      },
    };
  }, [lang, currency, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
