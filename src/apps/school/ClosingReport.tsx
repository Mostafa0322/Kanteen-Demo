import { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { api, dayKey } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { downloadFile, toCsv } from '@/lib/csv';
import { Button } from '@/ui/Button';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { Input } from '@/ui/Form';
import { PageTitle } from '@/ui/Misc';
import { ErrorState, LoadingBlock } from '@/ui/States';

export function ClosingReport({ schoolId }: { schoolId: string }) {
  const { t, n, money, num, date: fmtDate } = useI18n();
  const [date, setDate] = useState(dayKey());
  const r = useApi(() => api.getClosingReport(schoolId, date), [schoolId, date]);
  const schools = useApi(() => api.listSchools(), [], { live: false });
  const school = schools.data?.find((s) => s.id === schoolId);

  const exportCsv = () => {
    if (!r.data) return;
    const d = r.data;
    const rows: (string | number)[][] = [
      ['section', 'label', 'amount', 'count'],
      ['summary', 'opening_float', d.openingFloat, ''],
      ['summary', 'gross_sales', d.grossSales, ''],
      ['summary', 'refunds', d.refunds, ''],
      ['summary', 'net_sales', d.netSales, ''],
      ['summary', 'topups', d.topups, ''],
      ['summary', 'shop_paid_from_wallet', d.shopFromWallet, ''],
      ['summary', 'shop_sales_all_methods', d.shopSales, ''],
      ['summary', 'closing_float', d.closingFloat, ''],
      ['summary', 'declined', '', d.declined],
      ['summary', 'blocked', '', d.blocked],
      ['summary', 'offline_synced', '', d.offlineSynced],
      ...d.byVendor.map((v) => ['vendor', v.name, v.sales, v.count]),
      ...d.byCategory.map((c) => ['category', c.category, c.sales, c.qty]),
      ...d.topupsByMethod.map((m) => ['topup_method', m.method, m.amount, m.count]),
    ];
    downloadFile(`kanteen-closing_${schoolId}_${date}.csv`, toCsv(rows));
  };

  const d = r.data;
  const reconciles = d ? Math.abs(d.openingFloat + d.topups + d.refunds - d.grossSales - d.shopFromWallet - d.closingFloat) < 0.01 : true;

  return (
    <>
      <PageTitle
        title={t('closing.title')}
        subtitle={school ? `${n(school)} · ${fmtDate(date + 'T12:00:00', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
        actions={
          <>
            <label htmlFor="closing-date" className="sr-only">
              {t('closing.date')}
            </label>
            <Input id="closing-date" type="date" value={date} max={dayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} className="!w-44" />
            <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => window.print()}>
              {t('closing.print')}
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv} disabled={!d}>
              {t('tx.export')}
            </Button>
          </>
        }
      />
      {r.error ? (
        <ErrorState error={r.error} onRetry={r.reload} />
      ) : !d ? (
        <LoadingBlock rows={6} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title={t('closing.reconciliation')} subtitle={reconciles ? t('closing.balanced') : t('closing.unbalanced')} />
            <CardBody>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <Line label={t('closing.opening')} value={money(d.openingFloat)} />
                  <Line label={t('closing.topups')} value={`+ ${money(d.topups)}`} positive />
                  <Line label={t('closing.refunds')} value={`+ ${money(d.refunds)}`} positive />
                  <Line label={t('closing.gross')} value={`− ${money(d.grossSales)}`} />
                  <Line label={t('closing.shopFromWallet')} value={`− ${money(d.shopFromWallet)}`} />
                  <Line label={t('closing.closing')} value={money(d.closingFloat)} strong />
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-600">{t('closing.floatHint')}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Mini label={t('closing.net')} value={money(d.netSales)} />
                <Mini label={t('status.declined')} value={num(d.declined)} />
                <Mini label={t('status.blocked')} value={num(d.blocked)} />
                <Mini label={t('closing.offline')} value={num(d.offlineSynced)} />
                <Mini label={t('closing.shopSales')} value={money(d.shopSales)} />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('closing.byMethod')} />
            <CardBody>
              {d.topupsByMethod.length === 0 ? (
                <p className="text-sm text-slate-600">{t('closing.none')}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {d.topupsByMethod.map((m) => (
                    <li key={m.method} className="flex justify-between">
                      <span>
                        {t(`topup.method.${m.method === 'cash_desk' ? 'card' : (m.method as 'card')}`)} <span className="text-slate-500">×{num(m.count)}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{money(m.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('closing.byVendor')} />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {d.byVendor.map((v) => (
                  <li key={v.vendorId} className="flex justify-between">
                    <span>
                      {n(v)} <span className="text-slate-500">×{num(v.count)}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{money(v.sales)}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title={t('closing.byCategory')} />
            <CardBody>
              {d.byCategory.length === 0 ? (
                <p className="text-sm text-slate-600">{t('closing.none')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-600 uppercase">
                    <tr>
                      <th className="py-1 text-start font-semibold">{t('menuMgmt.category')}</th>
                      <th className="py-1 text-end font-semibold">{t('closing.qty')}</th>
                      <th className="py-1 text-end font-semibold">{t('reports.sales')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d.byCategory.map((c) => (
                      <tr key={c.category}>
                        <td className="py-1.5">{t(`category.${c.category}`)}</td>
                        <td className="py-1.5 text-end tabular-nums">{num(c.qty)}</td>
                        <td className="py-1.5 text-end font-semibold tabular-nums">{money(c.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}

function Line({ label, value, strong, positive }: { label: string; value: string; strong?: boolean; positive?: boolean }) {
  return (
    <tr className={strong ? 'border-t-2 border-slate-300' : ''}>
      <td className={`py-2 ${strong ? 'font-bold' : 'text-slate-700'}`}>{label}</td>
      <td className={`py-2 text-end tabular-nums ${strong ? 'text-lg font-bold' : positive ? 'text-emerald-700' : ''}`}>{value}</td>
    </tr>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs text-slate-600">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
