import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { cx } from '@/lib/cx';
import { useI18n } from '@/i18n/I18nProvider';
import { ApiError } from '@/mock-api';

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className ?? 'size-5')} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-slate-200/80', className)} aria-hidden="true" />;
}

export function LoadingBlock({ rows = 3, className }: { rows?: number; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={cx('space-y-3', className)} role="status" aria-label={t('common.loading')}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center', className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">{icon ?? <Inbox className="size-6" />}</div>
      <p className="font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <div role="alert" className={cx('flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center', className)}>
      <AlertTriangle className="mb-2 size-7 text-red-600" aria-hidden="true" />
      <p className="font-semibold text-red-900">{t('common.errorTitle')}</p>
      <p className="mt-1 text-sm text-red-800">{errorMessage(error, t)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-red-800 ring-1 ring-red-300 hover:bg-red-100">
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function errorMessage(error: unknown, t: ReturnType<typeof useI18n>['t']): string {
  if (error instanceof ApiError) {
    const key = `error.${error.code}` as Parameters<typeof t>[0];
    const msg = t(key);
    return msg === key ? error.message : msg;
  }
  if (error instanceof Error) return error.message;
  return t('common.errorGeneric');
}
