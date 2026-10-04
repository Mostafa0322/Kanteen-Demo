import { useEffect, useRef } from 'react';
import { Ban, CheckCircle2, CloudOff, Radio, ShieldX, Snowflake, XCircle } from 'lucide-react';
import type { ChargeOutcome, DeclineReason, LocalizedName, Transaction, TxLine } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import { ALLERGEN_EMOJI, reasonText } from '@/components/domain';

export interface Display {
  key: string;
  outcome: ChargeOutcome;
  reason?: DeclineReason;
  reasonDetail?: Transaction['reasonDetail'];
  total: number;
  student: LocalizedName | null;
  braceletId: string;
  balance: number;
  spentToday: number;
  dailyLimit: number | null;
  lines: TxLine[];
  offline: boolean;
  /** Triggered from another device (e.g. the demo panel). */
  remote: boolean;
}

const AUTO_CLOSE_MS = 7000;

export function ResultOverlay({ display: d, onClose }: { display: Display; onClose: () => void }) {
  const i18n = useI18n();
  const { t, n, money } = i18n;

  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const h = setTimeout(() => close.current(), d.outcome === 'approved' ? AUTO_CLOSE_MS : AUTO_CLOSE_MS * 2);
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && close.current();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(h);
      window.removeEventListener('keydown', onKey);
    };
  }, [d.key, d.outcome]);

  const blockedItem = d.reasonDetail?.itemId ? d.lines.find((l) => l.itemId === d.reasonDetail?.itemId) : undefined;
  const isFrozen = d.reason === 'frozen';
  const theme =
    d.outcome === 'approved'
      ? { bg: 'bg-emerald-600', icon: <CheckCircle2 className="size-20" />, title: t('pos.result.approved') }
      : d.outcome === 'blocked'
        ? { bg: 'bg-red-700', icon: <ShieldX className="size-20" />, title: t('pos.result.blocked') }
        : isFrozen
          ? { bg: 'bg-sky-700', icon: <Snowflake className="size-20" />, title: t('pos.result.frozen') }
          : { bg: 'bg-amber-500 text-amber-950', icon: d.reason === 'inactive_bracelet' || d.reason === 'unknown_bracelet' ? <Ban className="size-20" /> : <XCircle className="size-20" />, title: t('pos.result.declined') };

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={theme.title}
      className={cx('fixed inset-0 z-40 flex lg:absolute lg:z-20 flex-col overflow-y-auto p-6 text-white animate-pop', theme.bg)}
    >
      <div className="flex items-center justify-between text-xs font-semibold tracking-wide uppercase opacity-90">
        <span className="ltr-nums font-mono">{d.braceletId}</span>
        {d.offline ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5">
            <CloudOff className="size-3.5" /> {t('pos.result.offline')}
          </span>
        ) : d.remote ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5">
            <Radio className="size-3.5" /> {t('pos.result.remote')}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span aria-hidden="true">{theme.icon}</span>
        <p className="mt-3 text-4xl font-black tracking-tight">{theme.title}</p>
        {d.student && <p className="mt-1 text-lg font-semibold opacity-95">{n(d.student)}</p>}

        {d.outcome !== 'approved' && (
          <div className="mt-5 w-full rounded-2xl bg-black/20 p-4 text-start">
            <p className="text-xs font-bold tracking-wide uppercase opacity-80">{t('pos.result.reason')}</p>
            {blockedItem && <p className="mt-1 text-2xl font-black">{n(blockedItem)}</p>}
            <p className="mt-1 text-xl leading-snug font-bold">
              {d.reasonDetail?.allergen && <span aria-hidden="true">{ALLERGEN_EMOJI[d.reasonDetail.allergen]} </span>}
              {reasonText(i18n, d.reason, d.reasonDetail, blockedItem ? n(blockedItem) : undefined)}
            </p>
            {d.reason === 'insufficient_balance' && (
              <p className="mt-2 text-sm opacity-95">{t('pos.result.balanceVsTotal', { balance: money(d.balance), total: money(d.total) })}</p>
            )}
            {d.outcome === 'blocked' && <p className="mt-2 text-sm opacity-95">{t('pos.result.blockedHint')}</p>}
            {(d.reason === 'inactive_bracelet' || isFrozen) && <p className="mt-2 text-sm opacity-95">{t(isFrozen ? 'pos.result.frozenHint' : 'pos.result.inactiveHint')}</p>}
          </div>
        )}

        {d.outcome === 'approved' && (
          <dl className="mt-5 grid w-full grid-cols-2 gap-3 text-start">
            <div className="rounded-2xl bg-black/15 p-3">
              <dt className="text-xs font-semibold uppercase opacity-80">{t('pos.result.charged')}</dt>
              <dd className="text-2xl font-bold tabular-nums">{money(d.total)}</dd>
            </div>
            <div className="rounded-2xl bg-black/15 p-3">
              <dt className="text-xs font-semibold uppercase opacity-80">{t('pos.result.balance')}</dt>
              <dd className="text-2xl font-bold tabular-nums">{money(d.balance)}</dd>
            </div>
            {d.dailyLimit != null && (
              <div className="col-span-2 rounded-2xl bg-black/15 p-3">
                <dt className="text-xs font-semibold uppercase opacity-80">{t('pos.result.today')}</dt>
                <dd className="text-lg font-bold tabular-nums">
                  {money(d.spentToday)} / {money(d.dailyLimit)}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <button type="button" onClick={onClose} autoFocus className="mt-4 h-14 w-full rounded-2xl bg-white/95 text-lg font-bold text-slate-900 hover:bg-white">
        {d.outcome === 'approved' ? t('pos.result.next') : t('pos.result.back')}
      </button>
    </div>
  );
}
