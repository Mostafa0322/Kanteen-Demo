import { useState, type FormEvent } from 'react';
import { LogIn } from 'lucide-react';
import { api } from '@/mock-api';
import { useI18n } from '@/i18n/I18nProvider';
import { useApi } from '@/lib/useApi';
import { Button } from '@/ui/Button';
import { Field, Input } from '@/ui/Form';
import { LangToggle } from '@/ui/Misc';
import { errorMessage } from '@/ui/States';
import { Logo } from '@/components/Logo';
import { useParentSession } from './session';

export function Login() {
  const { t } = useI18n();
  const { login } = useParentSession();
  const demo = useApi(() => api.listDemoParents(), [], { live: false });
  const [email, setEmail] = useState('mona@demo.kanteen');
  const [password, setPassword] = useState('demo1234');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (e?: FormEvent, override?: string) => {
    e?.preventDefault();
    setPending(true);
    setError(null);
    try {
      const p = await api.login(override ?? email, password || 'demo');
      login(p.id, p.childIds);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-b from-brand-800 to-brand-950 px-6 pt-6 pb-8 text-white">
      <div className="flex justify-end">
        <LangToggle compact className="!text-white !ring-white/40 hover:!bg-white/10" />
      </div>
      <div className="mt-8">
        <Logo inverted />
        <h1 className="mt-6 text-3xl font-bold">{t('login.title')}</h1>
        <p className="mt-2 text-brand-100">{t('login.subtitle')}</p>
      </div>
      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl bg-white p-5 text-slate-900 shadow-xl">
        <Field label={t('login.email')}>{(id) => <Input id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}</Field>
        <Field label={t('login.password')} hint={t('login.passwordHint')} error={error ? errorMessage(error, t) : undefined}>
          {(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Button type="submit" block size="lg" loading={pending} icon={<LogIn className="size-5 rtl:rotate-180" />}>
          {t('login.submit')}
        </Button>
      </form>
      <div className="mt-6">
        <p className="text-sm font-semibold text-brand-100">{t('login.demoAccounts')}</p>
        <div className="mt-2 space-y-2">
          {demo.data?.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={pending}
              onClick={() => {
                setEmail(p.email);
                void submit(undefined, p.email);
              }}
              className="flex w-full items-center justify-between rounded-xl bg-white/10 px-4 py-2.5 text-start ring-1 ring-white/20 hover:bg-white/15"
            >
              <span className="font-semibold">{p.name}</span>
              <span className="text-xs text-brand-100" dir="ltr">
                {p.email}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
