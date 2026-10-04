import type { ReactNode } from 'react';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * On wide screens the parent app is shown inside a phone mock-up; on phones
 * (and inside the split-screen iframe) it fills the viewport.
 */
export function PhoneFrame({ children, bare }: { children: ReactNode; bare?: boolean }) {
  const { t } = useI18n();
  if (bare) return <div className="h-dvh">{children}</div>;
  return (
    <div className="flex flex-1 items-start justify-center bg-gradient-to-br from-slate-100 via-brand-50 to-violet-50 sm:py-8">
      <div className="hidden w-64 shrink-0 pe-10 pt-24 lg:block">
        <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">{t('nav.parent')}</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{t('parent.frame.title')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t('parent.frame.desc')}</p>
      </div>
      <div className="relative h-[calc(100dvh-32px)] w-full sm:h-[844px] sm:max-h-[calc(100dvh-96px)] sm:w-[400px] sm:rounded-[3rem] sm:bg-slate-900 sm:p-3 sm:shadow-2xl">
        <div aria-hidden="true" className="absolute top-3 left-1/2 z-20 hidden h-7 w-32 -translate-x-1/2 rounded-b-2xl bg-slate-900 sm:block" />
        <div className="h-full overflow-hidden sm:rounded-[2.4rem] sm:pt-6 sm:bg-white">{children}</div>
      </div>
    </div>
  );
}
