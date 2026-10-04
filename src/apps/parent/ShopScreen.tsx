import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock, CreditCard, Landmark, Lock, Minus, Plus, ShoppingBag, Smartphone, Ticket, Users, Wallet, XCircle } from 'lucide-react';
import { api, ApiError, type CheckoutMethod, type OfferingView, type Order, type OrderStatus } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { cx } from '@/lib/cx';
import { Badge, type Tone } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Segmented, Switch } from '@/ui/Form';
import { Modal } from '@/ui/Modal';
import { EmptyState, ErrorState, LoadingBlock, Spinner, errorMessage } from '@/ui/States';

type Tab = 'events' | 'store' | 'orders';

export function ShopScreen({ studentId, parentId }: { studentId: string; parentId: string }) {
  const { t, n } = useI18n();
  const [params, setParams] = useSearchParams();
  const tab = (['events', 'store', 'orders'] as Tab[]).find((x) => x === params.get('tab')) ?? 'events';
  const student = useApi(() => api.getStudent(studentId), [studentId]);
  const offerings = useApi(() => api.listOfferingsForStudent(studentId), [studentId]);
  const [buying, setBuying] = useState<OfferingView | null>(null);

  // Open events first; closed/full ones sink to the bottom.
  const events = (offerings.data?.filter((o) => o.kind === 'event') ?? []).sort((a, b) => Number(a.closed) - Number(b.closed));
  const products = offerings.data?.filter((o) => o.kind === 'product') ?? [];

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">{t('shop.title')}</h1>
      <p className="text-sm text-slate-600">{student.data ? t('shop.subtitle', { name: n(student.data) }) : '…'}</p>
      <Segmented
        className="mt-3 w-full"
        value={tab}
        onChange={(v) => setParams(v === 'events' ? {} : { tab: v }, { replace: true })}
        options={[
          { value: 'events', label: t('shop.tab.events') },
          { value: 'store', label: t('shop.tab.store') },
          { value: 'orders', label: t('shop.tab.orders') },
        ]}
      />
      <div className="mt-4">
        {tab === 'orders' ? (
          <MyOrders parentId={parentId} />
        ) : offerings.loading ? (
          <LoadingBlock rows={4} />
        ) : offerings.error ? (
          <ErrorState error={offerings.error} onRetry={offerings.reload} />
        ) : tab === 'events' ? (
          events.length === 0 ? (
            <EmptyState icon={<CalendarDays className="size-6" />} title={t('shop.noEvents')} description={t('shop.noEventsHint')} />
          ) : (
            <div className="space-y-3">
              {events.map((o) => (
                <EventCard key={o.id} o={o} onBuy={() => setBuying(o)} />
              ))}
            </div>
          )
        ) : products.length === 0 ? (
          <EmptyState icon={<ShoppingBag className="size-6" />} title={t('shop.noProducts')} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((o) => (
              <ProductCard key={o.id} o={o} onBuy={() => setBuying(o)} />
            ))}
          </div>
        )}
      </div>
      {buying && student.data && <Checkout offering={buying} studentId={studentId} parentId={parentId} balance={student.data.balance} onClose={() => setBuying(null)} onViewOrders={() => (setBuying(null), setParams({ tab: 'orders' }, { replace: true }))} />}
    </div>
  );
}

export function gradesLabel(t: ReturnType<typeof useI18n>['t'], grades: number[]): string {
  if (!grades.length) return t('shop.allGrades');
  const sorted = [...grades].sort((a, b) => a - b);
  const contiguous = sorted.every((g, i) => i === 0 || g === sorted[i - 1] + 1);
  return contiguous && sorted.length > 1 ? t('shop.gradesRange', { from: sorted[0], to: sorted[sorted.length - 1] }) : t('shop.gradesList', { list: sorted.join(', ') });
}

