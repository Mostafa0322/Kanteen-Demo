import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BellOff, Receipt } from 'lucide-react';
import { addDays, api, dayKey, type Transaction, type TxFilter } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { cx } from '@/lib/cx';
import { Segmented } from '@/ui/Form';
import { Modal } from '@/ui/Modal';
import { EmptyState, ErrorState, LoadingBlock } from '@/ui/States';
import { Button } from '@/ui/Button';
import { TxAmount, TxRow, TxStatusBadge, reasonText, txTitle } from '@/components/domain';
import { notificationText } from './notifications';

type Kind = 'all' | 'purchase' | 'topup' | 'problems';
type Range = '7' | '30' | 'all';

export function ActivityScreen({ studentId, parentId }: { studentId: string; parentId: string }) {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'alerts' ? 'alerts' : 'tx';
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">{t('activity.title')}</h1>
      <Segmented
        className="mt-3 w-full"
        value={tab}
        onChange={(v) => setParams(v === 'alerts' ? { tab: 'alerts' } : {}, { replace: true })}
        options={[
          { value: 'tx', label: t('activity.transactions') },
          { value: 'alerts', label: t('activity.notifications') },
        ]}
      />
      <div className="mt-4">{tab === 'tx' ? <Transactions studentId={studentId} /> : <Notifications parentId={parentId} />}</div>
    </div>
  );
}

