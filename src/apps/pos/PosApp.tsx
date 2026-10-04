import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CloudOff, Minus, Nfc, Plus, RefreshCw, Shuffle, ShoppingBasket, Trash2, Wifi, WifiOff } from 'lucide-react';
import { CATEGORIES, DEMO_VENDOR_ID, api, type CartLine, type Category, type ChargeResult, type LocalizedName, type MenuItem, type TxLine } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { cx } from '@/lib/cx';
import { Button } from '@/ui/Button';
import { Select } from '@/ui/Form';
import { LangToggle } from '@/ui/Misc';
import { Modal } from '@/ui/Modal';
import { EmptyState, ErrorState, LoadingBlock, Spinner, errorMessage } from '@/ui/States';
import { ALLERGEN_EMOJI, CATEGORY_EMOJI } from '@/components/domain';
import { Logo } from '@/components/Logo';
import { ResultOverlay, type Display } from './ResultOverlay';
import { chargeOffline, offlineStore, syncQueue, type PosSnapshot, type QueuedCharge, type SyncReport } from './offline';

const VENDOR_KEY = 'kanteen.pos.vendor';

export default function PosApp() {
  const i18n = useI18n();
  const { t, n, money } = i18n;
  const [vendorId, setVendorId] = useState<string>(() => localStorage.getItem(VENDOR_KEY) ?? DEMO_VENDOR_ID);
  const vendors = useApi(() => api.listVendors(), [], { live: false });
  const vendor = vendors.data?.find((v) => v.id === vendorId);
  const schoolId = vendor?.schoolId ?? 'sch_nile';
  const schools = useApi(() => api.listSchools(), [], { live: false });

  const [offline, setOfflineState] = useState(offlineStore.isOffline);
  const [queue, setQueueState] = useState<QueuedCharge[]>(offlineStore.queue);
  const snapshotRef = useRef<PosSnapshot | null>(offlineStore.snapshot());

  // While offline the terminal must not see live data: freeze reads.
  const liveMenu = useApi(() => api.listMenu(), [], { enabled: !offline });
  const liveBracelets = useApi(() => api.listBracelets(schoolId), [schoolId], { enabled: !offline });
  const menu: MenuItem[] | undefined = offline ? snapshotRef.current?.menu : liveMenu.data;
  const bracelets = useMemo(() => {
    if (!offline) return liveBracelets.data;
    const snap = snapshotRef.current;
    return snap?.bracelets
      .filter((b) => b.studentId)
      .map((b) => {
        const s = snap.students.find((x) => x.id === b.studentId);
        return { ...b, student: s ? { id: s.id, name: s.name, nameAr: s.nameAr, grade: s.grade } : null };
      });
  }, [offline, liveBracelets.data]);

  const [cat, setCat] = useState<Category | 'all'>('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [braceletId, setBraceletId] = useState('');
  const [charging, setCharging] = useState(false);
  const [display, setDisplay] = useState<Display | null>(null);
  const [syncing, setSyncing] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [chargeError, setChargeError] = useState<unknown>(null);
  const shownTx = useRef(new Set<string>());
  // True while this terminal's own charge is in flight, so its echo isn't shown as a remote event.
  const ownCharge = useRef(false);

  useEffect(() => {
    localStorage.setItem(VENDOR_KEY, vendorId);
  }, [vendorId]);

  // Default the reader to the demo child's bracelet.
  useEffect(() => {
    if (!braceletId && bracelets?.length) setBraceletId(bracelets.find((b) => b.student?.id === 'stu_omar')?.id ?? bracelets[0].id);
  }, [bracelets, braceletId]);

  // Keep a fresh snapshot while online so we can go offline at any moment.
  useEffect(() => {
    if (offline) return;
    let alive = true;
    const refresh = () => api.getPosSnapshot(schoolId).then((s) => alive && ((snapshotRef.current = s), offlineStore.setSnapshot(s)));
    void refresh();
    const unsub = api.subscribe((e) => e.type === 'db-changed' && void refresh());
    return () => {
      alive = false;
      unsub();
    };
  }, [offline, schoolId]);

  // Show charges made elsewhere (e.g. the Demo panel) on this terminal's customer display.
  useEffect(() => {
    if (offline) return;
    return api.subscribe(async (e) => {
      if (e.type !== 'pos-display' || e.vendorId !== vendorId || ownCharge.current || shownTx.current.has(e.txId)) return;
      shownTx.current.add(e.txId);
      const [tx] = await api.listTransactions({ vendorId, limit: 20 }).then((l) => l.filter((x) => x.id === e.txId));
      if (!tx) return;
      const s = await api.getStudent(tx.studentId);
      setDisplay({
        key: tx.id,
        outcome: tx.status === 'approved' ? 'approved' : tx.status === 'blocked' ? 'blocked' : 'declined',
        reason: tx.reason,
        reasonDetail: tx.reasonDetail,
        total: tx.amount,
        student: s,
        braceletId: tx.braceletId ?? '',
        balance: s.balance,
        spentToday: s.spentToday,
        dailyLimit: s.dailyLimit,
        lines: tx.lines ?? [],
        offline: false,
        remote: true,
      });
    });
  }, [offline, vendorId]);

  const setOffline = (v: boolean) => {
    setOfflineState(v);
    offlineStore.setOffline(v);
  };
  const setQueue = (q: QueuedCharge[]) => {
    setQueueState(q);
    offlineStore.setQueue(q);
  };

  const add = (m: MenuItem) => {
    if (!m.available) return;
    setCart((c) => (c.some((l) => l.itemId === m.id) ? c.map((l) => (l.itemId === m.id ? { ...l, qty: l.qty + 1 } : l)) : [...c, { itemId: m.id, qty: 1 }]));
  };
  const changeQty = (id: string, d: number) => setCart((c) => c.map((l) => (l.itemId === id ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0));

  const cartLines: TxLine[] = cart.map((l) => {
    const m = menu?.find((x) => x.id === l.itemId);
    return { itemId: l.itemId, name: m?.name ?? '?', nameAr: m?.nameAr ?? '?', price: m?.price ?? 0, qty: l.qty };
  });
  const total = cartLines.reduce((a, l) => a + l.price * l.qty, 0);

  const showResult = useCallback((res: ChargeResult, lines: TxLine[], bId: string, isOffline: boolean) => {
    if (res.transaction) shownTx.current.add(res.transaction.id);
    const s = res.student;
    const student: LocalizedName | null = s ? { name: s.name, nameAr: s.nameAr } : null;
    setDisplay({
      key: res.transaction?.id ?? `local_${Date.now()}`,
      outcome: res.outcome,
      reason: res.reason,
      reasonDetail: res.reasonDetail,
      total: res.total,
      student,
      braceletId: bId,
      balance: res.balanceAfter ?? s?.balance ?? 0,
      spentToday: res.spentToday ?? 0,
      dailyLimit: s?.dailyLimit ?? null,
      lines,
      offline: isOffline,
      remote: false,
    });
    if (res.outcome === 'approved') setCart([]);
  }, []);

  const tap = async () => {
    if (!cart.length || !braceletId || charging) return;
    setChargeError(null);
    const req = { braceletId, vendorId, lines: cart };
    const lines = cartLines;
    setCharging(true);
    ownCharge.current = true;
    try {
      if (offline) {
        const snap = snapshotRef.current;
        if (!snap) throw new Error(t('pos.noSnapshot'));
        await new Promise((r) => setTimeout(r, 350));
        const { result, queued } = chargeOffline(snap, req);
        offlineStore.setSnapshot(snap);
        if (queued) setQueue([...queue, queued]);
        showResult(result, lines, braceletId, true);
      } else {
        showResult(await api.charge(req), lines, braceletId, false);
      }
    } catch (e) {
      setChargeError(e);
    } finally {
      ownCharge.current = false;
      setCharging(false);
    }
  };

  const goOnline = async () => {
    setOffline(false);
    if (!queue.length) return;
    setSyncing({ done: 0, total: queue.length });
    try {
      const r = await syncQueue(queue, (done) => setSyncing({ done, total: queue.length }));
      setQueue([]);
      setReport(r);
    } finally {
      setSyncing(null);
    }
  };

  const randomBracelet = () => {
    const active = bracelets?.filter((b) => b.status === 'active') ?? [];
    if (active.length) setBraceletId(active[Math.floor(Math.random() * active.length)].id);
  };

  const visible = (menu ?? []).filter((m) => cat === 'all' || m.category === cat);
  const selected = bracelets?.find((b) => b.id === braceletId);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-100 lg:h-[calc(100dvh-32px)] lg:flex-none">
      {/* Terminal header */}
      <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-2.5 text-white">
        <div className="flex items-center gap-3">
          <Link to="/" aria-label={t('common.back')} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Link>
          <Logo inverted small />
          <span className="hidden text-sm text-slate-400 sm:inline">{t('pos.title')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="vendor">
            {t('pos.vendor')}
          </label>
          <select
            id="vendor"
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              setBraceletId('');
              setCart([]);
            }}
            disabled={offline}
            className="h-9 rounded-lg border-0 bg-slate-800 px-2 text-sm text-white ring-1 ring-slate-700 disabled:opacity-60"
          >
            {schools.data?.map((s) => (
              <optgroup key={s.id} label={n(s)}>
                {vendors.data
                  ?.filter((v) => v.schoolId === s.id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {s.shortCode} · {n(v)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            role="switch"
            aria-checked={!offline}
            onClick={() => (offline ? goOnline() : setOffline(true))}
            disabled={!!syncing}
            className={cx(
              'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold ring-1',
              offline ? 'bg-amber-400 text-amber-950 ring-amber-300' : 'bg-emerald-600/20 text-emerald-300 ring-emerald-500/40',
            )}
          >
            {syncing ? <Spinner className="size-4" /> : offline ? <WifiOff className="size-4" /> : <Wifi className="size-4" />}
            {syncing ? t('pos.syncing', { done: syncing.done, total: syncing.total }) : offline ? t('pos.offline') : t('pos.online')}
          </button>
          <LangToggle compact className="!h-9 !text-white !ring-slate-700 hover:!bg-slate-800" />
        </div>
      </header>
      {offline && (
        <div role="status" className="flex flex-wrap items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-sm text-amber-950">
          <CloudOff className="size-4" />
          <span className="font-semibold">{t('pos.offlineBanner')}</span>
          <span>{t('pos.queued', { count: queue.length, amount: money(queue.reduce((a, q) => a + q.total, 0)) })}</span>
          <button type="button" onClick={goOnline} className="ms-2 inline-flex items-center gap-1 rounded-md bg-amber-950 px-2 py-0.5 text-xs font-semibold text-amber-50">
            <RefreshCw className="size-3" /> {t('pos.reconnect')}
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Menu */}
        <section aria-label={t('pos.menu')} className="flex min-h-0 flex-1 flex-col">
          <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2.5">
            {(['all', ...CATEGORIES] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cat === c}
                onClick={() => setCat(c)}
                className={cx('h-10 rounded-xl px-4 text-sm font-semibold whitespace-nowrap', cat === c ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
              >
                {c === 'all' ? t('menu.all') : `${CATEGORY_EMOJI[c]} ${t(`category.${c}`)}`}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
            {!menu && !liveMenu.error ? (
              <LoadingBlock rows={4} />
            ) : liveMenu.error ? (
              <ErrorState error={liveMenu.error} onRetry={liveMenu.reload} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {visible.map((m) => {
                  const inCart = cart.find((l) => l.itemId === m.id)?.qty ?? 0;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => add(m)}
                      disabled={!m.available}
                      aria-label={`${n(m)}, ${money(m.price)}${m.available ? '' : `, ${t('menu.unavailable')}`}`}
                      className={cx(
                        'relative flex flex-col rounded-2xl border bg-white p-3 text-start shadow-sm transition active:scale-[0.98]',
                        inCart ? 'border-brand-500 ring-2 ring-brand-500' : 'border-slate-200 hover:border-slate-300',
                        !m.available && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      {inCart > 0 && <span className="absolute end-2 top-2 flex size-6 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{inCart}</span>}
                      <span className="text-4xl" aria-hidden="true">
                        {m.emoji}
                      </span>
                      <span className="mt-2 line-clamp-2 text-sm leading-snug font-semibold text-slate-900">{n(m)}</span>
                      <span className="mt-auto pt-1 text-base font-bold text-brand-800 tabular-nums">{money(m.price)}</span>
                      <span className="mt-1 flex min-h-5 flex-wrap gap-1">
                        {m.available ? (
                          m.allergens.map((a) => (
                            <span key={a} title={t(`allergen.${a}`)} className="rounded bg-slate-100 px-1 text-[11px] text-slate-700">
                              {ALLERGEN_EMOJI[a]} {t(`allergen.${a}`)}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs font-semibold text-slate-600">{t('menu.unavailable')}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Cart + reader */}
        <aside aria-label={t('pos.cart')} className="relative flex w-full shrink-0 flex-col border-s border-slate-200 bg-white lg:w-[380px]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShoppingBasket className="size-5 text-brand-700" /> {t('pos.cart')}
            </h2>
            {cart.length > 0 && (
              <button type="button" onClick={() => setCart([])} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-red-700">
                <Trash2 className="size-4" /> {t('pos.clear')}
              </button>
            )}
          </div>
          <div className="min-h-[120px] flex-1 overflow-y-auto px-4 py-2">
            {cart.length === 0 ? (
              <EmptyState className="mt-4 border-none" icon={<ShoppingBasket className="size-6" />} title={t('pos.emptyCart')} description={t('pos.emptyCartHint')} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {cartLines.map((l) => (
                  <li key={l.itemId} className="flex items-center gap-2 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{n(l)}</span>
                      <span className="block text-xs text-slate-500 tabular-nums">{money(l.price)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <button type="button" aria-label={t('pos.decrease')} onClick={() => changeQty(l.itemId, -1)} className="flex size-8 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200">
                        <Minus className="size-4" />
                      </button>
                      <span className="w-6 text-center font-semibold tabular-nums">{l.qty}</span>
                      <button type="button" aria-label={t('pos.increase')} onClick={() => changeQty(l.itemId, 1)} className="flex size-8 items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200">
                        <Plus className="size-4" />
                      </button>
                    </span>
                    <span className="w-20 text-end text-sm font-semibold tabular-nums">{money(l.price * l.qty)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-slate-600">{t('pos.total')}</span>
              <span className="text-3xl font-bold tabular-nums">{money(total)}</span>
            </div>
            <div>
              <label htmlFor="bracelet" className="mb-1 block text-sm font-medium text-slate-700">
                {t('pos.bracelet')}
              </label>
              <div className="flex gap-2">
                <Select id="bracelet" value={braceletId} onChange={(e) => setBraceletId(e.target.value)} className="font-mono text-sm">
                  {bracelets?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} — {b.student ? n(b.student) : '?'}
                      {b.status !== 'active' ? ` (${t('pos.deactivated')})` : ''}
                    </option>
                  ))}
                </Select>
                <Button variant="secondary" onClick={randomBracelet} aria-label={t('pos.randomStudent')} title={t('pos.randomStudent')} className="!px-3">
                  <Shuffle className="size-4" />
                </Button>
              </div>
              {selected?.student && (
                <p className="mt-1 text-xs text-slate-600">
                  {n(selected.student)} · {t('common.grade', { grade: selected.student.grade })}
                </p>
              )}
            </div>
            {chargeError != null && (
              <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-800">
                {errorMessage(chargeError, t)}
              </p>
            )}
            <button
              type="button"
              onClick={tap}
              disabled={!cart.length || !braceletId || charging}
              className="relative flex h-20 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-brand-700 text-xl font-bold text-white shadow-lg transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
            >
              {charging ? (
                <>
                  <Spinner className="size-6" /> {t('pos.reading')}
                </>
              ) : (
                <>
                  <span className="relative flex size-10 items-center justify-center">
                    {cart.length > 0 && <span className="absolute inset-0 rounded-full bg-white/40 animate-tap" aria-hidden="true" />}
                    <Nfc className="size-8" />
                  </span>
                  {t('pos.tap')}
                </>
              )}
            </button>
          </div>
          {display && <ResultOverlay display={display} onClose={() => setDisplay(null)} />}
        </aside>
      </div>

      <Modal
        open={!!report}
        onClose={() => setReport(null)}
        title={t('pos.syncDone')}
        footer={<Button onClick={() => setReport(null)}>{t('common.ok')}</Button>}
      >
        {report && (
          <div className="space-y-3">
            <p className="text-slate-700">{t('pos.syncSummary', { synced: report.synced, conflicts: report.conflicts.length })}</p>
            {report.conflicts.length > 0 && (
              <ul className="space-y-2">
                {report.conflicts.map((c) => (
                  <li key={c.item.id} className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                    <span className="font-semibold">{n({ name: c.item.studentName, nameAr: c.item.studentNameAr })}</span> · {money(c.item.total)} — {t(`reason.${c.result.reason ?? 'unknown_bracelet'}`)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
