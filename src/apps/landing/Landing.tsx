import { Link } from 'react-router-dom';
import { ArrowRight, Columns3, LayoutDashboard, Nfc, Smartphone } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { LangToggle } from '@/ui/Misc';
import { Logo } from '@/components/Logo';

export function Landing() {
  const { t } = useI18n();
  const cards = [
    { to: '/parent', icon: <Smartphone className="size-6" />, title: t('nav.parent'), desc: t('landing.parentDesc'), color: 'bg-violet-50 text-violet-700' },
    { to: '/pos', icon: <Nfc className="size-6" />, title: t('nav.pos'), desc: t('landing.posDesc'), color: 'bg-amber-50 text-amber-700' },
    { to: '/school', icon: <LayoutDashboard className="size-6" />, title: t('nav.school'), desc: t('landing.schoolDesc'), color: 'bg-sky-50 text-sky-700' },
  ];
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-16">
      <div className="flex items-center justify-between">
        <Logo />
        <LangToggle />
      </div>
      <section className="mt-12 max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{t('landing.headline')}</h1>
        <p className="mt-4 text-lg text-slate-600">{t('landing.sub')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/demo" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-700 px-5 font-semibold text-white shadow-sm hover:bg-brand-800">
            <Columns3 className="size-5" /> {t('landing.split')}
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-600">{t('landing.splitHint')}</p>
      </section>
      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <span className={`flex size-12 items-center justify-center rounded-xl ${c.color}`}>{c.icon}</span>
            <h2 className="mt-4 flex items-center gap-1 text-lg font-semibold text-slate-900">
              {c.title} <ArrowRight className="size-4 opacity-0 transition group-hover:opacity-100 rtl:rotate-180" />
            </h2>
            <p className="mt-1 text-sm text-slate-600">{c.desc}</p>
            <p className="mt-3 font-mono text-xs text-slate-500">{c.to}</p>
          </Link>
        ))}
      </section>
      <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">{t('landing.howTitle')}</h2>
        <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-slate-700">
          <li>{t('demo.step1.title')}</li>
          <li>{t('demo.step2.title')}</li>
          <li>{t('demo.step3.title')}</li>
          <li>{t('demo.step4.title')}</li>
        </ol>
        <p className="mt-3 text-sm text-slate-600">{t('landing.howHint')}</p>
      </section>
    </main>
  );
}
