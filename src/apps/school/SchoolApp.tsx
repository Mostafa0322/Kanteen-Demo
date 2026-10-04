import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ArrowLeft, BarChart3, FileSpreadsheet, LayoutDashboard, Menu as MenuIcon, ReceiptText, RotateCcw, Settings, ShoppingBag, UtensilsCrossed, Users, X } from 'lucide-react';
import { api } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { cx } from '@/lib/cx';
import { LangToggle } from '@/ui/Misc';
import { Logo } from '@/components/Logo';
import { Overview } from './Overview';
import { Students } from './Students';
import { Transactions } from './Transactions';
import { ClosingReport } from './ClosingReport';
import { MenuManagement } from './MenuManagement';
import { Refunds } from './Refunds';
import { Reports } from './Reports';
import { SettingsPage } from './SettingsPage';
import { ShopAdmin } from './ShopAdmin';

const SCHOOL_KEY = 'kanteen.school.id';

export default function SchoolApp() {
  const { t, n } = useI18n();
  const schools = useApi(() => api.listSchools(), [], { live: false });
  const [schoolId, setSchoolId] = useState(() => localStorage.getItem(SCHOOL_KEY) ?? 'sch_nile');
  const [navOpen, setNavOpen] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => localStorage.setItem(SCHOOL_KEY, schoolId), [schoolId]);

  // Blink the "live" dot whenever data changes anywhere.
  useEffect(
    () =>
      api.subscribe((e) => {
        if (e.type !== 'db-changed') return;
        setPulse(true);
        setTimeout(() => setPulse(false), 900);
      }),
    [],
  );

  const links = [
    { to: '/school', end: true, icon: LayoutDashboard, label: t('school.nav.overview') },
    { to: '/school/students', icon: Users, label: t('school.nav.students') },
    { to: '/school/transactions', icon: ReceiptText, label: t('school.nav.transactions') },
    { to: '/school/closing', icon: FileSpreadsheet, label: t('school.nav.closing') },
    { to: '/school/menu', icon: UtensilsCrossed, label: t('school.nav.menu') },
    { to: '/school/shop', icon: ShoppingBag, label: t('school.nav.shop') },
    { to: '/school/refunds', icon: RotateCcw, label: t('school.nav.refunds') },
    { to: '/school/reports', icon: BarChart3, label: t('school.nav.reports') },
    { to: '/school/settings', icon: Settings, label: t('school.nav.settings') },
  ];

  const nav = (
    <nav aria-label={t('school.nav.label')} className="space-y-1 p-3">
      {links.map(({ to, end, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setNavOpen(false)}
          className={({ isActive }) =>
            cx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium', isActive ? 'bg-brand-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white')
          }
        >
          <Icon className="size-5" aria-hidden="true" /> {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-0 flex-1">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col bg-slate-900 lg:flex">
        <div className="flex h-16 items-center gap-2 px-5">
          <Link to="/" aria-label={t('common.back')} className="text-slate-400 hover:text-white">
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Link>
          <Logo inverted small />
        </div>
        {nav}
        <p className="mt-auto p-5 text-xs text-slate-500">{t('school.signedInAs')}</p>
      </aside>

      {/* Sidebar (mobile drawer) */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setNavOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-64 bg-slate-900 animate-fade">
            <div className="flex h-14 items-center justify-between px-4">
              <Logo inverted small />
              <button type="button" onClick={() => setNavOpen(false)} aria-label={t('common.close')} className="text-slate-300">
                <X className="size-5" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setNavOpen(true)} aria-label={t('school.openNav')}>
              <MenuIcon className="size-5" />
            </button>
            <label htmlFor="school" className="sr-only">
              {t('school.school')}
            </label>
            <select id="school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="h-10 min-w-0 truncate rounded-xl border-0 bg-slate-100 px-3 pe-8 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-brand-600">
              {schools.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {n(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs font-semibold text-emerald-700 sm:inline-flex" aria-live="off">
              <span className="relative flex size-2.5">
                <span className={cx('absolute inline-flex size-full rounded-full bg-emerald-400', pulse ? 'animate-ping' : 'opacity-0')} />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </span>
              {t('school.live')}
            </span>
            <LangToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Routes>
            <Route index element={<Overview schoolId={schoolId} />} />
            <Route path="students" element={<Students schoolId={schoolId} />} />
            <Route path="transactions" element={<Transactions schoolId={schoolId} />} />
            <Route path="closing" element={<ClosingReport schoolId={schoolId} />} />
            <Route path="menu" element={<MenuManagement />} />
            <Route path="shop" element={<ShopAdmin schoolId={schoolId} />} />
            <Route path="refunds" element={<Refunds schoolId={schoolId} />} />
            <Route path="reports" element={<Reports schoolId={schoolId} />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/school" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
