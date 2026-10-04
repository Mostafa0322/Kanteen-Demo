import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Gauge, Nfc, Plus, Snowflake, UtensilsCrossed } from 'lucide-react';
import { api } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { cx } from '@/lib/cx';
import { Card } from '@/ui/Card';
import { ProgressBar } from '@/ui/Misc';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from '@/ui/States';
import { useToast } from '@/ui/Toast';
import { TxRow } from '@/components/domain';

export function HomeScreen({ studentId }: { studentId: string }) {
  const { t, n, money, list } = useI18n();
  const toast = useToast();
  const student = useApi(() => api.getStudent(studentId), [studentId]);
  const recent = useApi(() => api.listTransactions({ studentId, limit: 6 }), [studentId]);
  const s = student.data;

  if (student.error) return <ErrorState className="m-4" error={student.error} onRetry={student.reload} />;

  const low = s && s.balance < s.lowBalanceThreshold;

  return (
    <div className="space-y-4 p-4">
      {/* Wallet card */}
      <section aria-label={t('home.wallet')} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 p-5 text-white shadow-lg">
        <div aria-hidden="true" className="absolute -end-10 -top-10 size-40 rounded-full bg-white/5" />
        <div aria-hidden="true" className="absolute -end-4 top-16 size-24 rounded-full bg-amber-400/10" />
        {!s ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32 bg-white/20" />
            <Skeleton className="h-10 w-48 bg-white/20" />
            <Skeleton className="h-4 w-40 bg-white/20" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-brand-100">{t('home.balanceOf', { name: n(s) })}</p>
              {s.frozen ? (
                <Badge tone="danger" icon={<Snowflake className="size-3" />}>
                  {t('home.frozen')}
                </Badge>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
                  <Nfc className="size-3" /> {t('home.active')}
                </span>
              )}
            </div>
            <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums" aria-live="polite">
              {money(s.balance)}
            </p>
            <p className="mt-1 text-xs text-brand-100">
              {n(s.school)} · <span className="ltr-nums font-mono">{s.braceletId ?? t('home.noBracelet')}</span>
            </p>
            <div className="mt-4 flex gap-2">
              <Link to="/parent/topup" className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white font-semibold text-brand-800 hover:bg-brand-50">
                <Plus className="size-4" /> {t('home.topUp')}
              </Link>
              <Button
                variant="ghost"
                className="!text-white ring-1 ring-white/30 hover:!bg-white/10"
                icon={<Snowflake className="size-4" />}
                onClick={async () => {
                  await api.updateControls(s.id, { frozen: !s.frozen });
                  toast({ tone: s.frozen ? 'success' : 'warning', title: t(s.frozen ? 'controls.unfrozenToast' : 'controls.frozenToast') });
                }}
              >
                {s.frozen ? t('home.unfreeze') : t('home.freeze')}
              </Button>
            </div>
          </>
        )}
      </section>

      {s?.frozen && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <Snowflake className="mt-0.5 size-5 shrink-0 text-red-600" />
          <p>{t('home.frozenNotice')}</p>
        </div>
      )}
      {low && !s?.frozen && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <p className="flex-1">{t('home.lowNotice', { threshold: money(s!.lowBalanceThreshold) })}</p>
          <Link to="/parent/topup" className="font-semibold underline">
            {t('home.topUp')}
          </Link>
        </div>
      )}

      {/* Today */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Gauge className="size-5 text-brand-700" /> {t('home.today')}
          </h2>
          <Link to="/parent/controls" className="text-sm font-semibold text-brand-700 hover:underline">
            {t('home.editLimit')}
          </Link>
        </div>
        {!s ? (
          <Skeleton className="mt-3 h-10" />
        ) : (
          <>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <p className="text-2xl font-bold tabular-nums">{money(s.spentToday)}</p>
              <p className="text-sm text-slate-600">{s.dailyLimit != null ? t('home.ofLimit', { limit: money(s.dailyLimit) }) : t('home.noLimit')}</p>
            </div>
            {s.dailyLimit != null ? (
              <>
                <ProgressBar className="mt-2" value={s.spentToday} max={s.dailyLimit} label={t('home.today')} />
                <p className={cx('mt-1.5 text-xs', s.spentToday >= s.dailyLimit ? 'font-semibold text-red-700' : 'text-slate-600')}>
                  {s.spentToday >= s.dailyLimit ? t('home.limitReached') : t('home.remaining', { amount: money(s.dailyLimit - s.spentToday) })}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-slate-600">{t('home.noLimitHint')}</p>
            )}
          </>
        )}
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/parent/controls" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-300">
          <span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <AlertTriangle className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">{t('home.allergies')}</span>
            <span className="block text-xs text-slate-600">{s ? (s.allergies.length ? list(s.allergies.map((a) => t(`allergen.${a}`))) : t('home.none')) : '…'}</span>
          </span>
        </Link>
        <Link to="/parent/menu" className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:border-brand-300">
          <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <UtensilsCrossed className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">{t('home.menu')}</span>
            <span className="block text-xs text-slate-600">{t('home.menuHint')}</span>
          </span>
        </Link>
      </div>

      {/* Recent */}
      <Card className="p-2">
        <div className="flex items-center justify-between px-2 pt-2 pb-1">
          <h2 className="font-semibold text-slate-900">{t('home.recent')}</h2>
          <Link to="/parent/activity" className="inline-flex items-center gap-0.5 text-sm font-semibold text-brand-700 hover:underline">
            {t('common.seeAll')} <ChevronRight className="size-4 rtl:rotate-180" />
          </Link>
        </div>
        {recent.loading ? (
          <LoadingBlock rows={3} className="p-2" />
        ) : recent.error ? (
          <ErrorState error={recent.error} onRetry={recent.reload} />
        ) : recent.data!.length === 0 ? (
          <EmptyState className="m-2" title={t('home.noTx')} description={t('home.noTxHint')} />
        ) : (
          <div className="divide-y divide-slate-100">
            {recent.data!.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
