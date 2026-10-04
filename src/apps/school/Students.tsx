import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Link2, Nfc, Repeat, Search, Snowflake } from 'lucide-react';
import { api, type Bracelet, type Student } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { cx } from '@/lib/cx';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input, Segmented, Select } from '@/ui/Form';
import { Avatar, PageTitle } from '@/ui/Misc';
import { Modal } from '@/ui/Modal';
import { EmptyState, ErrorState, LoadingBlock, errorMessage } from '@/ui/States';
import { useToast } from '@/ui/Toast';
import { AllergenBadge, TxRow } from '@/components/domain';

type Row = Awaited<ReturnType<typeof api.listStudents>>[number];
type Filter = 'all' | 'nobracelet' | 'frozen' | 'low';

export function Students({ schoolId }: { schoolId: string }) {
  const i18n = useI18n();
  const { t, n, money } = i18n;
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [detail, setDetail] = useState<Row | null>(null);
  const [replacing, setReplacing] = useState<Row | null>(null);
  const [assigning, setAssigning] = useState<Row | null>(null);
  const list = useApi(() => api.listStudents(schoolId, q), [schoolId, q]);

  const rows = useMemo(
    () =>
      (list.data ?? []).filter((s) =>
        filter === 'nobracelet' ? !s.braceletId : filter === 'frozen' ? s.frozen : filter === 'low' ? s.balance < s.lowBalanceThreshold : true,
      ),
    [list.data, filter],
  );
  const counts = useMemo(() => {
    const d = list.data ?? [];
    return { all: d.length, nobracelet: d.filter((s) => !s.braceletId).length, frozen: d.filter((s) => s.frozen).length, low: d.filter((s) => s.balance < s.lowBalanceThreshold).length };
  }, [list.data]);

  // Keep open modals in sync with live data.
  const live = (r: Row | null) => (r ? (list.data?.find((x) => x.id === r.id) ?? r) : null);

  return (
    <>
      <PageTitle title={t('students.title')} subtitle={t('students.subtitle', { count: counts.all })} />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <Input type="search" className="ps-9" placeholder={t('students.search')} aria-label={t('students.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={(['all', 'nobracelet', 'frozen', 'low'] as Filter[]).map((f) => ({ value: f, label: `${t(`students.filter.${f}`)} (${counts[f]})` }))}
          />
        </div>
        {list.loading ? (
          <LoadingBlock className="p-4" rows={6} />
        ) : list.error ? (
          <ErrorState className="m-4" error={list.error} onRetry={list.reload} />
        ) : rows.length === 0 ? (
          <EmptyState className="m-4" title={t('students.empty')} description={t('students.emptyHint')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-xs tracking-wide text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-start font-semibold">{t('students.col.student')}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{t('students.col.bracelet')}</th>
                  <th className="px-4 py-2.5 text-end font-semibold">{t('students.col.balance')}</th>
                  <th className="px-4 py-2.5 text-end font-semibold">{t('students.col.limit')}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{t('students.col.restrictions')}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{t('students.col.lastActivity')}</th>
                  <th className="px-4 py-2.5 text-end font-semibold">
                    <span className="sr-only">{t('students.col.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => setDetail(s)} className="flex items-center gap-3 text-start">
                        <Avatar name={s.name} color={s.avatarColor} size="sm" />
                        <span>
                          <span className="block font-semibold text-slate-900 hover:underline">{n(s)}</span>
                          <span className="block text-xs text-slate-500">
                            {t('common.grade', { grade: s.grade })}
                            {s.parent && ` · ${t('students.parentLinked')}`}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.bracelet ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="ltr-nums font-mono text-xs">{s.bracelet.id}</span>
                          {s.frozen && (
                            <Badge tone="info" icon={<Snowflake className="size-3" />}>
                              {t('students.frozen')}
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <Badge tone="warning">{t('students.noBracelet')}</Badge>
                      )}
                    </td>
                    <td className={cx('px-4 py-2.5 text-end font-semibold tabular-nums', s.balance < s.lowBalanceThreshold && 'text-amber-700')}>{money(s.balance)}</td>
                    <td className="px-4 py-2.5 text-end text-slate-700 tabular-nums">{s.dailyLimit != null ? money(s.dailyLimit) : '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {s.allergies.map((a) => (
                          <AllergenBadge key={a} allergen={a} active />
                        ))}
                        {s.blockedCategories.length + s.blockedItemIds.length > 0 && <Badge tone="violet">{t('students.parentBlocks', { count: s.blockedCategories.length + s.blockedItemIds.length })}</Badge>}
                        {s.allergies.length + s.blockedCategories.length + s.blockedItemIds.length === 0 && <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{s.lastActivity ? i18n.relative(s.lastActivity) : '—'}</td>
                    <td className="px-4 py-2.5 text-end">
                      {s.braceletId ? (
                        <Button size="sm" variant="secondary" icon={<Repeat className="size-3.5" />} onClick={() => setReplacing(s)}>
                          {t('students.replace')}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" icon={<Link2 className="size-3.5" />} onClick={() => setAssigning(s)}>
                          {t('students.assign')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detail && <StudentDetail student={live(detail)!} onClose={() => setDetail(null)} onReplace={() => setReplacing(live(detail))} />}
      {replacing && <ReplaceFlow student={live(replacing)!} onClose={() => setReplacing(null)} />}
      {assigning && <AssignFlow student={live(assigning)!} onClose={() => setAssigning(null)} />}
    </>
  );
}

function StudentDetail({ student: s, onClose, onReplace }: { student: Row; onClose: () => void; onReplace: () => void }) {
  const i18n = useI18n();
  const { t, n, money } = i18n;
  const txs = useApi(() => api.listTransactions({ studentId: s.id, limit: 8 }), [s.id]);
  return (
    <Modal open onClose={onClose} title={n(s)} size="lg">
      <div className="grid gap-4 md:grid-cols-2">
        <dl className="grid grid-cols-2 gap-y-2 rounded-xl bg-slate-50 p-4 text-sm">
          <dt className="text-slate-600">{t('students.col.balance')}</dt>
          <dd className="text-end font-bold tabular-nums">{money(s.balance)}</dd>
          <dt className="text-slate-600">{t('students.col.bracelet')}</dt>
          <dd className="ltr-nums text-end font-mono text-xs">{s.braceletId ?? '—'}</dd>
          <dt className="text-slate-600">{t('students.col.limit')}</dt>
          <dd className="text-end">{s.dailyLimit != null ? money(s.dailyLimit) : '—'}</dd>
          <dt className="text-slate-600">{t('students.parent')}</dt>
          <dd className="text-end">{s.parent ? n(s.parent) : t('students.notLinked')}</dd>
          <dt className="text-slate-600">{t('students.status')}</dt>
          <dd className="text-end">{s.frozen ? t('students.frozen') : t('students.active')}</dd>
          <dt className="col-span-2 mt-2 text-slate-600">{t('home.allergies')}</dt>
          <dd className="col-span-2 flex flex-wrap gap-1">{s.allergies.length ? s.allergies.map((a) => <AllergenBadge key={a} allergen={a} active />) : <span className="text-slate-500">{t('home.none')}</span>}</dd>
        </dl>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-700">{t('home.recent')}</h3>
          {txs.loading ? <LoadingBlock rows={3} /> : txs.data?.length ? <div className="divide-y divide-slate-100">{txs.data.map((tx) => <TxRow key={tx.id} tx={tx} />)}</div> : <EmptyState title={t('home.noTx')} />}
        </div>
      </div>
      {s.braceletId && (
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" icon={<Repeat className="size-4" />} onClick={() => (onClose(), onReplace())}>
            {t('students.replace')}
          </Button>
        </div>
      )}
    </Modal>
  );
}

const REASONS = ['lost', 'damaged', 'stolen', 'other'] as const;

function ReplaceFlow({ student: s, onClose }: { student: Row; onClose: () => void }) {
  const { t, n, money } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState<(typeof REASONS)[number]>('lost');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<{ oldId: string | null; newId: string; balance: number } | null>(null);

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      const r = await api.replaceBracelet(s.id, t(`students.reason.${reason}`));
      setDone(r);
      toast({ tone: 'success', title: t('students.replacedToast', { id: r.newId }) });
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
      title={t('students.replaceTitle')}
      footer={
        done ? (
          <Button onClick={onClose}>{t('common.done')}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={pending} onClick={confirm} icon={<Repeat className="size-4" />}>
              {t('students.replaceConfirm')}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-4 text-center animate-pop">
          <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
          <p className="font-semibold">{t('students.replacedTitle', { name: n(s) })}</p>
          <div className="flex items-center justify-center gap-3 font-mono text-sm" dir="ltr">
            <span className="rounded-lg bg-red-50 px-2 py-1 text-red-800 line-through">{done.oldId ?? '—'}</span>
            <ArrowRight className="size-4 text-slate-400" />
            <span className="rounded-lg bg-emerald-50 px-2 py-1 font-bold text-emerald-800">{done.newId}</span>
          </div>
          <p className="text-sm text-slate-600">{t('students.balanceCarried', { amount: money(done.balance) })}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <ol className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2">
              <span className="font-bold text-brand-700">1.</span> {t('students.replaceStep1', { id: s.braceletId ?? '' })}
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-brand-700">2.</span> {t('students.replaceStep2')}
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-brand-700">3.</span> {t('students.replaceStep3', { amount: money(s.balance) })}
            </li>
          </ol>
          <Field label={t('students.replaceReason')}>
            {(id) => (
              <Select id={id} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`students.reason.${r}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t('students.replaceWarning')}</p>
          {error != null && (
            <p role="alert" className="text-sm text-red-700">
              {errorMessage(error, t)}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function AssignFlow({ student: s, onClose }: { student: Student; onClose: () => void }) {
  const { t, n } = useI18n();
  const toast = useToast();
  const spares = useApi(() => api.listSpareBracelets(s.schoolId), [s.schoolId]);
  const [selected, setSelected] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const choice = selected || spares.data?.[0]?.id || '';

  const assign = async () => {
    setPending(true);
    setError(null);
    try {
      await api.assignBracelet(s.id, choice);
      toast({ tone: 'success', title: t('students.assignedToast', { id: choice, name: n(s) }) });
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
      title={t('students.assignTitle', { name: n(s) })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={pending} disabled={!choice} onClick={assign} icon={<Nfc className="size-4" />}>
            {t('students.assign')}
          </Button>
        </>
      }
    >
      {spares.loading ? (
        <LoadingBlock rows={2} />
      ) : !spares.data?.length ? (
        <EmptyState title={t('students.noSpares')} />
      ) : (
        <Field label={t('students.spareBracelet')} hint={t('students.spareHint', { count: spares.data.length })} error={error ? errorMessage(error, t) : undefined}>
          {(id) => (
            <Select id={id} value={choice} onChange={(e) => setSelected(e.target.value)} className="font-mono">
              {spares.data!.map((b: Bracelet) => (
                <option key={b.id} value={b.id}>
                  {b.id}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
    </Modal>
  );
}
