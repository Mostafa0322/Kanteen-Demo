import { useMemo, useState } from 'react';
import { CalendarPlus, CheckCircle2, Download, PackagePlus, Pencil, RotateCcw, ShoppingBag, Ticket, Users } from 'lucide-react';
import { api, dayKey, type Offering, type OfferingAdminView, type OfferingKind, type Order, type OrderStatus } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { cx } from '@/lib/cx';
import { downloadFile, toCsv } from '@/lib/csv';
import { Badge, type Tone } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip, Field, Input, Segmented, Select, Switch, Textarea } from '@/ui/Form';
import { PageTitle, ProgressBar, Stat } from '@/ui/Misc';
import { Modal } from '@/ui/Modal';
import { EmptyState, ErrorState, LoadingBlock, errorMessage } from '@/ui/States';
import { useToast } from '@/ui/Toast';
import { ORDER_TONE, gradesLabel, orderStatusLabel } from '@/apps/parent/ShopScreen';

type Tab = 'events' | 'store' | 'orders';
type Draft = Omit<Offering, 'id' | 'createdAt'> & { id?: string };

const EVENT_CATEGORIES = ['trip', 'event', 'activity'] as const;
const PRODUCT_CATEGORIES = ['uniform', 'books', 'supplies'] as const;

function blankDraft(schoolId: string, kind: OfferingKind): Draft {
  const inTwoWeeks = new Date(Date.now() + 14 * 86_400_000);
  const inTenDays = new Date(Date.now() + 10 * 86_400_000);
  return {
    schoolId,
    kind,
    category: kind === 'event' ? 'trip' : 'uniform',
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    price: kind === 'event' ? 200 : 150,
    emoji: kind === 'event' ? '🎟️' : '👕',
    active: true,
    grades: [],
    ...(kind === 'event'
      ? { eventDate: atTime(dayKey(inTwoWeeks), '09:00'), deadline: atTime(dayKey(inTenDays), '23:59'), capacity: 50 }
      : { sizes: [], stock: 50 }),
  };
}

const atTime = (day: string, time: string) => new Date(`${day}T${time}`).toISOString();