function EventCard({ o, onBuy }: { o: OfferingView; onBuy: () => void }) {
  const i18n = useI18n();
  const { t, n, money, num } = i18n;
  const status = o.registered ? 'registered' : !o.eligible ? 'ineligible' : o.closed ? (o.remaining === 0 ? 'soldout' : 'closed') : 'open';
  return (
    <article className={cx('overflow-hidden rounded-2xl border bg-white shadow-sm', o.registered ? 'border-emerald-300' : 'border-slate-200')}>
      <div className="flex gap-3 p-3">
        <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-violet-50 py-2 text-violet-800">
          <span className="text-2xl" aria-hidden="true">
            {o.emoji}
          </span>
          {o.eventDate && (
            <span className="mt-1 text-center text-[11px] leading-tight font-bold uppercase">{i18n.date(o.eventDate, { day: 'numeric', month: 'short' })}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-semibold text-slate-900">{n(o)}</h2>
            <span className="shrink-0 font-bold tabular-nums">{money(o.price)}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{(i18n.lang === 'ar' && o.descriptionAr) || o.description}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
            {o.eventDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" /> {i18n.date(o.eventDate, { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {gradesLabel(t, o.grades)}
            </span>
            {o.deadline && status === 'open' && (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> {t('shop.registerBy', { date: i18n.date(o.deadline, { day: 'numeric', month: 'short' }) })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {status === 'registered' && (
            <Badge tone="success" icon={<CheckCircle2 className="size-3" />}>
              {t('shop.registered')}
            </Badge>
          )}
          {status === 'ineligible' && <Badge tone="neutral">{t('shop.notEligible')}</Badge>}
          {status === 'closed' && <Badge tone="neutral">{t('shop.closed')}</Badge>}
          {status === 'soldout' && <Badge tone="danger">{t('shop.full')}</Badge>}
          {status === 'open' && o.remaining != null && o.remaining <= 10 && <Badge tone="warning">{t('shop.spotsLeft', { count: num(o.remaining) })}</Badge>}
        </div>
        {status === 'open' && (
          <Button size="sm" icon={<Ticket className="size-4" />} onClick={onBuy}>
            {t('shop.register')}
          </Button>
        )}
      </div>
    </article>
  );
}

function ProductCard({ o, onBuy }: { o: OfferingView; onBuy: () => void }) {
  const { t, n, money, num } = useI18n();
  const unavailable = o.closed || !o.eligible;
  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={unavailable}
      className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3 text-start shadow-sm transition hover:border-brand-300 disabled:opacity-60"
    >
      <span className="flex h-16 items-center justify-center rounded-xl bg-slate-50 text-4xl" aria-hidden="true">
        {o.emoji}
      </span>
      <span className="mt-2 line-clamp-2 text-sm leading-snug font-semibold text-slate-900">{n(o)}</span>
      <span className="mt-auto pt-1 font-bold text-brand-800 tabular-nums">{money(o.price)}</span>
      <span className="mt-1 min-h-5 text-xs">
        {o.closed ? (
          <span className="font-semibold text-red-700">{t('shop.outOfStock')}</span>
        ) : o.remaining != null && o.remaining <= 5 ? (
          <span className="font-semibold text-amber-700">{t('shop.lowStock', { count: num(o.remaining) })}</span>
        ) : o.sizes?.length ? (
          <span className="text-slate-500">{o.sizes.join(' · ')}</span>
        ) : null}
      </span>
    </button>
  );
}

const METHOD_ICONS: Record<CheckoutMethod, typeof CreditCard> = { balance: Wallet, card: CreditCard, wallet: Smartphone, instapay: Landmark };

function Checkout({ offering: o, studentId, parentId, balance, onClose, onViewOrders }: { offering: OfferingView; studentId: string; parentId: string; balance: number; onClose: () => void; onViewOrders: () => void }) {
  const i18n = useI18n();
  const { t, n, money } = i18n;
  const [size, setSize] = useState<string | undefined>(o.sizes?.length === 1 ? o.sizes[0] : undefined);
  const [qty, setQty] = useState(1);
  const total = o.price * qty;
  const canUseBalance = balance >= total;
  const [method, setMethod] = useState<CheckoutMethod>(canUseBalance ? 'balance' : 'card');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [step, setStep] = useState<'form' | 'processing' | 'success' | 'failure'>('form');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<unknown>(null);
  const maxQty = Math.min(5, o.remaining ?? 5);
  const needsSize = !!o.sizes?.length;
  const effectiveMethod = method === 'balance' && !canUseBalance ? 'card' : method;

  const pay = async () => {
    setStep('processing');
    setError(null);
    try {
      const r = await api.checkout({ offeringId: o.id, studentId, parentId, qty, size, method: effectiveMethod, simulateFailure: effectiveMethod !== 'balance' && simulateFailure });
      setOrder(r);
      setStep('success');
    } catch (e) {
      setError(e);
      setStep('failure');
    }
  };

  const methods: CheckoutMethod[] = ['balance', 'card', 'wallet', 'instapay'];

  return (
    <Modal open onClose={step === 'processing' ? () => {} : onClose} title={o.kind === 'event' ? t('shop.checkoutEvent') : t('shop.checkoutProduct')}>
      {step === 'processing' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
          <Spinner className="size-10 text-brand-700" />
          <p className="font-semibold">{t('topup.processing')}</p>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Lock className="size-3" /> {t('topup.secure')}
          </p>
        </div>
      )}

      {step === 'success' && order && (
        <div className="py-4 text-center animate-pop">
          <CheckCircle2 className="mx-auto size-16 text-emerald-600" aria-hidden="true" />
          <h3 className="mt-3 text-xl font-bold">{o.kind === 'event' ? t('shop.successEvent') : t('shop.successProduct')}</h3>
          <p className="mt-1 text-slate-600">{o.kind === 'event' ? t('shop.successEventBody', { item: n(o) }) : t('shop.successProductBody')}</p>
          <dl className="mt-4 grid grid-cols-2 gap-y-1.5 rounded-xl bg-slate-50 p-3 text-start text-sm">
            <dt className="text-slate-600">{t('shop.paid')}</dt>
            <dd className="text-end font-bold tabular-nums">{money(order.total)}</dd>
            <dt className="text-slate-600">{t('topup.method')}</dt>
            <dd className="text-end">{t(`topup.method.${order.method}`)}</dd>
            <dt className="text-slate-600">{t('topup.reference')}</dt>
            <dd className="ltr-nums text-end font-mono text-xs">{order.id}</dd>
          </dl>
          <div className="mt-4 grid gap-2">
            <Button onClick={onClose}>{t('common.done')}</Button>
            <Button variant="ghost" onClick={onViewOrders}>
              {t('shop.viewOrders')}
            </Button>
          </div>
        </div>
      )}

      {step === 'failure' && (
        <div className="py-4 text-center animate-pop">
          <XCircle className="mx-auto size-16 text-red-600" aria-hidden="true" />
          <h3 className="mt-3 text-xl font-bold">{t('topup.failed')}</h3>
          <p className="mt-1 text-slate-600">{error instanceof ApiError && error.code === 'payment_failed' ? t('topup.failedBody') : errorMessage(error, t)}</p>
          <p className="mt-1 text-sm text-slate-500">{t('topup.notCharged')}</p>
          <div className="mt-4 grid gap-2">
            <Button onClick={() => setStep('form')}>{t('common.retry')}</Button>
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}

      {step === 'form' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <span className="text-3xl" aria-hidden="true">
              {o.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{n(o)}</p>
              <p className="text-sm text-slate-600">
                {money(o.price)}
                {o.eventDate && ` · ${i18n.date(o.eventDate, { weekday: 'short', day: 'numeric', month: 'short' })}`}
              </p>
            </div>
          </div>

          {needsSize && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-slate-800">{t('shop.size')}</legend>
              <div className="flex flex-wrap gap-2">
                {o.sizes!.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    aria-pressed={size === sz}
                    onClick={() => setSize(sz)}
                    className={cx('h-10 min-w-12 rounded-xl px-3 font-semibold ring-1 ring-inset', size === sz ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-800 ring-slate-300 hover:bg-slate-50')}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {o.kind === 'product' && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">{t('shop.quantity')}</span>
              <span className="flex items-center gap-2">
                <button type="button" aria-label={t('pos.decrease')} disabled={qty <= 1} onClick={() => setQty(qty - 1)} className="flex size-9 items-center justify-center rounded-lg bg-slate-100 disabled:opacity-40">
                  <Minus className="size-4" />
                </button>
                <span className="w-6 text-center font-bold tabular-nums">{qty}</span>
                <button type="button" aria-label={t('pos.increase')} disabled={qty >= maxQty} onClick={() => setQty(qty + 1)} className="flex size-9 items-center justify-center rounded-lg bg-slate-100 disabled:opacity-40">
                  <Plus className="size-4" />
                </button>
              </span>
            </div>
          )}

          <div role="radiogroup" aria-label={t('topup.method')} className="space-y-2">
            <p className="text-sm font-medium text-slate-800">{t('topup.method')}</p>
            {methods.map((m) => {
              const Icon = METHOD_ICONS[m];
              const disabled = m === 'balance' && !canUseBalance;
              const selected = effectiveMethod === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => setMethod(m)}
                  className={cx('flex w-full items-center gap-3 rounded-xl p-2.5 text-start ring-1 ring-inset transition disabled:opacity-50', selected ? 'bg-brand-50 ring-2 ring-brand-600' : 'ring-slate-200 hover:bg-slate-50')}
                >
                  <span className={cx('flex size-9 items-center justify-center rounded-lg', selected ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700')}>
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{t(`topup.method.${m}`)}</span>
                    <span className="block text-xs text-slate-600">
                      {m === 'balance' ? (canUseBalance ? t('shop.balanceAvailable', { amount: money(balance) }) : t('shop.balanceTooLow', { amount: money(balance) })) : t(`topup.method.${m}Hint`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {effectiveMethod !== 'balance' && (
            <div className="rounded-xl border border-dashed border-slate-300 p-3">
              <Switch checked={simulateFailure} onChange={setSimulateFailure} tone="danger" label={<span className="text-sm">{t('topup.simulateFailure')}</span>} />
            </div>
          )}

          <Button block size="lg" icon={<Lock className="size-4" />} disabled={needsSize && !size} onClick={pay}>
            {needsSize && !size ? t('shop.pickSize') : t('topup.pay', { amount: money(total) })}
          </Button>
          <p className="text-center text-xs text-slate-500">{t('topup.disclaimer')}</p>
        </div>
      )}
    </Modal>
  );
}

export const ORDER_TONE: Record<OrderStatus, Tone> = { paid: 'brand', fulfilled: 'success', refunded: 'neutral' };

export function orderStatusLabel(t: ReturnType<typeof useI18n>['t'], o: Pick<Order, 'status' | 'kind'>): string {
  if (o.status === 'fulfilled') return o.kind === 'event' ? t('order.status.checkedIn') : t('order.status.collected');
  if (o.status === 'paid') return o.kind === 'event' ? t('order.status.registered') : t('order.status.ready');
  return t('order.status.refunded');
}

function MyOrders({ parentId }: { parentId: string }) {
  const i18n = useI18n();
  const { t, n, money } = i18n;
  const orders = useApi(() => api.listOrders({ parentId }), [parentId]);
  const kids = useApi(() => api.getChildren(parentId), [parentId]);
  if (orders.loading) return <LoadingBlock rows={3} />;
  if (orders.error) return <ErrorState error={orders.error} onRetry={orders.reload} />;
  if (!orders.data!.length) return <EmptyState icon={<ShoppingBag className="size-6" />} title={t('shop.noOrders')} description={t('shop.noOrdersHint')} />;
  return (
    <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
      {orders.data!.map((o) => {
        const kid = kids.data?.find((k) => k.id === o.studentId);
        return (
          <li key={o.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">
                {n(o)}
                {o.size && <span className="text-slate-500"> · {o.size}</span>}
                {o.qty > 1 && <span className="text-slate-500"> ×{o.qty}</span>}
              </p>
              <span className={cx('shrink-0 font-semibold tabular-nums', o.status === 'refunded' && 'text-slate-400 line-through')}>{money(o.total)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Badge tone={ORDER_TONE[o.status]}>{orderStatusLabel(t, o)}</Badge>
              <span>{kid ? n(kid) : ''}</span>
              <span>· {i18n.date(o.createdAt, { day: 'numeric', month: 'short' })}</span>
              <span>· {t(`topup.method.${o.method}`)}</span>
            </div>
            {o.status === 'refunded' && o.refundReason && <p className="mt-1 text-xs text-slate-500">{t('shop.refundedBecause', { reason: o.refundReason })}</p>}
          </li>
        );
      })}
    </ul>
  );
}
