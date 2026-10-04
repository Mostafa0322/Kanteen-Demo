import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CreditCard, Landmark, Lock, Smartphone, XCircle } from 'lucide-react';
import { api, ApiError, type PaymentMethod, type Transaction } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { cx } from '@/lib/cx';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input, Switch } from '@/ui/Form';
import { Spinner, errorMessage } from '@/ui/States';

const PRESETS = [50, 100, 200, 500];
const FAIL_CARD = '4000000000000002';

type Step = 'amount' | 'details' | 'processing' | 'success' | 'failure';

export function TopUpScreen({ studentId }: { studentId: string }) {
  const i18n = useI18n();
  const { t, n, money } = i18n;
  const nav = useNavigate();
  const student = useApi(() => api.getStudent(studentId), [studentId]);
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState<number>(200);
  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [card, setCard] = useState({ number: '4242 4242 4242 4242', expiry: '12/29', cvc: '123' });
  const [phone, setPhone] = useState('010 1234 5678');
  const [ipa, setIpa] = useState('mona.hassan@instapay');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [result, setResult] = useState<Transaction | null>(null);
  const [error, setError] = useState<unknown>(null);

  const effective = custom ? Number(custom) : amount;
  const amountValid = Number.isFinite(effective) && effective >= 10 && effective <= 5000;

  const methods: { id: PaymentMethod; icon: typeof CreditCard; label: string; hint: string }[] = [
    { id: 'card', icon: CreditCard, label: t('topup.method.card'), hint: t('topup.method.cardHint') },
    { id: 'wallet', icon: Smartphone, label: t('topup.method.wallet'), hint: t('topup.method.walletHint') },
    { id: 'instapay', icon: Landmark, label: t('topup.method.instapay'), hint: t('topup.method.instapayHint') },
  ];

  const pay = async () => {
    setStep('processing');
    setError(null);
    try {
      const fail = simulateFailure || (method === 'card' && card.number.replace(/\s/g, '') === FAIL_CARD);
      const tx = await api.topUp({ studentId, amount: effective, method, simulateFailure: fail });
      setResult(tx);
      setStep('success');
    } catch (e) {
      setError(e);
      setStep('failure');
    }
  };

  const reset = () => {
    setStep('amount');
    setResult(null);
    setError(null);
  };

  if (step === 'processing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center" role="status">
        <div className="relative flex size-20 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Spinner className="size-10" />
        </div>
        <p className="text-lg font-semibold">{t('topup.processing')}</p>
        <p className="text-sm text-slate-600">{t(`topup.processing.${method}`)}</p>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <Lock className="size-3" /> {t('topup.secure')}
        </p>
      </div>
    );
  }

  if (step === 'success' && result) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center animate-pop">
        <CheckCircle2 className="size-20 text-emerald-600" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">{t('topup.success')}</h1>
        <p className="mt-1 text-slate-600">{t('topup.successBody', { amount: money(result.amount), name: student.data ? n(student.data) : '' })}</p>
        <Card className="mt-6 w-full p-4 text-start">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">{t('topup.newBalance')}</dt>
              <dd className="font-bold text-emerald-700 tabular-nums">{money(result.balanceAfter ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">{t('topup.method')}</dt>
              <dd className="font-medium">{t(`topup.method.${method}`)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">{t('topup.reference')}</dt>
              <dd className="ltr-nums font-mono text-xs">{result.id}</dd>
            </div>
          </dl>
        </Card>
        <div className="mt-6 grid w-full gap-2">
          <Button size="lg" onClick={() => nav('/parent')}>
            {t('topup.done')}
          </Button>
          <Button variant="ghost" onClick={reset}>
            {t('topup.another')}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'failure') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center animate-pop">
        <XCircle className="size-20 text-red-600" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">{t('topup.failed')}</h1>
        <p className="mt-1 text-slate-600">{error instanceof ApiError && error.code === 'payment_failed' ? t('topup.failedBody') : errorMessage(error, t)}</p>
        <p className="mt-2 text-sm text-slate-500">{t('topup.notCharged')}</p>
        <div className="mt-6 grid w-full gap-2">
          <Button size="lg" onClick={() => setStep('details')}>
            {t('common.retry')}
          </Button>
          <Button variant="ghost" onClick={reset}>
            {t('topup.changeMethod')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        {step === 'details' && (
          <button type="button" onClick={() => setStep('amount')} aria-label={t('common.back')} className="rounded-lg p-1.5 hover:bg-slate-100">
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold">{t('topup.title')}</h1>
          <p className="text-sm text-slate-600">
            {student.data ? t('topup.for', { name: n(student.data), balance: money(student.data.balance) }) : '…'}
          </p>
        </div>
      </div>

      {step === 'amount' && (
        <>
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-700">{t('topup.amount')}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={!custom && amount === p}
                  onClick={() => {
                    setAmount(p);
                    setCustom('');
                  }}
                  className={cx(
                    'h-14 rounded-xl text-lg font-bold tabular-nums ring-1 ring-inset transition',
                    !custom && amount === p ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-900 ring-slate-300 hover:bg-slate-50',
                  )}
                >
                  {money(p)}
                </button>
              ))}
            </div>
            <Field className="mt-3" label={t('topup.custom')} error={custom && !amountValid ? t('topup.amountRange', { min: money(10), max: money(5000) }) : undefined}>
              {(id) => <Input id={id} inputMode="decimal" type="number" min={10} max={5000} placeholder="e.g. 150" value={custom} onChange={(e) => setCustom(e.target.value)} />}
            </Field>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-700">{t('topup.method')}</h2>
            <div className="mt-3 space-y-2" role="radiogroup" aria-label={t('topup.method')}>
              {methods.map(({ id, icon: Icon, label, hint }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={method === id}
                  onClick={() => setMethod(id)}
                  className={cx('flex w-full items-center gap-3 rounded-xl p-3 text-start ring-1 ring-inset transition', method === id ? 'bg-brand-50 ring-2 ring-brand-600' : 'ring-slate-200 hover:bg-slate-50')}
                >
                  <span className={cx('flex size-10 items-center justify-center rounded-lg', method === id ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-700')}>
                    <Icon className="size-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">{label}</span>
                    <span className="block text-xs text-slate-600">{hint}</span>
                  </span>
                  <span className={cx('size-4 rounded-full ring-2 ring-inset', method === id ? 'bg-brand-700 ring-brand-700 shadow-[inset_0_0_0_3px_white]' : 'ring-slate-300')} />
                </button>
              ))}
            </div>
          </Card>

          <Button block size="lg" disabled={!amountValid} onClick={() => setStep('details')}>
            {t('topup.continue', { amount: amountValid ? money(effective) : '' })}
          </Button>
        </>
      )}

      {step === 'details' && (
        <>
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <span className="text-sm text-slate-600">{t('topup.paying')}</span>
              <span className="text-xl font-bold tabular-nums">{money(effective)}</span>
            </div>
            {method === 'card' && (
              <div className="space-y-3">
                <Field label={t('topup.cardNumber')} hint={t('topup.testCards')}>
                  {(id) => <Input id={id} dir="ltr" inputMode="numeric" autoComplete="off" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} />}
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t('topup.expiry')}>{(id) => <Input id={id} dir="ltr" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} />}</Field>
                  <Field label="CVC">{(id) => <Input id={id} dir="ltr" inputMode="numeric" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} />}</Field>
                </div>
              </div>
            )}
            {method === 'wallet' && (
              <Field label={t('topup.walletPhone')} hint={t('topup.walletOtp')}>
                {(id) => <Input id={id} dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
              </Field>
            )}
            {method === 'instapay' && (
              <Field label={t('topup.ipa')} hint={t('topup.ipaHint')}>
                {(id) => <Input id={id} dir="ltr" value={ipa} onChange={(e) => setIpa(e.target.value)} />}
              </Field>
            )}
          </Card>
          <Card className="border-dashed p-4">
            <Switch checked={simulateFailure} onChange={setSimulateFailure} tone="danger" label={t('topup.simulateFailure')} description={t('topup.simulateFailureHint')} />
          </Card>
          <Button block size="lg" icon={<Lock className="size-4" />} onClick={pay}>
            {t('topup.pay', { amount: money(effective) })}
          </Button>
          <p className="text-center text-xs text-slate-500">{t('topup.disclaimer')}</p>
        </>
      )}
    </div>
  );
}
