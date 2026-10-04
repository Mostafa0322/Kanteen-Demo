import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, Ban, RefreshCcw, Repeat, ShieldX, WifiOff, XCircle } from 'lucide-react';
import type { Allergen, Category, DeclineReason, Transaction } from '@/mock-api';
import { useI18n, type I18n } from '@/i18n/I18nProvider';
import { Badge, type Tone } from '@/ui/Badge';
import { cx } from '@/lib/cx';

export const ALLERGEN_EMOJI: Record<Allergen, string> = {
  nuts: '🥜',
  dairy: '🥛',
  gluten: '🌾',
  eggs: '🥚',
  soy: '🫘',
  sesame: '🌱',
  fish: '🐟',
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  meals: '🍽️',
  sandwiches: '🥪',
  snacks: '🍿',
  desserts: '🍰',
  drinks: '🥤',
  fruit: '🍎',
};

export function AllergenBadge({ allergen, active }: { allergen: Allergen; active?: boolean }) {
  const { t } = useI18n();
  return (
    <Badge tone={active ? 'danger' : 'neutral'} className="!font-medium">
      <span aria-hidden="true">{ALLERGEN_EMOJI[allergen]}</span>
      {t(`allergen.${allergen}`)}
    </Badge>
  );
}

/** Human-readable explanation of why a charge was declined/blocked. */
export function reasonText(i: Pick<I18n, 't' | 'money'>, reason: DeclineReason | undefined, detail?: Transaction['reasonDetail'], itemName?: string): string {
  const { t, money } = i;
  if (!reason) return '';
  switch (reason) {
    case 'blocked_allergy':
      return t('reason.blocked_allergy_detail', { allergen: detail?.allergen ? t(`allergen.${detail.allergen}`) : '', item: itemName ?? '' });
    case 'blocked_category':
      return t('reason.blocked_category_detail', { category: detail?.category ? t(`category.${detail.category}`) : '', item: itemName ?? '' });
    case 'blocked_item':
      return t('reason.blocked_item_detail', { item: itemName ?? '' });
    case 'daily_limit':
      return t('reason.daily_limit_detail', { limit: money(detail?.limit ?? 0), spent: money(detail?.spent ?? 0) });
    default:
      return t(`reason.${reason}`);
  }
}

export function txTitle(i: Pick<I18n, 't' | 'lang'>, tx: Transaction): string {
  const { t, lang } = i;
  if (tx.type === 'topup') return t(tx.status === 'failed' ? 'tx.topupFailed' : 'tx.topup');
  if (tx.type === 'refund') return t('tx.refund');
  if (tx.type === 'transfer') return t('tx.transfer');
  const names = (tx.lines ?? []).map((l) => (lang === 'ar' ? l.nameAr : l.name) + (l.qty > 1 ? ` ×${l.qty}` : ''));
  return names.join(lang === 'ar' ? '، ' : ', ') || t('tx.purchase');
}

export function statusTone(tx: Transaction): Tone {
  if (tx.status === 'blocked') return 'danger';
  if (tx.status === 'declined' || tx.status === 'failed') return 'warning';
  if (tx.type === 'topup' || tx.type === 'refund') return 'success';
  return 'neutral';
}

export function TxStatusBadge({ tx }: { tx: Transaction }) {
  const { t } = useI18n();
  if (tx.status === 'approved') {
    if (tx.offline) return <Badge tone="info" icon={<WifiOff className="size-3" />}>{t('tx.offlineSynced')}</Badge>;
    return <Badge tone="success">{t('status.approved')}</Badge>;
  }
  return <Badge tone={statusTone(tx)}>{t(`status.${tx.status}`)}</Badge>;
}

function txIcon(tx: Transaction): ReactNode {
  const cls = 'size-5';
  if (tx.status === 'blocked') return <ShieldX className={cls} />;
  if (tx.status === 'declined' || tx.status === 'failed') return <Ban className={cls} />;
  if (tx.type === 'topup') return <ArrowDownLeft className={cls} />;
  if (tx.type === 'refund') return <RefreshCcw className={cls} />;
  if (tx.type === 'transfer') return <Repeat className={cls} />;
  return <ArrowUpRight className={cls} />;
}

const iconTone = (tx: Transaction) =>
  tx.status === 'blocked'
    ? 'bg-red-50 text-red-700'
    : tx.status !== 'approved'
      ? 'bg-amber-50 text-amber-700'
      : tx.type === 'purchase'
        ? 'bg-slate-100 text-slate-700'
        : 'bg-emerald-50 text-emerald-700';

export function TxAmount({ tx, className }: { tx: Transaction; className?: string }) {
  const { money } = useI18n();
  if (tx.status !== 'approved') return <span className={cx('tabular-nums text-slate-400 line-through', className)}>{money(tx.amount)}</span>;
  if (tx.type === 'transfer') return <span className={cx('tabular-nums text-slate-600', className)}>{money(tx.amount)}</span>;
  const credit = tx.type === 'topup' || tx.type === 'refund';
  return <span className={cx('font-semibold tabular-nums', credit ? 'text-emerald-700' : 'text-slate-900', className)}>{money(credit ? tx.amount : -tx.amount, { signed: true })}</span>;
}

/** Compact list row used by the parent app and dashboard feeds. */
export function TxRow({ tx, subtitle, highlight, onClick }: { tx: Transaction; subtitle?: ReactNode; highlight?: boolean; onClick?: () => void }) {
  const i18n = useI18n();
  const item = tx.reasonDetail?.itemId ? tx.lines?.find((l) => l.itemId === tx.reasonDetail?.itemId) : undefined;
  const reason = tx.status !== 'approved' ? reasonText(i18n, tx.reason, tx.reasonDetail, item ? i18n.n(item) : undefined) : null;
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx('flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-start', onClick && 'hover:bg-slate-50', highlight && 'animate-flash')}
    >
      <span className={cx('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', iconTone(tx))} aria-hidden="true">
        {txIcon(tx)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-medium text-slate-900">{txTitle(i18n, tx)}</p>
          <TxAmount tx={tx} className="shrink-0 text-sm" />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
          <span>{subtitle ?? i18n.dateTime(tx.createdAt)}</span>
          {tx.status !== 'approved' && <TxStatusBadge tx={tx} />}
          {tx.offline && tx.status === 'approved' && <TxStatusBadge tx={tx} />}
        </div>
        {reason && (
          <p className={cx('mt-1 flex items-start gap-1 text-xs font-medium', tx.status === 'blocked' ? 'text-red-700' : 'text-amber-800')}>
            <XCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {reason}
          </p>
        )}
      </div>
    </Comp>
  );
}
