import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Search, WifiOff } from 'lucide-react';
import { addDays, api, dayKey, type TxFilter, type TxStatus, type TxType } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { downloadFile, toCsv } from '@/lib/csv';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input, Select } from '@/ui/Form';
import { PageTitle } from '@/ui/Misc';
import { EmptyState, ErrorState, LoadingBlock } from '@/ui/States';
import { TxAmount, TxStatusBadge, reasonText, txTitle } from '@/components/domain';

const PAGE = 50;

export function Transactions({ schoolId }: { schoolId: string }) {
  const i18n = useI18n();
  const { t, n, money, num } = i18n;
  const [params] = useSearchParams();
  const [from, setFrom] = useState(dayKey(addDays(new Date(), -6)));
  const [to, setTo] = useState(dayKey());
  const [vendorId, setVendorId] = useState('');
  const [type, setType] = useState<TxType | 'all'>('all');
  const [status, setStatus] = useState<TxStatus | 'all'>((params.get('status') as TxStatus | null) ?? 'all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);

  const filter: TxFilter = { schoolId, from, to, vendorId: vendorId || undefined, type, status, query };
  const txs = useApi(() => api.listTransactions(filter), [filter]);
  const vendors = useApi(() => api.listVendors(schoolId), [schoolId], { live: false });
  const students = useApi(() => api.listStudents(schoolId), [schoolId]);
  const studentName = (id: string) => {
    const s = students.data?.find((x) => x.id === id);
    return s ? n(s) : id;
  };
  const vendorName = (id?: string) => {
    const v = vendors.data?.find((x) => x.id === id);
    return v ? n(v) : '—';
  };

  const totals = useMemo(() => {
    const d = txs.data ?? [];
    const ok = d.filter((x) => x.status === 'approved');
    return {
      count: d.length,
      sales: ok.filter((x) => x.type === 'purchase').reduce((a, x) => a + x.amount, 0),
      topups: ok.filter((x) => x.type === 'topup').reduce((a, x) => a + x.amount, 0),
      refunds: ok.filter((x) => x.type === 'refund').reduce((a, x) => a + x.amount, 0),
      problems: d.filter((x) => x.status !== 'approved').length,
    };
  }, [txs.data]);

  const exportCsv = () => {
    const rows = (txs.data ?? []).map((x) => [
      x.id,
      x.createdAt,
      x.type,
      x.status,
      studentName(x.studentId),
      x.braceletId ?? '',
      vendorName(x.vendorId),
      (x.lines ?? []).map((l) => `${l.name} x${l.qty}`).join('; '),
      x.type === 'purchase' && x.status === 'approved' ? -x.amount : x.amount,
      i18n.currency,
      x.balanceAfter ?? '',
      x.reason ?? '',
      x.method ?? '',
      x.offline ? 'yes' : '',
      x.note ?? '',
    ]);
    const csv = toCsv([['id', 'timestamp', 'type', 'status', 'student', 'bracelet', 'vendor', 'items', 'amount', 'currency', 'balance_after', 'decline_reason', 'method', 'offline', 'note'], ...rows]);
    downloadFile(`kanteen-transactions_${from}_${to}.csv`, csv);
  };

  return (
    <>
      <PageTitle
        title={t('tx.title')}
        subtitle={t('tx.subtitle')}
        actions={
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv} disabled={!txs.data?.length}>
            {t('tx.export')}
          </Button>
        }
      />
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Field label={t('tx.from')}>{(id) => <Input id={id} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label={t('tx.to')}>{(id) => <Input id={id} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />}</Field>
          <Field label={t('tx.vendor')}>
            {(id) => (
              <Select id={id} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                <option value="">{t('tx.allVendors')}</option>
                {vendors.data?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {n(v)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('tx.type')}>
            {(id) => (
              <Select id={id} value={type} onChange={(e) => setType(e.target.value as TxType | 'all')}>
                {(['all', 'purchase', 'topup', 'refund', 'transfer'] as const).map((v) => (
                  <option key={v} value={v}>
                    {t(`tx.type.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('tx.status')}>
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as TxStatus | 'all')}>
                {(['all', 'approved', 'blocked', 'declined', 'failed'] as const).map((v) => (
                  <option key={v} value={v}>
                    {v === 'all' ? t('tx.allStatuses') : t(`status.${v}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('tx.search')}>
            {(id) => (
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <Input id={id} type="search" className="ps-9" placeholder={t('tx.searchPh')} value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            )}
          </Field>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          [t('tx.sum.count'), num(totals.count)],
          [t('tx.sum.sales'), money(totals.sales)],
          [t('tx.sum.topups'), money(totals.topups)],
          [t('tx.sum.refunds'), money(totals.refunds)],
          [t('tx.sum.problems'), num(totals.problems)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-600">{label}</p>
            <p className="text-lg font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <Card className="mt-4">
        {txs.loading ? (
          <LoadingBlock className="p-4" rows={8} />
        ) : txs.error ? (
          <ErrorState className="m-4" error={txs.error} onRetry={txs.reload} />
        ) : !txs.data!.length ? (
          <EmptyState className="m-4" title={t('tx.empty')} description={t('tx.emptyHint')} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-slate-50 text-xs tracking-wide text-slate-600 uppercase">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('tx.col.time')}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('tx.col.student')}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('tx.col.details')}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('tx.vendor')}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('tx.status')}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t('tx.col.amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {txs.data!.slice(0, shown).map((x) => {
                    const item = x.lines?.find((l) => l.itemId === x.reasonDetail?.itemId);
                    return (
                      <tr key={x.id} className="align-top hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{i18n.dateTime(x.createdAt)}</td>
                        <td className="px-4 py-2.5 font-medium">{studentName(x.studentId)}</td>
                        <td className="max-w-xs px-4 py-2.5">
                          <p className="truncate">{txTitle(i18n, x)}</p>
                          {x.status !== 'approved' && <p className="text-xs text-red-700">{reasonText(i18n, x.reason, x.reasonDetail, item ? n(item) : undefined)}</p>}
                          {x.note && <p className="truncate text-xs text-slate-500">{x.note}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{vendorName(x.vendorId)}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1">
                            <TxStatusBadge tx={x} />
                            {x.offline && x.status !== 'approved' && <WifiOff className="size-3.5 text-slate-500" aria-label={t('tx.offlineSynced')} />}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-end">
                          <TxAmount tx={x} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {txs.data!.length > shown && (
              <div className="border-t border-slate-200 p-3 text-center">
                <Button variant="ghost" onClick={() => setShown((s) => s + PAGE)}>
                  {t('tx.more', { count: txs.data!.length - shown })}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
