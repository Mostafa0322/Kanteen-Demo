import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { PageTitle, ProgressBar } from '@/ui/Misc';
import { EmptyState, ErrorState, Skeleton } from '@/ui/States';
import { CHART, ChartFrame, ChartTooltip, Legend, axisProps } from './charts';

export function Reports({ schoolId }: { schoolId: string }) {
  const i18n = useI18n();
  const { t, money, num } = i18n;
  const r = useApi(() => api.getWeeklyReport(schoolId), [schoolId]);
  const d = r.data;

  if (r.error) return <ErrorState error={r.error} onRetry={r.reload} />;

  const weekLabel = (ws: string) => i18n.date(ws + 'T12:00:00', { day: 'numeric', month: 'short' });
  const pct = (a: number, b: number) => num(b ? a / b : 0, { style: 'percent', maximumFractionDigits: 0 });

  return (
    <>
      <PageTitle title={t('reports.title')} subtitle={t('reports.subtitle')} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title={t('reports.weekly')} subtitle={t('reports.weeklyHint')} />
          <CardBody>
            {!d ? (
              <Skeleton className="h-72" />
            ) : (
              <ChartFrame
                legend={
                  <Legend
                    items={[
                      { label: t('reports.sales'), color: CHART.series[0] },
                      { label: t('reports.topups'), color: CHART.series[1] },
                    ]}
                  />
                }
                columns={[t('reports.weekOf'), t('reports.sales'), t('reports.topups'), t('reports.refunds')]}
                rows={d.weeks.map((w) => [weekLabel(w.weekStart), money(w.sales), money(w.topups), money(w.refunds)])}
                chart={
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={d.weeks.map((w) => ({ ...w, label: weekLabel(w.weekStart) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                      <CartesianGrid vertical={false} stroke={CHART.grid} />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} width={60} tickFormatter={(v: number) => money(v, { compact: true })} />
                      <Tooltip cursor={{ fill: CHART.cursor }} content={<ChartTooltip format={(v) => money(v)} />} />
                      <Bar dataKey="sales" name={t('reports.sales')} fill={CHART.series[0]} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                      <Bar dataKey="topups" name={t('reports.topups')} fill={CHART.series[1]} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('reports.blockedWeekly')} subtitle={t('reports.blockedWeeklyHint')} />
          <CardBody>
            {!d ? (
              <Skeleton className="h-72" />
            ) : (
              <ChartFrame
                columns={[t('reports.weekOf'), t('overview.blocked'), t('overview.declined')]}
                rows={d.weeks.map((w) => [weekLabel(w.weekStart), num(w.blocked), num(w.declined)])}
                chart={
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={d.weeks.map((w) => ({ ...w, label: weekLabel(w.weekStart) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={CHART.grid} />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} width={40} allowDecimals={false} />
                      <Tooltip cursor={{ fill: CHART.cursor }} content={<ChartTooltip format={(v) => num(v)} />} />
                      <Bar dataKey="blocked" name={t('overview.blocked')} fill={CHART.single} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('reports.byReason')} subtitle={t('reports.byReasonHint')} />
          <CardBody>
            {!d ? (
              <Skeleton className="h-48" />
            ) : d.blockedByReason.length === 0 ? (
              <EmptyState title={t('reports.noBlocks')} />
            ) : (
              <ul className="space-y-3">
                {d.blockedByReason.map((b) => (
                  <li key={b.reason}>
                    <div className="flex justify-between text-sm">
                      <span>{t(`reason.${b.reason}`)}</span>
                      <span className="font-semibold tabular-nums">{num(b.count)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full" style={{ width: `${(b.count / d.blockedByReason[0].count) * 100}%`, backgroundColor: CHART.single }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('reports.adoption')} subtitle={t('reports.adoptionHint')} />
          <CardBody>
            {!d ? (
              <Skeleton className="h-48" />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    [t('reports.withBracelet'), d.adoption.withBracelet],
                    [t('reports.active7'), d.adoption.activeLast7],
                    [t('reports.parentsLinked'), d.adoption.parentsLinked],
                  ].map(([label, v]) => (
                    <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-2xl font-bold tabular-nums">{pct(Number(v), d.adoption.total)}</p>
                      <p className="text-xs text-slate-600">{label}</p>
                      <ProgressBar variant="plain" className="mt-2 !h-1.5" value={Number(v)} max={d.adoption.total} label={String(label)} />
                      <p className="mt-1 text-xs text-slate-500 tabular-nums">
                        {num(Number(v))} / {num(d.adoption.total)}
                      </p>
                    </div>
                  ))}
                </div>
                <h3 className="mt-5 mb-2 text-sm font-semibold text-slate-700">{t('reports.dailyActive')}</h3>
                <ChartFrame
                  columns={[t('reports.day'), t('reports.activeStudents')]}
                  rows={d.dailyActive.map((x) => [i18n.date(x.date + 'T12:00:00', { weekday: 'short', day: 'numeric', month: 'short' }), num(x.active)])}
                  chart={
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={d.dailyActive} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={CHART.grid} />
                        <XAxis dataKey="date" {...axisProps} tickFormatter={(v: string) => i18n.date(v + 'T12:00:00', { day: 'numeric', month: 'short' })} />
                        <YAxis {...axisProps} width={36} allowDecimals={false} />
                        <Tooltip
                          cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
                          content={<ChartTooltip format={(v) => num(v)} labelFormat={(l) => i18n.date(String(l) + 'T12:00:00', { weekday: 'long', day: 'numeric', month: 'short' })} />}
                        />
                        <Line type="monotone" dataKey="active" name={t('reports.activeStudents')} stroke={CHART.single} strokeWidth={2} dot={{ r: 3, fill: CHART.single, strokeWidth: 0 }} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  }
                />
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
