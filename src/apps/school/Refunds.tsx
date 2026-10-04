import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { addDays, api, dayKey, type AuditEntry } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { Badge, type Tone } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card, CardBody, CardHeader } from '@/ui/Card';
import { Field, Input, Select, Textarea } from '@/ui/Form';
import { PageTitle } from '@/ui/Misc';
import { EmptyState, ErrorState, LoadingBlock, errorMessage } from '@/ui/States';
import { useToast } from '@/ui/Toast';
import { txTitle } from '@/components/domain';

const QUICK_REASONS = ['wrongItem', 'doubleTap', 'outOfStock', 'quality'] as const;

export function Refunds({ schoolId }: { schoolId: string }) {
  const i18n = useI18n();
  const { t, n, money } = i18n;
  const toast = useToast();
  const students = useApi(() => api.listStudents(schoolId), [schoolId]);
  const audit = useApi(() => api.listAudit(schoolId), [schoolId]);
  const [studentId, setStudentId] = useState('');
  const [txId, setTxId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [auditFilter, setAuditFilter] = useState<AuditEntry['action'] | 'all'>('all');

  const purchases = useApi(
    () => (studentId ? api.listTransactions({ studentId, type: 'purchase', status: 'approved', from: dayKey(addDays(new Date(), -14)) }) : Promise.resolve([])),
    [studentId],
  );
  const tx = purchases.data?.find((x) => x.id === txId);
  const amt = Number(amount);
  const valid = studentId && amt > 0 && reason.trim() && (!tx || amt <= tx.amount);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      await api.refund({ studentId, amount: amt, reason, txId: txId || undefined });
      const s = students.data?.find((x) => x.id === studentId);
      toast({ tone: 'success', title: t('refunds.done', { amount: money(amt), name: s ? n(s) : '' }) });
      setTxId('');
      setAmount('');
      setReason('');
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };

  const studentName = (id?: string) => {
    const s = students.data?.find((x) => x.id === id);
    return s ? n(s) : '—';
  };
  const actionTone: Record<AuditEntry['action'], Tone> = {
    refund: 'success',
    bracelet_replaced: 'warning',
    bracelet_assigned: 'info',
    menu_created: 'brand',
    menu_updated: 'brand',
    settings_updated: 'neutral',
    data_reset: 'neutral',
  };
  const auditRows = useMemo(() => (audit.data ?? []).filter((a) => auditFilter === 'all' || a.action === auditFilter), [audit.data, auditFilter]);

  return (
    <>
      <PageTitle title={t('refunds.title')} subtitle={t('refunds.subtitle')} />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title={t('refunds.issue')} icon={<RotateCcw className="size-5" />} />
          <CardBody className="space-y-3">
            <Field label={t('refunds.student')}>
              {(id) => (
                <Select
                  id={id}
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    setTxId('');
                  }}
                >
                  <option value="">{t('refunds.pickStudent')}</option>
                  {students.data?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {n(s)} — {money(s.balance)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('refunds.purchase')} hint={t('refunds.purchaseHint')}>
              {(id) => (
                <Select
                  id={id}
                  value={txId}
                  disabled={!studentId}
                  onChange={(e) => {
                    setTxId(e.target.value);
                    const p = purchases.data?.find((x) => x.id === e.target.value);
                    if (p) setAmount(String(p.amount));
                  }}
                >
                  <option value="">{t('refunds.noPurchase')}</option>
                  {purchases.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {i18n.dateTime(p.createdAt)} · {txTitle(i18n, p)} · {money(p.amount)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('refunds.amount')} error={tx && amt > tx.amount ? t('error.exceeds_original') : undefined}>
              {(id) => <Input id={id} type="number" min={1} step={0.5} value={amount} onChange={(e) => setAmount(e.target.value)} />}
            </Field>
            <Field label={t('refunds.reason')}>
              {(id) => (
                <>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {QUICK_REASONS.map((r) => (
                      <button key={r} type="button" onClick={() => setReason(t(`refunds.quick.${r}`))} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">
                        {t(`refunds.quick.${r}`)}
                      </button>
                    ))}
                  </div>
                  <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('refunds.reasonPh')} />
                </>
              )}
            </Field>
            {error != null && (
              <p role="alert" className="text-sm text-red-700">
                {errorMessage(error, t)}
              </p>
            )}
            <Button block disabled={!valid} loading={pending} onClick={submit} icon={<RotateCcw className="size-4" />}>
              {valid ? t('refunds.submit', { amount: money(amt) }) : t('refunds.submitIdle')}
            </Button>
            <p className="text-xs text-slate-600">{t('refunds.auditNote')}</p>
          </CardBody>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title={t('refunds.audit')}
            subtitle={t('refunds.auditHint')}
            action={
              <Select aria-label={t('refunds.auditFilter')} value={auditFilter} onChange={(e) => setAuditFilter(e.target.value as typeof auditFilter)} className="!h-9 !w-44 text-sm">
                <option value="all">{t('refunds.auditAll')}</option>
                {(Object.keys(actionTone) as AuditEntry['action'][]).map((a) => (
                  <option key={a} value={a}>
                    {t(`audit.${a}`)}
                  </option>
                ))}
              </Select>
            }
          />
          <CardBody>
            {audit.loading ? (
              <LoadingBlock rows={5} />
            ) : audit.error ? (
              <ErrorState error={audit.error} onRetry={audit.reload} />
            ) : !auditRows.length ? (
              <EmptyState title={t('refunds.auditEmpty')} />
            ) : (
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white text-xs text-slate-600 uppercase">
                    <tr>
                      <th className="py-2 text-start font-semibold">{t('refunds.col.when')}</th>
                      <th className="py-2 text-start font-semibold">{t('refunds.col.action')}</th>
                      <th className="py-2 text-start font-semibold">{t('refunds.col.detail')}</th>
                      <th className="py-2 text-end font-semibold">{t('tx.col.amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditRows.map((a) => (
                      <tr key={a.id} className="align-top">
                        <td className="py-2 pe-3 whitespace-nowrap text-slate-600">{i18n.dateTime(a.at)}</td>
                        <td className="py-2 pe-3">
                          <Badge tone={actionTone[a.action]}>{t(`audit.${a.action}`)}</Badge>
                          <p className="mt-0.5 text-xs text-slate-500">{a.actor}</p>
                        </td>
                        <td className="py-2 pe-3">
                          {a.studentId && <p className="font-medium">{studentName(a.studentId)}</p>}
                          <p className="text-slate-600">{a.detail}</p>
                        </td>
                        <td className="py-2 text-end tabular-nums">{a.amount != null ? money(a.amount) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