function Transactions({ studentId }: { studentId: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const [kind, setKind] = useState<Kind>('all');
  const [range, setRange] = useState<Range>('7');
  const [open, setOpen] = useState<Transaction | null>(null);

  const filter: TxFilter = {
    studentId,
    type: kind === 'purchase' ? 'purchase' : kind === 'topup' ? 'topup' : 'all',
    status: kind === 'problems' ? 'not_approved' : kind === 'purchase' ? 'approved' : 'all',
    from: range === 'all' ? undefined : dayKey(addDays(new Date(), -Number(range) + 1)),
  };
  const txs = useApi(() => api.listTransactions(filter), [filter]);

  const groups = useMemo(() => {
    const out: { day: string; items: Transaction[] }[] = [];
    for (const tx of txs.data ?? []) {
      const d = dayKey(tx.createdAt);
      const last = out[out.length - 1];
      if (last?.day === d) last.items.push(tx);
      else out.push({ day: d, items: [tx] });
    }
    return out;
  }, [txs.data]);

  const dayLabel = (d: string) => (d === dayKey() ? t('time.today') : d === dayKey(addDays(new Date(), -1)) ? t('time.yesterday') : i18n.date(d + 'T12:00:00', { weekday: 'long', day: 'numeric', month: 'short' }));

  return (
    <>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(['all', 'purchase', 'topup', 'problems'] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={cx('rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ring-1 ring-inset', kind === k ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-300')}
          >
            {t(`activity.filter.${k}`)}
          </button>
        ))}
      </div>
      <Segmented
        size="sm"
        className="mt-2"
        value={range}
        onChange={setRange}
        options={[
          { value: '7', label: t('activity.range.7') },
          { value: '30', label: t('activity.range.30') },
          { value: 'all', label: t('activity.range.all') },
        ]}
      />

      <div className="mt-3">
        {txs.loading ? (
          <LoadingBlock rows={5} />
        ) : txs.error ? (
          <ErrorState error={txs.error} onRetry={txs.reload} />
        ) : groups.length === 0 ? (
          <EmptyState icon={<Receipt className="size-6" />} title={t('activity.empty')} description={t('activity.emptyHint')} />
        ) : (
          <div className="space-y-4">
            {groups.map((g) => {
              const spent = g.items.filter((x) => x.type === 'purchase' && x.status === 'approved').reduce((a, x) => a + x.amount, 0);
              return (
                <section key={g.day}>
                  <div className="mb-1 flex items-center justify-between px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <h2>{dayLabel(g.day)}</h2>
                    {spent > 0 && <span className="normal-case">{t('activity.spent', { amount: i18n.money(spent) })}</span>}
                  </div>
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-1">
                    {g.items.map((tx) => (
                      <TxRow key={tx.id} tx={tx} subtitle={i18n.time(tx.createdAt)} onClick={() => setOpen(tx)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
      <ReceiptModal tx={open} onClose={() => setOpen(null)} />
    </>
  );
}

function ReceiptModal({ tx, onClose }: { tx: Transaction | null; onClose: () => void }) {
  const i18n = useI18n();
  const { t, money, n } = i18n;
  const vendors = useApi(() => api.listVendors(), [], { live: false });
  if (!tx) return null;
  const vendor = vendors.data?.find((v) => v.id === tx.vendorId);
  const item = tx.lines?.find((l) => l.itemId === tx.reasonDetail?.itemId);
  return (
    <Modal open onClose={onClose} title={txTitle(i18n, tx)}>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <TxStatusBadge tx={tx} />
          <TxAmount tx={tx} className="text-lg" />
        </div>
        {tx.status !== 'approved' && (
          <p className={cx('rounded-lg p-3 font-medium', tx.status === 'blocked' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900')}>{reasonText(i18n, tx.reason, tx.reasonDetail, item ? n(item) : undefined)}</p>
        )}
        {tx.lines && (
          <table className="w-full">
            <caption className="sr-only">{t('activity.items')}</caption>
            <tbody className="divide-y divide-slate-100">
              {tx.lines.map((l) => (
                <tr key={l.itemId}>
                  <td className="py-1.5">
                    {n(l)} {l.qty > 1 && <span className="text-slate-500">×{l.qty}</span>}
                  </td>
                  <td className="py-1.5 text-end tabular-nums">{money(l.price * l.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <dl className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-slate-50 p-3">
          <dt className="text-slate-600">{t('activity.when')}</dt>
          <dd className="text-end">{i18n.dateTime(tx.createdAt)}</dd>
          {vendor && (
            <>
              <dt className="text-slate-600">{t('activity.where')}</dt>
              <dd className="text-end">{n(vendor)}</dd>
            </>
          )}
          {tx.method && (
            <>
              <dt className="text-slate-600">{t('topup.method')}</dt>
              <dd className="text-end">{t(`topup.method.${tx.method === 'cash_desk' ? 'card' : tx.method}`)}</dd>
            </>
          )}
          {tx.balanceAfter != null && tx.status === 'approved' && (
            <>
              <dt className="text-slate-600">{t('activity.balanceAfter')}</dt>
              <dd className="text-end tabular-nums">{money(tx.balanceAfter)}</dd>
            </>
          )}
          {tx.note && (
            <>
              <dt className="text-slate-600">{t('activity.note')}</dt>
              <dd className="text-end">{tx.note}</dd>
            </>
          )}
          <dt className="text-slate-600">{t('topup.reference')}</dt>
          <dd className="ltr-nums text-end font-mono text-xs">{tx.id}</dd>
        </dl>
      </div>
    </Modal>
  );
}

function Notifications({ parentId }: { parentId: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const list = useApi(() => api.listNotifications(parentId), [parentId]);
  const kids = useApi(() => api.getChildren(parentId), [parentId]);
  const unread = list.data?.filter((x) => !x.read).length ?? 0;

  // Opening the feed marks everything as read (after a short delay so the dots are visible).
  useEffect(() => {
    if (!unread) return;
    const h = setTimeout(() => void api.markNotificationsRead(parentId), 2500);
    return () => clearTimeout(h);
  }, [unread, parentId]);

  if (list.loading) return <LoadingBlock rows={5} />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (!list.data!.length) return <EmptyState icon={<BellOff className="size-6" />} title={t('notif.empty')} description={t('notif.emptyHint')} />;

  const dot: Record<string, string> = { error: 'bg-red-500', warning: 'bg-amber-500', success: 'bg-emerald-500', info: 'bg-sky-500' };
  return (
    <>
      {unread > 0 && (
        <div className="mb-2 flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => api.markNotificationsRead(parentId)}>
            {t('notif.markRead')}
          </Button>
        </div>
      )}
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {list.data!.map((x) => {
          const kid = kids.data?.find((k) => k.id === x.studentId);
          const msg = notificationText(i18n, x, kid ? i18n.n(kid) : '');
          return (
            <li key={x.id} className={cx('flex gap-3 px-4 py-3', !x.read && 'bg-brand-50/50')}>
              <span className={cx('mt-1.5 size-2.5 shrink-0 rounded-full', dot[msg.tone])} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={cx('text-sm', x.read ? 'font-medium' : 'font-bold')}>{msg.title}</p>
                  <time className="shrink-0 text-xs text-slate-500" dateTime={x.createdAt}>
                    {i18n.relative(x.createdAt)}
                  </time>
                </div>
                <p className="mt-0.5 text-sm text-slate-600">{msg.body}</p>
              </div>
              {!x.read && <span className="sr-only">{t('notif.unread')}</span>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
