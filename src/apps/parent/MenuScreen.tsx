import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ban, Search, ShieldCheck } from 'lucide-react';
import { CATEGORIES, api, type Category, type MenuItemView } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { cx } from '@/lib/cx';
import { Input } from '@/ui/Form';
import { EmptyState, ErrorState, LoadingBlock } from '@/ui/States';
import { useToast } from '@/ui/Toast';
import { AllergenBadge, CATEGORY_EMOJI } from '@/components/domain';

export function MenuScreen({ studentId }: { studentId: string }) {
  const i18n = useI18n();
  const { t, n, money } = i18n;
  const toast = useToast();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | 'all' | 'blocked'>(params.get('filter') === 'blocked' ? 'blocked' : 'all');
  const [busy, setBusy] = useState<string | null>(null);
  const menu = useApi(() => api.getMenuForStudent(studentId), [studentId]);
  const student = useApi(() => api.getStudent(studentId), [studentId]);

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (menu.data ?? []).filter((m) => {
      if (cat === 'blocked' && !m.blocked) return false;
      if (cat !== 'all' && cat !== 'blocked' && m.category !== cat) return false;
      return !query || m.name.toLowerCase().includes(query) || m.nameAr.includes(query);
    });
  }, [menu.data, q, cat]);

  const blockedCount = menu.data?.filter((m) => m.blocked).length ?? 0;

  const toggleItem = async (m: MenuItemView) => {
    const s = student.data;
    if (!s) return;
    setBusy(m.id);
    const isBlocked = s.blockedItemIds.includes(m.id);
    try {
      await api.updateControls(studentId, { blockedItemIds: isBlocked ? s.blockedItemIds.filter((x) => x !== m.id) : [...s.blockedItemIds, m.id] });
      toast({ tone: isBlocked ? 'success' : 'warning', title: t(isBlocked ? 'menu.unblocked' : 'menu.blockedToast', { item: n(m) }) });
    } finally {
      setBusy(null);
    }
  };

  const reasonLabel = (r: MenuItemView['blockReasons'][number]) =>
    r.reason === 'blocked_allergy'
      ? t('menu.reason.allergy', { allergen: t(`allergen.${r.allergen!}`) })
      : r.reason === 'blocked_category'
        ? t('menu.reason.category', { category: t(`category.${r.category!}`) })
        : t('menu.reason.item');

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">{t('menu.title')}</h1>
      <p className="text-sm text-slate-600">{student.data ? t('menu.subtitle', { name: n(student.data), count: blockedCount }) : '…'}</p>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input className="ps-9" type="search" placeholder={t('menu.search')} aria-label={t('menu.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {(['all', 'blocked', ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
            className={cx(
              'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ring-1 ring-inset',
              cat === c ? (c === 'blocked' ? 'bg-red-600 text-white ring-red-600' : 'bg-slate-900 text-white ring-slate-900') : 'bg-white text-slate-700 ring-slate-300',
            )}
          >
            {c === 'all' ? t('menu.all') : c === 'blocked' ? `${t('menu.blocked')} (${blockedCount})` : `${CATEGORY_EMOJI[c]} ${t(`category.${c}`)}`}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {menu.loading ? (
          <LoadingBlock rows={6} />
        ) : menu.error ? (
          <ErrorState error={menu.error} onRetry={menu.reload} />
        ) : items.length === 0 ? (
          <EmptyState title={t('menu.empty')} description={cat === 'blocked' ? t('menu.emptyBlocked') : undefined} />
        ) : (
          items.map((m) => {
            const parentBlocked = student.data?.blockedItemIds.includes(m.id) ?? false;
            return (
              <article key={m.id} className={cx('rounded-2xl border bg-white p-3 shadow-sm', m.blocked ? 'border-red-200' : 'border-slate-200', !m.available && 'opacity-70')}>
                <div className="flex gap-3">
                  <span className={cx('flex size-14 shrink-0 items-center justify-center rounded-xl text-3xl', m.blocked ? 'bg-red-50 grayscale-[40%]' : 'bg-slate-50')} aria-hidden="true">
                    {m.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold text-slate-900">{n(m)}</h2>
                      <span className="shrink-0 font-semibold tabular-nums">{money(m.price)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.allergens.length === 0 ? (
                        <span className="text-xs text-slate-500">{t('menu.noAllergens')}</span>
                      ) : (
                        m.allergens.map((a) => <AllergenBadge key={a} allergen={a} active={m.blockReasons.some((r) => r.allergen === a)} />)
                      )}
                      {!m.available && <span className="text-xs font-semibold text-slate-600">· {t('menu.unavailable')}</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                  {m.blocked ? (
                    <p className="flex items-start gap-1.5 text-sm font-semibold text-red-700">
                      <Ban className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      {t('menu.blockedFor')} {m.blockReasons.map(reasonLabel).join(' · ')}
                    </p>
                  ) : (
                    <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                      <ShieldCheck className="size-4" aria-hidden="true" /> {t('menu.allowed')}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => toggleItem(m)}
                    className={cx('shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset disabled:opacity-50', parentBlocked ? 'text-slate-700 ring-slate-300 hover:bg-slate-50' : 'text-red-700 ring-red-200 hover:bg-red-50')}
                  >
                    {parentBlocked ? t('menu.unblock') : t('menu.block')}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
