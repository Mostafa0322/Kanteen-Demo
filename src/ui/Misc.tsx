import type { ReactNode } from 'react';
import { Languages, TrendingDown, TrendingUp } from 'lucide-react';
import { cx } from '@/lib/cx';
import { useI18n } from '@/i18n/I18nProvider';

/** `meter` turns amber/red as it fills (for limits); `plain` stays brand-coloured (for shares). */
export function ProgressBar({ value, max, label, className, variant = 'meter' }: { value: number; max: number; label?: string; className?: string; variant?: 'meter' | 'plain' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const tone = variant === 'plain' ? 'bg-brand-600' : pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-500';
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cx('h-2.5 w-full overflow-hidden rounded-full bg-slate-200', className)}
    >
      <div className={cx('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, icon, hint, trend, tone = 'neutral', highlight }: { label: string; value: ReactNode; icon?: ReactNode; hint?: ReactNode; trend?: number | null; tone?: 'neutral' | 'brand' | 'danger' | 'warning'; highlight?: boolean }) {
  const { num } = useI18n();
  const iconTone = { neutral: 'bg-slate-100 text-slate-700', brand: 'bg-brand-50 text-brand-700', danger: 'bg-red-50 text-red-700', warning: 'bg-amber-50 text-amber-700' }[tone];
  return (
    <div className={cx('rounded-[var(--radius-card)] border border-slate-200 bg-white p-4 shadow-sm', highlight && 'animate-flash')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {icon && <span className={cx('flex size-8 items-center justify-center rounded-lg', iconTone)}>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
        {trend != null && (
          <span className={cx('inline-flex items-center gap-0.5 font-semibold', trend >= 0 ? 'text-emerald-700' : 'text-red-700')}>
            {trend >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            <span className="ltr-nums">{num(Math.abs(trend), { style: 'percent', maximumFractionDigits: 0 })}</span>
          </span>
        )}
        {hint}
      </div>
    </div>
  );
}

export function Avatar({ name, color, size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
  return (
    <span
      aria-hidden="true"
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white', size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-14 text-lg' : 'size-10 text-sm')}
      style={{ backgroundColor: color ?? '#0e665a' }}
    >
      {initials}
    </span>
  );
}

export function LangToggle({ className, compact }: { className?: string; compact?: boolean }) {
  const { lang, toggleLang, t } = useI18n();
  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={t('common.switchLanguage')}
      className={cx('inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50', className)}
    >
      <Languages className="size-4" aria-hidden="true" />
      {compact ? (lang === 'ar' ? 'EN' : 'ع') : lang === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}

export function DemoBanner() {
  const { t } = useI18n();
  return (
    <div role="note" className="relative z-40 flex items-center justify-center gap-2 bg-amber-400 px-3 py-1.5 text-center text-xs font-bold tracking-wide text-amber-950 sm:text-sm">
      <span aria-hidden="true">⚠</span>
      <span className="hidden sm:inline">{t('common.demoBanner')}</span>
      <span className="sm:hidden">{t('common.demoBannerShort')}</span>
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
