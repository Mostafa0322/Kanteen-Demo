import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Home, ListOrdered, LogOut, ShieldCheck, UtensilsCrossed, Wallet } from 'lucide-react';
import { api, type AppNotification } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { cx } from '@/lib/cx';
import { isEmbedded } from '@/lib/useEmbed';
import { ToastProvider, useToast } from '@/ui/Toast';
import { PortalTarget } from '@/ui/Modal';
import { Avatar, LangToggle } from '@/ui/Misc';
import { LoadingBlock } from '@/ui/States';
import { ParentSessionProvider, useParentSession } from './session';
import { PhoneFrame } from './PhoneFrame';
import { Login } from './Login';
import { ChildPicker } from './ChildPicker';
import { HomeScreen } from './HomeScreen';
import { TopUpScreen } from './TopUpScreen';
import { ControlsScreen } from './ControlsScreen';
import { ActivityScreen } from './ActivityScreen';
import { MenuScreen } from './MenuScreen';
import { notificationText } from './notifications';

export default function ParentApp() {
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  return (
    <PhoneFrame bare={isEmbedded()}>
      <div ref={setPortal} className="relative flex h-full flex-col overflow-hidden bg-slate-50">
        <PortalTarget.Provider value={portal}>
          <ToastProvider position="absolute">
            <ParentSessionProvider>
              <ParentRoutes />
            </ParentSessionProvider>
          </ToastProvider>
        </PortalTarget.Provider>
      </div>
    </PhoneFrame>
  );
}

function ParentRoutes() {
  const { parentId, childId } = useParentSession();
  if (!parentId) return <Login />;
  if (!childId) return <ChildPicker />;
  return <Shell parentId={parentId} childId={childId} />;
}

function Shell({ parentId, childId }: { parentId: string; childId: string }) {
  const i18n = useI18n();
  const { t, n } = i18n;
  const nav = useNavigate();
  const { logout, selectChild } = useParentSession();
  const children = useApi(() => api.getChildren(parentId), [parentId]);
  const notifications = useApi(() => api.listNotifications(parentId), [parentId]);
  const [menuOpen, setMenuOpen] = useState(false);
  const child = children.data?.find((c) => c.id === childId);
  useLiveNotificationToasts(notifications.data, children.data ?? []);

  // Session points at a child that no longer belongs to this parent (e.g. after a data reset).
  if (children.data && !child) return <ChildPicker />;

  const unread = notifications.data?.filter((x) => !x.read).length ?? 0;
  const tabs = [
    { to: '/parent', end: true, icon: Home, label: t('parent.nav.home') },
    { to: '/parent/topup', icon: Wallet, label: t('parent.nav.topup') },
    { to: '/parent/controls', icon: ShieldCheck, label: t('parent.nav.controls') },
    { to: '/parent/activity', icon: ListOrdered, label: t('parent.nav.activity') },
    { to: '/parent/menu', icon: UtensilsCrossed, label: t('parent.nav.menu') },
  ];

  return (
    <>
      <header className="z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 pt-2 pb-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-xl py-1 ps-1 pe-2 hover:bg-slate-100"
          >
            {child ? <Avatar name={child.name} color={child.avatarColor} size="sm" /> : <span className="size-8 animate-pulse rounded-full bg-slate-200" />}
            <span className="text-start">
              <span className="block text-xs text-slate-500">{t('parent.viewing')}</span>
              <span className="block max-w-36 truncate text-sm leading-tight font-semibold">{child ? n(child) : '…'}</span>
            </span>
            <ChevronDown className="size-4 text-slate-500" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute start-0 top-full z-30 mt-1 w-60 rounded-xl border border-slate-200 bg-white p-1 shadow-lg animate-fade">
              {children.data?.map((c) => (
                <button
                  key={c.id}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    selectChild(c.id);
                    setMenuOpen(false);
                  }}
                  className={cx('flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start hover:bg-slate-50', c.id === childId && 'bg-brand-50')}
                >
                  <Avatar name={c.name} color={c.avatarColor} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{n(c)}</span>
                    <span className="block text-xs text-slate-500">{i18n.money(c.balance)}</span>
                  </span>
                </button>
              ))}
              <div className="my-1 border-t border-slate-100" />
              <button role="menuitem" type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                <LogOut className="size-4 rtl:rotate-180" /> {t('parent.logout')}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <LangToggle compact className="!h-9 !px-2" />
          <button
            type="button"
            onClick={() => nav('/parent/activity?tab=alerts')}
            aria-label={t('parent.notifications', { count: unread })}
            className="relative inline-flex size-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100"
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute end-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-4 font-bold text-white">{unread > 9 ? '9+' : unread}</span>
            )}
          </button>
        </div>
      </header>

      <main className="relative flex-1 overflow-y-auto no-scrollbar" onClick={() => menuOpen && setMenuOpen(false)}>
        {!child ? (
          <div className="p-4">
            <LoadingBlock rows={4} />
          </div>
        ) : (
          <Routes>
            <Route index element={<HomeScreen studentId={childId} />} />
            <Route path="topup" element={<TopUpScreen studentId={childId} />} />
            <Route path="controls" element={<ControlsScreen studentId={childId} />} />
            <Route path="activity" element={<ActivityScreen studentId={childId} parentId={parentId} />} />
            <Route path="menu" element={<MenuScreen studentId={childId} />} />
            <Route path="*" element={<Navigate to="/parent" replace />} />
          </Routes>
        )}
      </main>

      <nav aria-label={t('parent.nav.label')} className="grid grid-cols-5 border-t border-slate-200 bg-white pb-[max(env(safe-area-inset-bottom),4px)]">
        {tabs.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800')}
          >
            {({ isActive }) => (
              <>
                <span className={cx('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-brand-100')}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

/** Pop a toast for each notification that arrives while the app is open. */
function useLiveNotificationToasts(list: AppNotification[] | undefined, kids: { id: string; name: string; nameAr: string }[]) {
  const seen = useRef<Set<string> | null>(null);
  const toast = useToast();
  const i18n = useI18n();
  useEffect(() => {
    if (!list) return;
    if (!seen.current) {
      seen.current = new Set(list.map((x) => x.id));
      return;
    }
    const fresh = list.filter((x) => !seen.current!.has(x.id));
    for (const x of fresh.reverse()) {
      seen.current.add(x.id);
      const child = kids.find((k) => k.id === x.studentId);
      const msg = notificationText(i18n, x, child ? i18n.n(child) : '');
      toast({ tone: msg.tone, title: msg.title, body: msg.body });
    }
  }, [list, kids, toast, i18n]);
}