export function ShopAdmin({ schoolId }: { schoolId: string }) {
  const i18n = useI18n();
  const { t, n, money, num } = i18n;
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('events');
  const [editing, setEditing] = useState<Draft | null>(null);
  const [orderFilter, setOrderFilter] = useState<{ offeringId: string; status: OrderStatus | 'all' }>({ offeringId: '', status: 'all' });
  const [refunding, setRefunding] = useState<Order | null>(null);
  const offerings = useApi(() => api.listOfferings(schoolId), [schoolId]);
  const orders = useApi(() => api.listOrders({ schoolId }), [schoolId]);
  const students = useApi(() => api.listStudents(schoolId), [schoolId]);

  const events = offerings.data?.filter((o) => o.kind === 'event') ?? [];
  const products = offerings.data?.filter((o) => o.kind === 'product') ?? [];

  const stats = useMemo(() => {
    const live = (orders.data ?? []).filter((o) => o.status !== 'refunded');
    return {
      revenue: live.reduce((a, o) => a + o.total, 0),
      registrations: live.filter((o) => o.kind === 'event').length,
      awaiting: live.filter((o) => o.kind === 'product' && o.status === 'paid').length,
      openEvents: events.filter((e) => e.active && !e.closed).length,
      lowStock: products.filter((p) => p.remaining != null && p.remaining <= 5).length,
    };
  }, [orders.data, events, products]);

  const studentName = (id: string) => {
    const s = students.data?.find((x) => x.id === id);
    return s ? n(s) : id;
  };

  const filteredOrders = (orders.data ?? []).filter((o) => (!orderFilter.offeringId || o.offeringId === orderFilter.offeringId) && (orderFilter.status === 'all' || o.status === orderFilter.status));

  const toggleActive = async (o: OfferingAdminView) => {
    await api.upsertOffering({ ...toDraft(o), active: !o.active });
    toast({ tone: 'success', title: t(o.active ? 'shopAdmin.hiddenToast' : 'shopAdmin.publishedToast', { item: n(o) }) });
  };

  const fulfill = async (o: Order) => {
    await api.fulfillOrder(o.id);
    toast({ tone: 'success', title: t(o.kind === 'event' ? 'shopAdmin.checkedInToast' : 'shopAdmin.collectedToast', { name: studentName(o.studentId) }) });
  };

  const showOrdersFor = (offeringId: string) => {
    setOrderFilter({ offeringId, status: 'all' });
    setTab('orders');
  };

  const exportCsv = () => {
    const rows = filteredOrders.map((o) => [o.id, o.createdAt, o.kind, o.name, studentName(o.studentId), o.size ?? '', o.qty, o.unitPrice, o.total, i18n.currency, o.method, o.status, o.refundReason ?? '']);
    downloadFile(`kanteen-shop-orders_${schoolId}_${dayKey()}.csv`, toCsv([['id', 'timestamp', 'kind', 'item', 'student', 'size', 'qty', 'unit_price', 'total', 'currency', 'method', 'status', 'refund_reason'], ...rows]));
  };

  const statusBadge = (o: OfferingAdminView): { tone: Tone; label: string } => {
    if (!o.active) return { tone: 'neutral', label: t('shopAdmin.status.hidden') };
    if (o.kind === 'product') return o.closed ? { tone: 'danger', label: t('shop.outOfStock') } : { tone: 'success', label: t('shopAdmin.status.onSale') };
    if (o.eventDate && o.eventDate < new Date().toISOString()) return { tone: 'neutral', label: t('shopAdmin.status.past') };
    if (o.remaining === 0) return { tone: 'danger', label: t('shop.full') };
    if (o.closed) return { tone: 'warning', label: t('shop.closed') };
    return { tone: 'success', label: t('shopAdmin.status.open') };
  };

  if (offerings.error) return <ErrorState error={offerings.error} onRetry={offerings.reload} />;

  return (
    <>
      <PageTitle
        title={t('shopAdmin.title')}
        subtitle={t('shopAdmin.subtitle')}
        actions={
          <>
            <Button variant="secondary" icon={<PackagePlus className="size-4" />} onClick={() => setEditing(blankDraft(schoolId, 'product'))}>
              {t('shopAdmin.newProduct')}
            </Button>
            <Button icon={<CalendarPlus className="size-4" />} onClick={() => setEditing(blankDraft(schoolId, 'event'))}>
              {t('shopAdmin.newEvent')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t('shopAdmin.stat.revenue')} value={money(stats.revenue)} icon={<ShoppingBag className="size-4" />} tone="brand" hint={t('shopAdmin.stat.revenueHint')} />
        <Stat label={t('shopAdmin.stat.openEvents')} value={num(stats.openEvents)} icon={<Ticket className="size-4" />} hint={t('shopAdmin.stat.registrations', { count: num(stats.registrations) })} />
        <Stat label={t('shopAdmin.stat.awaiting')} value={num(stats.awaiting)} icon={<PackagePlus className="size-4" />} tone={stats.awaiting ? 'warning' : 'neutral'} hint={t('shopAdmin.stat.awaitingHint')} />
        <Stat label={t('shopAdmin.stat.lowStock')} value={num(stats.lowStock)} icon={<ShoppingBag className="size-4" />} tone={stats.lowStock ? 'danger' : 'neutral'} hint={t('shopAdmin.stat.lowStockHint')} />
      </div>

      <Segmented
        className="mt-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'events', label: `${t('shop.tab.events')} (${events.length})` },
          { value: 'store', label: `${t('shop.tab.store')} (${products.length})` },
          { value: 'orders', label: `${t('shopAdmin.tab.orders')} (${orders.data?.length ?? 0})` },
        ]}
      />

      <Card className="mt-4">
        {offerings.loading ? (
          <LoadingBlock className="p-4" rows={5} />
        ) : tab === 'events' ? (
          events.length === 0 ? (
            <EmptyState className="m-4" title={t('shop.noEvents')} action={<Button onClick={() => setEditing(blankDraft(schoolId, 'event'))}>{t('shopAdmin.newEvent')}</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-50 text-xs tracking-wide text-slate-600 uppercase">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('shopAdmin.col.event')}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('shopAdmin.col.date')}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('shopAdmin.col.registrations')}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t('shopAdmin.col.revenue')}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('tx.status')}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('shopAdmin.col.visible')}</th>
                    <th className="px-4 py-2.5">
                      <span className="sr-only">{t('students.col.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((o) => {
                    const st = statusBadge(o);
                    return (
                      <tr key={o.id} className={cx('align-top', !o.active && 'bg-slate-50/70')}>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl" aria-hidden="true">
                              {o.emoji}
                            </span>
                            <div>
                              <p className="font-semibold">{n(o)}</p>
                              <p className="text-xs text-slate-500">
                                {t(`shopCategory.${o.category}`)} · {gradesLabel(t, o.grades)} · {money(o.price)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p>{o.eventDate ? i18n.date(o.eventDate, { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</p>
                          <p className="text-xs text-slate-500">{o.deadline ? t('shop.registerBy', { date: i18n.date(o.deadline, { day: 'numeric', month: 'short' }) }) : ''}</p>
                        </td>
                        <td className="w-48 px-4 py-3">
                          <p className="tabular-nums">{o.capacity != null ? `${num(o.sold)} / ${num(o.capacity)}` : num(o.sold)}</p>
                          {o.capacity != null && <ProgressBar className="mt-1 !h-1.5" value={o.sold} max={o.capacity} label={t('shopAdmin.col.registrations')} />}
                        </td>
                        <td className="px-4 py-3 text-end font-semibold tabular-nums">{money(o.revenue)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Switch checked={o.active} onChange={() => toggleActive(o)} label={<span className="sr-only">{t('shopAdmin.col.visible')}</span>} />
                        </td>
                        <td className="px-4 py-3 text-end whitespace-nowrap">
                          <Button size="sm" variant="ghost" icon={<Users className="size-3.5" />} onClick={() => showOrdersFor(o.id)}>
                            {t('shopAdmin.attendees')}
                          </Button>
                          <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(toDraft(o))}>
                            {t('common.edit')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'store' ? (
          products.length === 0 ? (
            <EmptyState className="m-4" title={t('shop.noProducts')} action={<Button onClick={() => setEditing(blankDraft(schoolId, 'product'))}>{t('shopAdmin.newProduct')}</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-slate-50 text-xs tracking-wide text-slate-600 uppercase">
                  <tr>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('shopAdmin.col.product')}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('shop.size')}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t('shopAdmin.col.sold')}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t('shopAdmin.col.stockLeft')}</th>
                    <th className="px-4 py-2.5 text-end font-semibold">{t('shopAdmin.col.revenue')}</th>
                    <th className="px-4 py-2.5 text-start font-semibold">{t('shopAdmin.col.visible')}</th>
                    <th className="px-4 py-2.5">
                      <span className="sr-only">{t('students.col.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((o) => (
                    <tr key={o.id} className={cx(!o.active && 'bg-slate-50/70')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl" aria-hidden="true">
                            {o.emoji}
                          </span>
                          <div>
                            <p className="font-semibold">{n(o)}</p>
                            <p className="text-xs text-slate-500">
                              {t(`shopCategory.${o.category}`)} · {money(o.price)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{o.sizes?.length ? o.sizes.join(' · ') : '—'}</td>
                      <td className="px-4 py-3 text-end tabular-nums">{num(o.sold)}</td>
                      <td className={cx('px-4 py-3 text-end font-semibold tabular-nums', o.remaining != null && o.remaining <= 5 && 'text-red-700')}>{o.remaining == null ? '∞' : num(o.remaining)}</td>
                      <td className="px-4 py-3 text-end font-semibold tabular-nums">{money(o.revenue)}</td>
                      <td className="px-4 py-3">
                        <Switch checked={o.active} onChange={() => toggleActive(o)} label={<span className="sr-only">{t('shopAdmin.col.visible')}</span>} />
                      </td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <Button size="sm" variant="ghost" icon={<ShoppingBag className="size-3.5" />} onClick={() => showOrdersFor(o.id)}>
                          {t('shopAdmin.tab.orders')}
                        </Button>
                        <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(toDraft(o))}>
                          {t('common.edit')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4">
              <Field className="min-w-64" label={t('shopAdmin.filterItem')}>
                {(id) => (
                  <Select id={id} value={orderFilter.offeringId} onChange={(e) => setOrderFilter({ ...orderFilter, offeringId: e.target.value })}>
                    <option value="">{t('shopAdmin.allItems')}</option>
                    {offerings.data?.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.emoji} {n(o)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('tx.status')}>
                {(id) => (
                  <Select id={id} value={orderFilter.status} onChange={(e) => setOrderFilter({ ...orderFilter, status: e.target.value as OrderStatus | 'all' })}>
                    <option value="all">{t('tx.allStatuses')}</option>
                    <option value="paid">{t('order.status.paid')}</option>
                    <option value="fulfilled">{t('order.status.fulfilled')}</option>
                    <option value="refunded">{t('order.status.refunded')}</option>
                  </Select>
                )}
              </Field>
              <Button className="ms-auto" variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv} disabled={!filteredOrders.length}>
                {t('tx.export')}
              </Button>
            </div>
            {orders.loading ? (
              <LoadingBlock className="p-4" rows={5} />
            ) : filteredOrders.length === 0 ? (
              <EmptyState className="m-4" title={t('shopAdmin.noOrders')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50 text-xs tracking-wide text-slate-600 uppercase">
                    <tr>
                      <th className="px-4 py-2.5 text-start font-semibold">{t('tx.col.time')}</th>
                      <th className="px-4 py-2.5 text-start font-semibold">{t('tx.col.student')}</th>
                      <th className="px-4 py-2.5 text-start font-semibold">{t('shopAdmin.col.item')}</th>
                      <th className="px-4 py-2.5 text-start font-semibold">{t('topup.method')}</th>
                      <th className="px-4 py-2.5 text-end font-semibold">{t('tx.col.amount')}</th>
                      <th className="px-4 py-2.5 text-start font-semibold">{t('tx.status')}</th>
                      <th className="px-4 py-2.5">
                        <span className="sr-only">{t('students.col.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{i18n.dateTime(o.createdAt)}</td>
                        <td className="px-4 py-2.5 font-medium">{studentName(o.studentId)}</td>
                        <td className="px-4 py-2.5">
                          {n(o)}
                          {o.size && <span className="text-slate-500"> · {o.size}</span>}
                          {o.qty > 1 && <span className="text-slate-500"> ×{o.qty}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{t(`topup.method.${o.method}`)}</td>
                        <td className={cx('px-4 py-2.5 text-end font-semibold tabular-nums', o.status === 'refunded' && 'text-slate-400 line-through')}>{money(o.total)}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone={ORDER_TONE[o.status]}>{orderStatusLabel(t, o)}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-end whitespace-nowrap">
                          {o.status === 'paid' && (
                            <Button size="sm" variant="outline" icon={<CheckCircle2 className="size-3.5" />} onClick={() => fulfill(o)}>
                              {o.kind === 'event' ? t('shopAdmin.checkIn') : t('shopAdmin.markCollected')}
                            </Button>
                          )}
                          {o.status !== 'refunded' && (
                            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => setRefunding(o)}>
                              {t('refunds.submitIdle')}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      {editing && <OfferingEditor draft={editing} onClose={() => setEditing(null)} />}
      {refunding && <RefundOrder order={refunding} studentName={studentName(refunding.studentId)} onClose={() => setRefunding(null)} />}
    </>
  );
}

function toDraft(o: OfferingAdminView): Draft {
  const { sold: _s, remaining: _r, closed: _c, revenue: _v, orderCount: _n, createdAt: _d, ...rest } = o;
  return { ...rest, grades: [...rest.grades], sizes: rest.sizes ? [...rest.sizes] : rest.sizes };
}

function OfferingEditor({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [d, setD] = useState<Draft>(draft);
  const [sizesText, setSizesText] = useState((draft.sizes ?? []).join(', '));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const isEvent = d.kind === 'event';
  const eventDay = d.eventDate ? dayKey(d.eventDate) : '';
  const deadlineDay = d.deadline ? dayKey(d.deadline) : '';
  const datesInvalid = isEvent && (!eventDay || !deadlineDay || deadlineDay > eventDay);
  const valid = d.name.trim() && d.nameAr.trim() && d.price > 0 && !datesInvalid;

  const save = async () => {
    setPending(true);
    setError(null);
    try {
      const sizes = sizesText
        .split(/[,،]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const saved = await api.upsertOffering({ ...d, sizes: isEvent ? undefined : sizes });
      toast({ tone: 'success', title: t(isEvent && saved.active && (!draft.id || !draft.active) ? 'shopAdmin.publishedNotified' : 'shopAdmin.saved') });
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };

  const categories = isEvent ? EVENT_CATEGORIES : PRODUCT_CATEGORIES;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={d.id ? (isEvent ? t('shopAdmin.editEvent') : t('shopAdmin.editProduct')) : isEvent ? t('shopAdmin.newEvent') : t('shopAdmin.newProduct')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={pending} disabled={!valid} onClick={save}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t('menuMgmt.nameEn')}>{(id) => <Input id={id} dir="ltr" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />}</Field>
        <Field label={t('menuMgmt.nameAr')}>{(id) => <Input id={id} dir="rtl" value={d.nameAr} onChange={(e) => setD({ ...d, nameAr: e.target.value })} />}</Field>
        <Field label={t('shopAdmin.descEn')}>{(id) => <Textarea id={id} dir="ltr" rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />}</Field>
        <Field label={t('shopAdmin.descAr')}>{(id) => <Textarea id={id} dir="rtl" rows={2} value={d.descriptionAr} onChange={(e) => setD({ ...d, descriptionAr: e.target.value })} />}</Field>
        <Field label={t('menuMgmt.price')} error={d.price > 0 ? undefined : t('menuMgmt.priceInvalid')}>
          {(id) => <Input id={id} type="number" min={1} value={d.price} onChange={(e) => setD({ ...d, price: Number(e.target.value) })} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('menuMgmt.emoji')}>{(id) => <Input id={id} value={d.emoji} maxLength={4} onChange={(e) => setD({ ...d, emoji: e.target.value })} />}</Field>
          <Field label={t('menuMgmt.category')}>
            {(id) => (
              <Select id={id} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as Draft['category'] })}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {t(`shopCategory.${c}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {isEvent ? (
          <>
            <Field label={t('shopAdmin.eventDate')}>
              {(id) => <Input id={id} type="date" value={eventDay} onChange={(e) => e.target.value && setD({ ...d, eventDate: atTime(e.target.value, '09:00') })} />}
            </Field>
            <Field label={t('shopAdmin.deadline')} error={datesInvalid ? t('error.deadline_after_event') : undefined}>
              {(id) => <Input id={id} type="date" value={deadlineDay} max={eventDay} onChange={(e) => e.target.value && setD({ ...d, deadline: atTime(e.target.value, '23:59') })} />}
            </Field>
            <Field label={t('shopAdmin.capacity')} hint={t('shopAdmin.unlimitedHint')}>
              {(id) => <Input id={id} type="number" min={1} value={d.capacity ?? ''} onChange={(e) => setD({ ...d, capacity: e.target.value ? Number(e.target.value) : null })} />}
            </Field>
          </>
        ) : (
          <>
            <Field label={t('shopAdmin.sizes')} hint={t('shopAdmin.sizesHint')}>
              {(id) => <Input id={id} dir="ltr" placeholder="S, M, L" value={sizesText} onChange={(e) => setSizesText(e.target.value)} />}
            </Field>
            <Field label={t('shopAdmin.stock')} hint={t('shopAdmin.unlimitedHint')}>
              {(id) => <Input id={id} type="number" min={0} value={d.stock ?? ''} onChange={(e) => setD({ ...d, stock: e.target.value ? Number(e.target.value) : null })} />}
            </Field>
          </>
        )}

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-slate-800">{t('shopAdmin.grades')}</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip selected={d.grades.length === 0} onClick={() => setD({ ...d, grades: [] })}>
              {t('shop.allGrades')}
            </Chip>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
              <Chip key={g} selected={d.grades.includes(g)} onClick={() => setD({ ...d, grades: d.grades.includes(g) ? d.grades.filter((x) => x !== g) : [...d.grades, g].sort((a, b) => a - b) })}>
                {g}
              </Chip>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2">
          <Switch checked={d.active} onChange={(v) => setD({ ...d, active: v })} label={t('shopAdmin.visible')} description={isEvent ? t('shopAdmin.visibleEventHint') : t('shopAdmin.visibleHint')} />
        </div>
        {error != null && (
          <p role="alert" className="text-sm text-red-700 sm:col-span-2">
            {errorMessage(error, t)}
          </p>
        )}
      </div>
    </Modal>
  );
}

function RefundOrder({ order: o, studentName, onClose }: { order: Order; studentName: string; onClose: () => void }) {
  const { t, n, money } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await api.refundOrder(o.id, reason);
      toast({ tone: 'success', title: t('refunds.done', { amount: money(o.total), name: studentName }) });
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={t('shopAdmin.refundTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" loading={pending} disabled={!reason.trim()} onClick={submit} icon={<RotateCcw className="size-4" />}>
            {t('refunds.submit', { amount: money(o.total) })}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          <span className="font-semibold">{n(o)}</span> · {studentName}
        </p>
        <p className="rounded-lg bg-slate-50 p-3 text-slate-700">{o.method === 'balance' ? t('shopAdmin.refundToWallet') : t('shopAdmin.refundToMethod', { method: t(`topup.method.${o.method}`) })}</p>
        <Field label={t('refunds.reason')} error={error ? errorMessage(error, t) : undefined}>
          {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('shopAdmin.refundReasonPh')} />}
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {SHOP_REFUND_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(t(r))} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
              {t(r)}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

const SHOP_REFUND_REASONS = ['shopAdmin.reason.cancelled', 'shopAdmin.reason.wrongSize', 'shopAdmin.reason.sick', 'shopAdmin.reason.duplicate'] as const;

