import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { DemoPanel } from '@/components/DemoPanel';
import { LangToggle } from '@/ui/Misc';
import { Logo } from '@/components/Logo';

/**
 * All three apps side by side in same-origin iframes. They share localStorage
 * and BroadcastChannel, so every action propagates live between them.
 */
export default function SplitView() {
  const { t } = useI18n();
  const q = '?embed=1';
  const frames = [
    { src: `/parent${q}`, title: t('nav.parent'), className: 'w-[380px] shrink-0' },
    { src: `/pos${q}`, title: t('nav.pos'), className: 'min-w-[440px] flex-1' },
    { src: `/school${q}`, title: t('nav.school'), className: 'min-w-[560px] flex-[1.3]' },
  ];
  return (
    <div className="flex h-[calc(100dvh-32px)] flex-col bg-slate-200">
      <header className="flex items-center justify-between gap-3 border-b border-slate-300 bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <Link to="/" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" aria-label={t('common.back')}>
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Link>
          <Logo small />
          <span className="hidden text-sm text-slate-600 md:inline">{t('split.subtitle')}</span>
        </div>
        <LangToggle />
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto p-2">
          {frames.map((f) => (
            <section key={f.src} className={`flex flex-col overflow-hidden rounded-xl bg-white shadow ring-1 ring-slate-300 ${f.className}`}>
              <h2 className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-600 uppercase">{f.title}</h2>
              {/* Language follows via the storage event, so frames never need to reload. */}
              <iframe key={f.src} src={f.src} title={f.title} className="min-h-0 w-full flex-1 border-0" />
            </section>
          ))}
        </div>
        <div className="hidden w-[360px] shrink-0 border-s border-slate-300 min-[1780px]:block">
          <DemoPanel defaultOpen docked />
        </div>
      </div>
      <div className="min-[1780px]:hidden">
        <DemoPanel />
      </div>
    </div>
  );
}
