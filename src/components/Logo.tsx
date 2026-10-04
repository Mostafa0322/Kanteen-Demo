import { cx } from '@/lib/cx';

export function Logo({ className, inverted, small }: { className?: string; inverted?: boolean; small?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-bold tracking-tight', small ? 'text-base' : 'text-xl', inverted ? 'text-white' : 'text-slate-900', className)}>
      <svg viewBox="0 0 32 32" className={small ? 'size-7' : 'size-8'} aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={inverted ? '#ffffff' : '#0e665a'} />
        <circle cx="16" cy="16" r="8" fill="none" stroke={inverted ? '#0e665a' : '#ffffff'} strokeWidth="3" />
        <circle cx="16" cy="16" r="2.5" fill="#fbbf24" />
      </svg>
      Kanteen
    </span>
  );
}
