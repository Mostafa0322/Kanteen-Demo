import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Ban, Banknote, ShieldX, Users, Wallet } from 'lucide-react';
import { api, dayKey } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { PageTitle, Stat } from '@/ui/Misc';
import { EmptyState, ErrorState, LoadingBlock, Skeleton } from '@/ui/States';
import { TxRow } from '@/components/domain';
import { CHART, ChartFrame, ChartTooltip, axisProps } from './charts';

/** Returns true for ~1.6s after `value` changes (not on first render). */
function useChanged(value: unknown): boolean {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== undefined && prev.current !== value) {
      setFlash(true);
      const h = setTimeout(() => setFlash(false), 1600);
      prev.current = value;
      return () => clearTimeout(h);
    }
    prev.current = value;
  }, [value]);
  return flash;
}

export function Overview({ schoolId }: { schoolId: string }) {
  const i18n = useI18n();
  const { t, n, money, num } = i18n;
  const today = dayKey();
  const o = useApi(() => api.getOverview(schoolId, today), [schoolId, today]);
  const feed = useApi(() => api.listTransactions({ schoolId, from: today, limit: 12 }), [schoolId, today]);
  const students = useApi(() => api.listStudents(schoolId), [schoolId]);
  const seenFeed = useRef<Set<string> | null>(null);

  const d = o.data;
  const salesFlash = useChanged(d?.sales);
  const topupFlash = useChanged(d?.topups);
  const blockedFlash = useChanged(d && d.blockedCount + d.declinedCount);
  const balFlash = useChanged(d?.outstandingBalance);

  // Highlight feed rows that arrived after first load.
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!feed.data) return;
    if (!seenFeed.current) {
      seenFeed.current = new Set(feed.data.map((x) => x.id));
      return;
    }
    const added = feed.data.filter((x) => !seenFeed.current!.has(x.id)).map((x) => x.id);
    if (!added.length) return;
    added.forEach((id) => seenFeed.current!.add(id));
    setFresh(new Set(added));
    const h = setTimeout(() => setFresh(new Set()), 1800);
    return () => clearTimeout(h);
  }, [feed.data]);

  const studentName = (id: string) => {
    const s = students.data?.find((x) => x.id === id);
    return s ? n(s) : '';
  };

  if (o.error) return <ErrorState error={o.error} onRetry={o.reload} />;

  return (
    <>
      <PageTitle title={t('overview.title')} subtitle={i18n.date(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!d ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <Stat label={t('overview.sales')} value={money(d.sales)} icon={<Banknote className="size-4" />} tone="brand" trend={d.salesVsYesterday} hint={t('overview.salesHint', { count: d.salesCount })} highlight={salesFlash} />
            <Stat label={t('overview.topups')} value={money(d.topups)} icon={<Wallet className="size-4" />} tone="brand" hint={t('overview.topupsHint', { count: d.topupCount })} highlight={topupFlash} />
            <Stat label={t('overview.activeWallets')} value={`${num(d.activeWallets)} / ${num(d.totalStudents)}`} icon={<Users className="size-4" />} hint={t('overview.activeHint')} />
            <Stat label={t('overview.outstanding')} value={money(d.outstandingBalance)} icon={<Activity className="size-4" />} hint={t('overview.outstandingHint')} highlight={balFlash} />
          </>
        )}
      </div>

      {d && (
        <div className={`mt-4 grid grid-cols-1 gap-4 rounded-[var(--radius-card)] sm:grid-cols-3 ${blockedFlash ? 'animate-flash' : ''}`}>
          <Link to="/school/transactions?status=blocked" className="flex items-center gap-3 rounded-[var(--radius-card)] border border-red-200 bg-red-50 p-4 hover:bg-red-100/60">
            <ShieldX className="size-8 text-red-700" aria-hidden="true" />
            <div>
              <p className="text-2xl font-bold text-red-900 tabular-nums">{num(d.blockedCount)}</p>
              <p className="text-sm text-red-800">{t('overview.blocked')}</p>
            </div>
          </Link>
          <Link to="/school/transactions?status=declined" className="flex items-center gap-3 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100/60">
            <Ban className="size-8 text-amber-700" aria-hidden="true" />
            <div>
              <p className="text-2xl font-bold text-amber-950 tabular-nums">{num(d.declinedCount)}</p>
              <p className="text-sm text-amber-900">{t('overview.declined')}</p>
            </div>
          </Link>
          <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-slate-200 bg-white p-4">
            <span className="text-3xl" aria-hidden="true">
              ↩
            </span>
            <div>
              <p className="text-2xl font-bold tabular-nums">{money(d.refunds)}</p>
              <p className="text-sm text-slate-600">{t('overview.refunds')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t('overview.byHour')} subtitle={t('overview.byHourHint')} />
          <CardBody>
            {!d ? (
              <Skeleton className="h-64" />
            ) : d.sales === 0 ? (
              <EmptyState title={t('overview.noSales')} description={t('overview.noSalesHint')} />
            ) : (
              <ChartFrame
                columns={[t('overview.hour'), t('overview.sales'), t('overview.orders')]}
                rows={d.salesByHour.map((h) => [`${String(h.hour).padStart(2, '0')}:00`, money(h.sales), num(h.count)])}
                chart={
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={d.salesByHour} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={4}>
                      <CartesianGrid vertical={false} stroke={CHART.grid} />
                      <XAxis dataKey="hour" {...axisProps} tickFormatter={(h: number) => `${h}:00`} />
                      <YAxis {...axisProps} width={56} tickFormatter={(v: number) => money(v, { compact: true })} />
                      <Tooltip cursor={{ fill: CHART.cursor }} content={<ChartTooltip format={(v) => money(v)} labelFormat={(l) => `${l}:00 – ${Number(l) + 1}:00`} />} />
                      <Bar dataKey="sales" name={t('overview.sales')} fill={CHART.single} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('overview.topItems')} />
          <CardBody>
            {!d ? (
              <LoadingBlock rows={4} />
            ) : d.topItems.length === 0 ? (
              <EmptyState title={t('overview.noSales')} />
            ) : (
              <ol className="space-y-3">
                {d.topItems.map((it, i) => {
                  const max = d.topItems[0].revenue;
                  return (
                    <li key={it.itemId}>
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">
                          <span className="text-slate-500">{i + 1}.</span> {n(it)}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{money(it.revenue)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full" style={{ width: `${(it.revenue / max) * 100}%`, backgroundColor: CHART.single }} />
                        </div>
                        <span className="w-12 text-end text-xs text-slate-600">×{num(it.qty)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title={t('overview.liveFeed')}
          subtitle={t('overview.liveFeedHint')}
          action={
            <Link to="/school/transactions" className="text-sm font-semibold text-brand-700 hover:underline">
              {t('common.seeAll')}
            </Link>
          }
        />
        <CardBody>
          {feed.loading ? (
            <LoadingBlock rows={4} />
          ) : !feed.data?.length ? (
            <EmptyState title={t('overview.noActivity')} description={t('overview.noActivityHint')} />
          ) : (
            <div className="grid grid-cols-1 gap-x-6 divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0">
              {feed.data.map((tx) => (
                <TxRow key={tx.id} tx={tx} highlight={fresh.has(tx.id)} subtitle={`${studentName(tx.studentId)} · ${i18n.time(tx.createdAt)}`} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
